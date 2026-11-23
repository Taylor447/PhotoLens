import fallbackCatalog from '../data/devices.json';

const DB_NAME = 'photolens-device-catalog-v2';
const DB_VERSION = 1;
const DAILY = 24 * 60 * 60 * 1000;
const configuredRoot = String(import.meta.env.VITE_DEVICE_DATA_URL || '').trim();
const baseRoot = configuredRoot ? configuredRoot.replace(/\/?$/, '/') : new URL(`${import.meta.env.BASE_URL}data/`, location.origin).href;

function openDb() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB không được hỗ trợ.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được cơ sở dữ liệu thiết bị.'));
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không đọc được dữ liệu thiết bị.'));
  });
}

async function readDb(key, storeName = 'cache') {
  const db = await openDb();
  try { return await requestValue(db.transaction(storeName, 'readonly').objectStore(storeName).get(key)); }
  finally { db.close(); }
}

async function writeDb(payload, meta) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['cache', 'meta'], 'readwrite');
      const cache = transaction.objectStore('cache');
      const currentRequest = cache.get('current');
      currentRequest.onsuccess = () => {
        if (currentRequest.result) cache.put(currentRequest.result, 'previous');
        cache.put(payload, 'current');
        transaction.objectStore('meta').put(meta, 'catalog');
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Không thể lưu bộ dữ liệu mới.'));
      transaction.onabort = () => reject(transaction.error || new Error('Đã hủy cập nhật dữ liệu.'));
    });
  } finally { db.close(); }
}

async function fetchBytes(path, options = {}) {
  const response = await fetch(new URL(path, baseRoot), { cache: 'no-store', ...options, signal: options.signal || AbortSignal.timeout(20000) });
  if (response.status === 304) return { notModified: true, etag: response.headers.get('ETag') };
  if (!response.ok) throw new Error(`Không tải được dữ liệu (${response.status}).`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), etag: response.headers.get('ETag') };
}

async function fetchJsonVerified(path, expectedHash) {
  const result = await fetchBytes(path);
  if (await sha256(result.bytes) !== expectedHash) throw new Error(`Hash SHA-256 không khớp: ${path}`);
  return { value: JSON.parse(new TextDecoder().decode(result.bytes)), etag: result.etag };
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function decompressGzip(bytes) {
  if (!globalThis.DecompressionStream) throw new Error('Trình duyệt chưa hỗ trợ giải nén baseline gzip.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

const localHashes = record => record?.meta?.files || {};

async function readRemoteManifest(previousEtag = '') {
  const headers = previousEtag ? { 'If-None-Match': previousEtag } : {};
  const response = await fetch(new URL('manifest.json', baseRoot), { headers, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (response.status === 304) return { unchanged: true, etag: previousEtag };
  if (!response.ok) throw new Error(`Không kiểm tra được phiên bản dữ liệu (HTTP ${response.status}).`);
  return { manifest: await response.json(), etag: response.headers.get('ETag') || '' };
}

async function installBaseline(fallbackDevices) {
  const remote = await readRemoteManifest();
  const manifest = remote.manifest;
  if (manifest.schemaVersion !== 2) throw new Error('B? d? li?u d�ng schema kh�c; kh�ng th? c�i baseline n�y.');
  const baseline = await fetchBytes('baseline.json.gz');
  if (await sha256(baseline.bytes) !== manifest.files?.['baseline.json.gz']?.sha256) throw new Error('Baseline bị lỗi kiểm tra SHA-256.');
  const decoded = await decompressGzip(baseline.bytes);
  if (decoded.schemaVersion !== manifest.schemaVersion || !Array.isArray(decoded.devices)) throw new Error('Baseline không khớp schemaVersion trong manifest.');
  const indexResult = await fetchJsonVerified('index.json', manifest.files?.['index.json']?.sha256);
  if (!Array.isArray(indexResult.value)) throw new Error('index.json không hợp lệ.');
  const lensfunMeta = manifest.files?.['lensfun-derived.json'];
  const lensfun = lensfunMeta ? (await fetchJsonVerified('lensfun-derived.json', lensfunMeta.sha256)).value : null;
  const catalog = { devices: decoded.devices, index: indexResult.value, lensfun, meta: manifest };
  await writeDb(catalog, { manifest, etag: remote.etag || '', lastCheckedAt: new Date().toISOString() });
  return { devices: catalog.devices, meta: manifest, note: 'Đã lưu bộ nền offline trên thiết bị.' };
}

export async function loadDeviceCatalog(fallbackDevices = fallbackCatalog) {
  try {
    const [catalog, meta] = await Promise.all([readDb('current'), readDb('catalog', 'meta')]);
    if (!catalog) return await installBaseline(fallbackDevices);
    let note = 'Đang dùng bản offline đã lưu.';
    if (!meta?.lastCheckedAt || Date.now() - Date.parse(meta.lastCheckedAt) >= DAILY) {
      try {
        const result = await checkDeviceCatalogUpdates({ force: true });
        note = result.updated ? 'Đã cập nhật dữ liệu thiết bị.' : 'Dữ liệu thiết bị đã mới nhất.';
        const fresh = await readDb('current');
        return { devices: fresh?.devices || catalog.devices, meta: fresh?.meta || catalog.meta, note };
      } catch (error) { note = `Đang dùng bản offline. ${error.message}`; }
    }
    return { devices: catalog.devices || fallbackDevices, meta: catalog.meta || meta?.manifest || null, note };
  } catch {
    return { devices: fallbackDevices, meta: null, note: 'IndexedDB chưa khả dụng; đang dùng bộ nền tích hợp trong ứng dụng.' };
  }
}

export async function checkDeviceCatalogUpdates({ force = false } = {}) {
  const stored = await readDb('catalog', 'meta');
  if (!force && stored?.lastCheckedAt && Date.now() - Date.parse(stored.lastCheckedAt) < DAILY) return { updated: false, message: 'Đã kiểm tra trong 24 giờ qua.' };
  const response = await readRemoteManifest(stored?.etag || '');
  const checkedAt = new Date().toISOString();
  if (response.unchanged) {
    const current = await readDb('current');
    if (!current) return installBaseline(fallbackCatalog).then(() => ({ updated: true, message: 'Đã cài bộ dữ liệu nhúng.' }));
    await writeDb(current, { ...stored, lastCheckedAt: checkedAt });
    return { updated: false, message: 'Dữ liệu không thay đổi.' };
  }
  const manifest = response.manifest;
  if (manifest.schemaVersion !== 2) throw new Error('Bản cập nhật dùng schema khác; dữ liệu cũ được giữ nguyên.');
  const existing = await readDb('current');
  const oldBuiltAt = Date.parse(existing?.meta?.builtAt || stored?.manifest?.builtAt || '');
  const newBuiltAt = Date.parse(manifest.builtAt || '');
  if (Number.isFinite(oldBuiltAt) && Number.isFinite(newBuiltAt) && newBuiltAt < oldBuiltAt) throw new Error('Manifest cũ hơn dữ liệu đang dùng; bản hiện tại được giữ nguyên.');
  if (stored?.manifest?.dataVersion === manifest.dataVersion) {
    const current = existing;
    if (!current) return installBaseline(fallbackCatalog).then(() => ({ updated: true, message: 'Đã cài bộ dữ liệu nhúng.' }));
    await writeDb({ ...current, meta: manifest }, { manifest, etag: response.etag, lastCheckedAt: checkedAt });
    return { updated: false, message: 'Dữ liệu không thay đổi.' };
  }
  const current = existing;
  if (!current) return installBaseline(fallbackCatalog).then(() => ({ updated: true, message: 'Đã cài bộ dữ liệu nền.' }));
  const nextHashes = Object.fromEntries(Object.entries(manifest.files || {}).map(([path, item]) => [path, item.sha256]));
  const oldHashes = localHashes(current);
  let index = current.index;
  const indexHash = nextHashes['index.json'];
  if (!indexHash) throw new Error('Manifest thiếu index.json.');
  if (oldHashes['index.json'] !== indexHash) index = (await fetchJsonVerified('index.json', indexHash)).value;
  if (!Array.isArray(index)) throw new Error('index.json không hợp lệ.');
  const currentById = new Map((current.devices || []).map(device => [device.id, device]));
  const toLoad = Object.entries(manifest.files || {}).filter(([path, item]) => path.startsWith('devices/') && oldHashes[path] !== item.sha256 && index.some(entry => `${entry.id}.json` === path.slice('devices/'.length)));
  const updated = await Promise.all(toLoad.map(async ([path, item]) => [path.slice('devices/'.length, -5), (await fetchJsonVerified(path, item.sha256)).value]));
  for (const [id, record] of updated) currentById.set(id, record);
  const devices = index.map(entry => currentById.get(entry.id)).filter(Boolean);
  if (devices.length !== index.length) throw new Error('Thiếu file chi tiết thiết bị; dữ liệu hiện tại được giữ nguyên.');
  const lensfunMeta = manifest.files?.['lensfun-derived.json'];
  const lensfunHashChanged = lensfunMeta && oldHashes['lensfun-derived.json'] !== lensfunMeta.sha256;
  const lensfun = lensfunHashChanged ? (await fetchJsonVerified('lensfun-derived.json', lensfunMeta.sha256)).value : current.lensfun || null;
  const next = { devices, index, lensfun, meta: manifest };
  await writeDb(next, { manifest, etag: response.etag, lastCheckedAt: checkedAt });
  return { updated: true, message: `Đã cập nhật ${updated.length} tệp thiết bị.` };
}

export async function downloadFullDeviceData() {
  const current = await readDb('current');
  if (!current?.meta?.files) return installBaseline(fallbackCatalog);
  const manifest = current.meta;
  const records = await Promise.all(Object.entries(manifest.files).filter(([path]) => path.startsWith('devices/')).map(([path, item]) => fetchJsonVerified(path, item.sha256).then(result => result.value)));
  const lensfunMeta = manifest.files['lensfun-derived.json'];
  const lensfun = lensfunMeta ? (await fetchJsonVerified('lensfun-derived.json', lensfunMeta.sha256)).value : null;
  const next = { ...current, devices: records, lensfun };
  await writeDb(next, { ...(await readDb('catalog', 'meta')), manifest, fullDownloadedAt: new Date().toISOString() });
  return { devices: records, meta: manifest, note: 'Đã tải đầy đủ dữ liệu chi tiết.' };
}

export async function clearDownloadedDeviceData() {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['cache', 'meta'], 'readwrite');
      tx.objectStore('cache').clear(); tx.objectStore('meta').clear();
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
  return { devices: fallbackCatalog, meta: null, note: 'Đã xóa bản tải trên thiết bị; bộ nền tích hợp vẫn còn dùng được.' };
}
