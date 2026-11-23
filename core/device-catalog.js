const text = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/[^a-z0-9]+/g, ' ').trim();
const get = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);

function editDistance(a, b, limit = 3) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

function scoreQuery(device, query) {
  const q = text(query);
  if (!q) return 0;
  const words = [device.brand, device.model, ...(device.aliases || []), ...(device.variants || []).flatMap(v => v.aliases || [])].map(text).filter(Boolean);
  if (words.some(value => value === q)) return 100;
  if (words.some(value => value.startsWith(q))) return 80;
  if (words.some(value => value.includes(q))) return 60;
  const qWords = q.split(' ');
  if (words.some(value => qWords.every(word => value.includes(word)))) return 50;
  const queryWords = q.split(' ');
  const near = queryWords.every(queryWord => words.some(value => value.split(' ').some(word => editDistance(word, queryWord, 2) <= 2)));
  return near ? 25 : -1;
}

export function searchDeviceCatalog(devices, query = '', filters = {}, limit = 1000) {
  return (devices || []).map(device => ({ device, rank: scoreQuery(device, query) }))
    .filter(({ device, rank }) => rank >= 0 && (!filters.brand || device.brand === filters.brand) && (!filters.type || device.type === filters.type))
    .sort((a, b) => b.rank - a.rank || String(a.device.model).localeCompare(String(b.device.model), 'vi'))
    .slice(0, limit).map(item => item.device);
}

const FACT_PATHS = [
  'sensor.type','sensor.size','sensor.dimensionsMm','sensor.megapixels','sensor.pixelPitchUm','sensor.iso','sensor.raw','sensor.rawBitDepth','sensor.colorDepth',
  'lens.focal35mm','lens.minFocal35mm','lens.aperture','lens.maxApertureF','lens.opticalZoom','lens.macro','lens.mount','lens.ecosystem',
  'focus.autofocus','focus.subjectTracking','focus.stabilization','focus.burstFps',
  'video.maxResolution','video.maxFps','video.codec','video.hdrLog','video.bitDepth','video.stabilization','durability.rating','durability.display','durability.viewfinder',
  'power.battery','power.batteryShots','power.storage','power.storageGB','power.weightG','power.dimensionsMm','power.connectivity','chip','ramGB','storageGB','display.technology','display.sizeInches','battery.capacityMah','battery.capacityTypicalMah','battery.capacityNominalMah','battery.capacityRatedMah'
];

export function computeDeviceCoverage(devices) {
  const entries = devices || [];
  let totalFields = 0, populatedFields = 0, verifiedFields = 0;
  const byGroup = {};
  for (const device of entries) {
    for (const path of FACT_PATHS) {
      totalFields++;
      const value = get(device, path);
      const known = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
      const group = path.split(".")[0];
      byGroup[group] ||= { total: 0, populated: 0, verified: 0 };
      byGroup[group].total++;
      if (known) {
        populatedFields++; byGroup[group].populated++;
        const provenance = device.provenance?.[path] || device[group]?.provenance || device.provenance?.[group];
        if (provenance?.verified === true) { verifiedFields++; byGroup[group].verified++; }
      }
    }
    for (const camera of device.cameraModules || []) {
      const cameraPaths = ["megapixels","sensorSize","pixelPitchUm","focalLengthMm","focalLength35mm","apertureF","ois","autofocus","opticalZoom"];
      byGroup.cameraModules ||= { total: 0, populated: 0, verified: 0 };
      for (const key of cameraPaths) {
        totalFields++; byGroup.cameraModules.total++;
        const value = camera[key];
        const known = value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
        if (known) { populatedFields++; byGroup.cameraModules.populated++; if (camera.provenance?.verified === true) { verifiedFields++; byGroup.cameraModules.verified++; } }
      }
    }
  }
  return {
    deviceCount: entries.length, verifiedDeviceCount: entries.filter(d => d.verified === true).length,
    totalFields, populatedFields, verifiedFields,
    fieldCoveragePercent: totalFields ? Number((populatedFields / totalFields * 100).toFixed(1)) : 0,
    verifiedFieldPercent: populatedFields ? Number((verifiedFields / populatedFields * 100).toFixed(1)) : 0,
    byGroup
  };
}
export function changedManifestFiles(currentHashes = {}, nextFiles = {}) {
  return Object.entries(nextFiles).filter(([path, hash]) => currentHashes[path] !== hash).map(([path]) => path).sort();
}

export function compareCameraModuleFields(devices = [], onlyDifferences = false) {
  const labels = { main: 'Chính', ultrawide: 'Siêu rộng', tele: 'Tele', macro: 'Macro', front: 'Trước', action: 'Action', other: 'Khác' };
  const fields = [
    ['megapixels', 'Độ phân giải', 'MP'], ['sensorSize', 'Kích thước cảm biến', ''],
    ['pixelPitchUm', 'Kích thước điểm ảnh', 'µm'], ['focalLengthMm', 'Tiêu cự thực', 'mm'],
    ['focalLength35mm', 'Tiêu cự quy đổi 35mm', 'mm'], ['apertureF', 'Khẩu độ', 'f/'],
    ['ois', 'OIS', ''], ['autofocus', 'Lấy nét', ''], ['opticalZoom', 'Zoom quang', '×']
  ];
  const identities = new Set();
  for (const device of devices) {
    const seen = new Map();
    for (const module of device.cameraModules || []) {
      const role = module.role || 'other';
      const index = seen.get(role) || 0;
      seen.set(role, index + 1);
      identities.add(`${role}:${index}`);
    }
  }
  const rows = [];
  for (const identity of identities) {
    const [role, indexText] = identity.split(':');
    const index = Number(indexText);
    const roleModules = devices.map(device => (device.cameraModules || []).filter(module => (module.role || 'other') === role)[index] || null);
    const roleLabel = labels[role] || labels.other;
    for (const [field, label, unit] of fields) {
      const values = roleModules.map(module => module?.[field] ?? null);
      const known = values.filter(value => value !== null && value !== undefined && value !== '');
      const different = known.length > 1 && new Set(known.map(value => JSON.stringify(value))).size > 1;
      if (!onlyDifferences || different) rows.push({ path: `cameraModules.${role}.${index}.${field}`, label: `Camera ${roleLabel}${index ? ` ${index + 1}` : ''} · ${label}`, unit, values, different });
    }
  }
  return rows;
}

export function mergeCatalogDelta(currentDevices, index, updatedById = {}) {
  const current = new Map((currentDevices || []).map(device => [device.id, device]));
  const result = [];
  for (const entry of index || []) {
    const updated = updatedById[entry.id];
    const existing = current.get(entry.id);
    const record = updated || existing;
    if (record) result.push(record);
  }
  return result;
}

export function shouldCheckDeviceManifest(lastCheckedAt, now = Date.now()) {
  const time = Date.parse(lastCheckedAt || '');
  return !Number.isFinite(time) || now - time >= 24 * 60 * 60 * 1000;
}

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 không được trình duyệt hỗ trợ.');
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
