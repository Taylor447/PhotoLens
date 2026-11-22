import '../css/tokens.css';
import '../css/style.css';
import '../css/ai.css';
import { Capacitor, registerPlugin } from '@capacitor/core';
const NativeApp = registerPlugin('App');
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { analyzePixels, formatBytes, metricRows, scoreLabels } from '../core/metrics.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const svg = (path) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const icons = {
  photo: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'),
  upload: svg('<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/>'),
  camera: svg('<path d="M14 4H9L7.5 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2.5L15 4Z"/><circle cx="12" cy="13" r="3.5"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>'),
  lock: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/><path d="M12 14v3"/>'),
  sparkle: svg('<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>'),
  close: svg('<path d="m18 6-12 12M6 6l12 12"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-5 5"/>'),
  compare: svg('<path d="M8 5H4v14h4M16 5h4v14h-4"/><path d="M10 8h4m-4 4h4m-4 4h4"/>'),
  export: svg('<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/>'),
  grid: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>'),
  trash: svg('<path d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>'),
  theme: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>')
};

const brandMark = `<img src="${import.meta.env.BASE_URL}assets/photolens-logo.png" alt="" />`

const root = $('#app');
root.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div class="brand"><div class="brand-mark">${brandMark}</div><div><div class="brand-name">PhotoLens</div><div class="brand-sub">Analysis &amp; Editor</div></div></div>
      <div class="top-actions">
        <button class="icon-btn" id="themeBtn" title="Chuyển giao diện sáng/tối" aria-label="Chuyển giao diện sáng/tối" aria-pressed="false">${icons.theme}</button>
        <button class="icon-btn" id="settingsBtn" title="Cấu hình AI" aria-label="Cấu hình AI">${icons.sparkle}</button>
        <button class="icon-btn" id="historyBtn" title="Lịch sử phân tích" aria-label="Lịch sử">${icons.history}<span class="history-label">Lịch sử</span></button>
      </div>
    </header>
    <section class="hero">
      <div><div class="eyebrow">PHÂN TÍCH HÌNH ẢNH</div><h1>Ảnh của bạn.</h1></div>
      <nav class="mode-switch" role="tablist" aria-label="Chế độ">
        <button class="active" role="tab" aria-selected="true" data-mode="single">${icons.photo}<span>Phân tích</span></button>
        <button role="tab" aria-selected="false" data-mode="compare">${icons.compare}<span>So sánh</span></button>
      </nav>
    </section>
    <section class="upload-grid" aria-label="Tải ảnh">
      ${['A','B'].map(id => `<article class="upload-card ${id === 'B' ? 'hidden' : ''}" data-slot="${id}" id="card${id}">
        <span class="slot-badge">ẢNH ${id}</span>
        <div class="drop-content"> <div class="upload-icon">${icons.upload}</div><div class="drop-title">Kéo ảnh vào đây</div><div class="drop-hint">JPG · PNG · WEBP · HEIC</div>
          <div class="upload-actions"><button class="mini-btn" data-pick="${id}">Chọn ảnh</button><button class="mini-btn" data-camera="${id}">${icons.camera} Chụp ảnh</button></div>
        </div>
        <div class="preview-wrap" hidden><img alt="Xem trước ảnh ${id}"/><canvas class="overlay-canvas" hidden></canvas><div class="preview-meta"><span class="file-chip"></span><div class="preview-actions"><button class="preview-action" type="button" data-change="${id}" aria-label="Đổi ảnh ${id}">${icons.upload}<span>Đổi ảnh</span></button><button class="remove-photo" type="button" data-remove="${id}" aria-label="Xóa ảnh ${id}">${icons.close}</button></div></div></div>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" data-input="${id}" aria-label="Chọn ảnh ${id}" hidden />
      </article>`).join('')}
    </section>
    <div class="overlay-legend" id="overlayLegend" hidden><span><i class="red"></i>Cháy sáng</span><span><i class="blue"></i>Mất chi tiết tối</span><span><i class="green"></i>Cạnh tương phản cao</span><span><i class="white"></i>Lưới 1/3</span></div>
    <section class="control-row controls-only">
      <div class="controls"><button class="primary-btn" id="analyzeBtn">${icons.sparkle}<span>Phân tích ảnh</span></button><button class="soft-btn" id="overlayBtn" aria-pressed="false">${icons.grid} Lưới & vùng</button><button class="ghost-btn" id="clearBtn">${icons.trash} Xóa ảnh</button></div>
    </section>
    <section id="report" class="report" aria-live="polite" aria-atomic="false"><div class="empty-state"><div class="empty-orb">${icons.chart}</div><strong>Sẵn sàng xem ảnh của bạn</strong><p>Tải một ảnh lên để xem chỉ số kỹ thuật, hoặc bật So sánh để đối chiếu hai ảnh.</p></div></section>
  </main>
  <nav class="bottom-nav"><button class="active" data-mode="single">${icons.photo}<span>Phân tích</span></button><button data-mode="compare">${icons.compare}<span>So sánh</span></button><button id="mobileHistory">${icons.history}<span>Lịch sử</span></button></nav>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div id="modalHost"></div>`;

const slots = { A: null, B: null };
let mode = 'single', showOverlay = false, lastResult = null, currentHistory = [];
let worker;
let activeAiController = null, analysisRun = 0;
const pending = new Map();
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_DECODED_PIXELS = 100_000_000;
try {
  worker = new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const item = pending.get(data.id); if (!item) return;
    pending.delete(data.id);
    clearTimeout(item.timer);
    data.error ? item.reject(new Error(data.error)) : item.resolve(data.metrics);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    const error = new Error('Bộ phân tích nền gặp sự cố. Đang chuyển sang chế độ dự phòng.');
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear(); worker?.terminate(); worker = null;
  };
} catch (e) { console.warn('Không khởi tạo được Web Worker:', e); }

function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2800); }
// Worker/API có thể trả lỗi lồng nhau; tránh hiển thị [object Object] trong giao diện.
function readableErrorMessage(value, fallback = 'Không thể kết nối AI. Các chỉ số cục bộ vẫn được giữ.') {
  let current = value;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current === 'string' && current.trim()) return current.trim();
    if (current instanceof Error) { current = current.message; continue; }
    if (!current || typeof current !== 'object') break;
    if (current.message != null) { current = current.message; continue; }
    if (current.error != null) { current = current.error; continue; }
    const messages = {
      ORIGIN_NOT_ALLOWED: 'Worker chưa cho phép địa chỉ của ứng dụng. Hãy dùng http://localhost:5173 hoặc thêm đúng origin vào ALLOWED_ORIGINS rồi deploy lại Worker.',
      KEY_NOT_CONFIGURED: 'Worker chưa được cấu hình secret GEMINI_API_KEY.',
      GEMINI_AUTH: 'Gemini từ chối API key. Hãy kiểm tra secret GEMINI_API_KEY trên Cloudflare.',
      GEMINI_RATE_LIMIT: 'Gemini đang giới hạn yêu cầu. Hãy thử lại sau ít phút.'
    };
    if (typeof current.code === 'string' && messages[current.code]) return messages[current.code];
    break;
  }
  return fallback;
}
const ENV_AI_ENDPOINT = String(import.meta.env.VITE_AI_ENDPOINT || '').trim();
let aiEnabled = false;
let aiPreferenceLoaded = false;
async function getPreference(key) {
  try {
    if (Capacitor.isNativePlatform()) return (await Preferences.get({ key })).value;
    return localStorage.getItem(key);
  } catch { return null; }
}
async function setPreference(key, value) {
  if (Capacitor.isNativePlatform()) return Preferences.set({ key, value: String(value) });
  localStorage.setItem(key, String(value));
}
async function loadAiEnabled() {
  if (!aiPreferenceLoaded) {
    aiEnabled = (await getPreference('photolens_ai_enabled')) === 'true';
    aiPreferenceLoaded = true;
  }
  return aiEnabled;
}
async function getAiEndpoint() {
  if (ENV_AI_ENDPOINT) return ENV_AI_ENDPOINT;
  const stored = await getPreference('photolens_worker_url');
  if (stored !== null) return String(stored).trim();
  const legacy = await getPreference('photolens_proxy_url');
  if (legacy) {
    try { await setPreference('photolens_worker_url', legacy); } catch { /* Tiếp tục dùng URL cũ nếu không ghi được cấu hình mới. */ }
  }
  return String(legacy || '').trim();
}
function decodeImage(img, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Hết thời gian đọc ảnh.')), timeoutMs);
    img.decode().then(() => { clearTimeout(timer); resolve(); }, error => { clearTimeout(timer); reject(error); });
  });
}
function applyTheme(value) {
  const theme = value === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const button = $('#themeBtn');
  button?.setAttribute('aria-pressed', String(theme === 'light'));
  button?.setAttribute('aria-label', theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng');
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('photolens_theme', next); } catch { /* Giao diện vẫn đổi dù bộ nhớ bị khóa. */ }
  applyTheme(next);
}
async function showOnboarding() {
  if ((await getPreference('photolens_onboarding_done')) === '1') return;
  const askAi = (await getPreference('photolens_ai_enabled')) === null;
  openModal(`<div class="onboarding-mark">${icons.photo}</div><h2>Chào mừng đến với PhotoLens</h2><p>Chọn ảnh để xem chỉ số kỹ thuật hoặc so sánh ảnh A và B.</p><div class="privacy-card"><strong>Quyền riêng tư</strong><p>Chỉ số được đo trên máy. Nếu bật AI, ứng dụng chỉ gửi ảnh JPEG đã thu nhỏ tối đa 1024 px; ảnh được tạo lại bằng Canvas nên EXIF/GPS bị loại bỏ. Phần đo cục bộ vẫn dùng được khi ngoại tuyến.</p></div>${askAi ? `<label class="setting-toggle" for="onboardingUseAi"><input type="checkbox" id="onboardingUseAi"><span>Dùng AI để nhận xét ảnh (có thể đổi trong Cài đặt)</span></label>` : ''}<div class="modal-actions"><button class="primary-btn" id="onboardingStart">Bắt đầu</button></div>`);
  $('#onboardingStart')?.addEventListener('click', async () => {
    if (askAi) {
      aiEnabled = $('#onboardingUseAi').checked;
      aiPreferenceLoaded = true;
      try { await setPreference('photolens_ai_enabled', aiEnabled); } catch { toast('Không lưu được lựa chọn AI trên thiết bị.'); }
    } else await loadAiEnabled();
    try { await setPreference('photolens_onboarding_done', '1'); } catch { /* Có thể xem lại hướng dẫn ở lần mở sau. */ }
    closeModal();
  });
}
function setMode(value) {
  mode = value;
  $$('[data-mode]').forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.mode === mode)));
  $$('[data-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  $('#cardB').classList.toggle('hidden', mode !== 'compare');
  $('#analyzeBtn span').textContent = mode === 'compare' ? 'So sánh ảnh' : 'Phân tích ảnh';
  if (mode === 'compare' && slots.A && !slots.B) toast('Thêm ảnh B để bắt đầu so sánh.');
}
$$('[data-mode]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

for (const id of ['A','B']) {
  $(`[data-pick="${id}"]`).addEventListener('click', () => $(`[data-input="${id}"]`).click());
  $(`[data-change="${id}"]`).addEventListener('click', () => $(`[data-input="${id}"]`).click());
  $(`[data-input="${id}"]`).addEventListener('change', e => { if (e.target.files?.[0]) addFile(id, e.target.files[0]); e.target.value = ''; });
  $(`[data-camera="${id}"]`).addEventListener('click', () => takePhoto(id));
  $(`[data-remove="${id}"]`).addEventListener('click', () => removeSlot(id));
  const card = $(`#card${id}`);
  card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag'); });
  card.addEventListener('dragleave', e => { if (!card.contains(e.relatedTarget)) card.classList.remove('drag'); });
  card.addEventListener('drop', e => { e.preventDefault(); card.classList.remove('drag'); const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/') || /\.(heic|heif)$/i.test(x.name)); if (f) addFile(id, f); else toast('Hãy thả vào một tệp ảnh hợp lệ.'); });
}
$('#overlayBtn').addEventListener('click', () => { showOverlay = !showOverlay; $('#overlayBtn').classList.toggle('active', showOverlay); $('#overlayBtn').setAttribute('aria-pressed', String(showOverlay)); $('#overlayLegend').hidden = !showOverlay; Object.keys(slots).forEach(drawOverlay); });
$('#clearBtn').addEventListener('click', clearAll);
$('#analyzeBtn').addEventListener('click', runAnalysis);
$('#historyBtn').addEventListener('click', showHistory);
$('#mobileHistory').addEventListener('click', showHistory);
$('#settingsBtn').addEventListener('click', showSettings);
$('#themeBtn').addEventListener('click', toggleTheme);

async function sniffImage(file) {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'png';
  if (bytes.length >= 12 && ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') return 'webp';
  if (bytes.length >= 16 && ascii(4,4) === 'ftyp') {
    const known = new Set(['heic','heix','hevc','hevx','heis','heim','hevm','hevs','hev1','mif1','msf1']);
    const brands = [ascii(8,4)];
    for (let i = 16; i + 4 <= bytes.length; i += 4) brands.push(ascii(i,4));
    if (brands.some(brand => known.has(brand.toLowerCase()))) return 'heic';
  }
  return null;
}

async function readHeaderDimensions(file, format) {
  // Từ chối ảnh quá lớn từ header trước khi trình duyệt giải mã toàn bộ bitmap.
  const bytes = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (format === 'png' && bytes.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (format === 'webp' && bytes.length >= 30) {
    const tag = String.fromCharCode(...bytes.slice(12, 16));
    if (tag === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (tag === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8), height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10) };
    if (tag === 'VP8 ') return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  if (format === 'jpeg') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
      }
      offset += length;
    }
  }
  return null;
}

async function addFile(id, originalFile) {
  if (!originalFile) return;
  if (!Number.isFinite(originalFile.size) || originalFile.size <= 0) { toast('Tệp ảnh rỗng hoặc không đọc được.'); return; }
  if (originalFile.size > MAX_UPLOAD_BYTES) { toast(`Ảnh vượt giới hạn ${formatBytes(MAX_UPLOAD_BYTES)}. Hãy giảm dung lượng rồi thử lại.`); return; }
  let format;
  try { format = await sniffImage(originalFile); }
  catch { toast('Không đọc được tệp ảnh này.'); return; }
  if (!format) { toast('Tệp không đúng định dạng ảnh JPG, PNG, WebP hoặc HEIC.'); return; }
  try {
    const dimensions = await readHeaderDimensions(originalFile, format);
    if (dimensions?.width && dimensions?.height && dimensions.width * dimensions.height > MAX_DECODED_PIXELS) {
      toast('Ảnh có độ phân giải quá lớn để xử lý an toàn trên thiết bị này. Hãy thu nhỏ ảnh rồi thử lại.'); return;
    }
  } catch { /* Trình giải mã sẽ xác thực tệp nếu header không đọc được. */ }

  let file = new File([originalFile], originalFile.name, { type: `image/${format === 'heic' ? 'heic' : format}`, lastModified: originalFile.lastModified });
  let exif = null;
  try {
    // Chỉ tải bộ đọc EXIF khi đã chọn ảnh; nếu ngoại tuyến/chunk lỗi thì bỏ qua metadata.
    const { default: exifr } = await import('exifr');
    const data = await exifr.parse(originalFile, { pick: ['Make','Model','ISO','FNumber','ExposureTime','FocalLength','LensModel','DateTimeOriginal'] });
    if (data) exif = { make: data.Make, model: data.Model, iso: data.ISO, aperture: data.FNumber, exposure: data.ExposureTime, focalLength: data.FocalLength, lens: data.LensModel, date: data.DateTimeOriginal };
  } catch { /* EXIF/GPS có thể không tồn tại hoặc ảnh có metadata lỗi. */ }
  if (format === 'heic') {
    const { default: heic2any } = await import('heic2any');
    try {
      const converted = await heic2any({ blob: originalFile, toType: 'image/jpeg', quality: .92 });
      file = new File([Array.isArray(converted) ? converted[0] : converted], originalFile.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg', lastModified: originalFile.lastModified });
    } catch (err) { toast('Không giải mã được ảnh HEIC này. Hãy chuyển sang JPG rồi thử lại.'); console.warn(err); return; }
  }
  let url;
  try {
    url = URL.createObjectURL(file);
    const img = new Image(); img.src = url;
    await decodeImage(img);
    const width = img.naturalWidth, height = img.naturalHeight;
    if (!width || !height) throw new Error('Kích thước ảnh không hợp lệ.');
    if (width * height > MAX_DECODED_PIXELS) throw new Error('Ảnh có độ phân giải quá lớn để xử lý an toàn trên thiết bị này.');
    if (slots[id]?.url) URL.revokeObjectURL(slots[id].url);
    slots[id] = { id, file, originalFile, url, width, height, exif };
    const card = $(`#card${id}`); card.classList.add('has-image'); $('.drop-content', card).hidden = true; $('.preview-wrap', card).hidden = false;
    $('img', card).src = url; $('.file-chip', card).textContent = `${file.name} · ${width}×${height} · ${formatBytes(originalFile.size)}`;
    drawOverlay(id); $('#report').innerHTML = emptyReport();
    toast(`Đã thêm ảnh ${id}.`);
  } catch (err) {
    if (url) URL.revokeObjectURL(url);
    toast(err.message?.includes('quá lớn') ? err.message : 'Không thể mở ảnh này. Kiểm tra tệp hoặc thử ảnh khác.');
    console.warn('Image decode failed:', err);
  }
}

async function takePhoto(id) {
  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await Camera.requestPermissions({ permissions: ['camera'] });
      if (permission.camera !== 'granted') { toast('Cần cho phép PhotoLens dùng camera để chụp ảnh.'); return; }
      const photo = await Camera.getPhoto({ quality: 95, allowEditing: false, resultType: CameraResultType.Uri, source: CameraSource.Camera, width: 2400 });
      const response = await fetch(photo.webPath); const blob = await response.blob();
      await addFile(id, new File([blob], `PhotoLens-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } catch (e) { if (e?.message && !/cancel/i.test(e.message)) { console.warn(e); toast('Không mở được camera. Hãy kiểm tra quyền camera hoặc chọn ảnh từ thư viện.'); } }
    return;
  }
  const input = $(`[data-input="${id}"]`); input.setAttribute('capture','environment'); input.click(); setTimeout(() => input.removeAttribute('capture'), 1000);
}

function removeSlot(id) {
  analysisRun++; activeAiController?.abort(new DOMException('Da huy phan tich.', 'AbortError'));
  if (slots[id]?.url) URL.revokeObjectURL(slots[id].url);
  slots[id] = null;
  const card = $(`#card${id}`); card.classList.remove('has-image'); $('.drop-content', card).hidden = false; $('.preview-wrap', card).hidden = true;
  $('#report').innerHTML = emptyReport();
}
function clearAll() { removeSlot('A'); removeSlot('B'); lastResult = null; toast('Đã xóa ảnh.'); }
function emptyReport() { return `<div class="empty-state"><div class="empty-orb">${icons.chart}</div><strong>Ảnh đã sẵn sàng</strong><p>Nhấn “${mode === 'compare' ? 'So sánh ảnh' : 'Phân tích ảnh'}” để xem kết quả.</p></div>`; }

async function downsizeBlob(blob, maxSide = 1024, mime = 'image/jpeg', quality = .9) {
  const img = new Image(); const tempUrl = URL.createObjectURL(blob); img.src = tempUrl;
  try { await decodeImage(img); } finally { URL.revokeObjectURL(tempUrl); }
  if (!img.naturalWidth || !img.naturalHeight) throw new Error('Ảnh không có kích thước hợp lệ.');
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const result = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
  if (!result) throw new Error('Không thể thu nhỏ ảnh trên thiết bị này.');
  return result;
}
async function analyzeLocal(slot) {
  const resized = await downsizeBlob(slot.file);
  if (worker && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(resized);
      const id = `${slot.id}-${Date.now()}-${Math.random()}`;
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Phân tích nền quá thời gian.')); }, 15000);
        pending.set(id, { resolve, reject, timer });
        try { worker.postMessage({ id, bitmap, fileSize: slot.originalFile.size }, [bitmap]); }
        catch (error) { clearTimeout(timer); pending.delete(id); bitmap.close?.(); reject(error); }
      });
    } catch (error) { console.warn('Falling back to main-thread analysis:', error); }
  }
  const img = new Image(), url = URL.createObjectURL(resized); img.src = url;
  try {
    await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    ctx.drawImage(img, 0, 0);
    return analyzePixels({ data: ctx.getImageData(0,0,canvas.width,canvas.height).data, width: canvas.width, height: canvas.height, fileSize: slot.originalFile.size });
  } finally { URL.revokeObjectURL(url); }
}

function validateAiAnalysis(value) {
  const text = item => typeof item === 'string' && item.trim().length > 0 && item.length <= 1200;
  const exact = (item, keys) => Boolean(item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key)));
  const score = item => exact(item, ['nhan_xet', 'diem']) && Number.isInteger(item.diem) && item.diem >= 0 && item.diem <= 100 && text(item.nhan_xet);
  const keys = ['the_loai','chu_the','dac_diem','bo_cuc','anh_sang','mau_sac','ky_thuat','cam_xuc_sang_tao','diem_manh','diem_yeu','goi_y_khi_chup','goi_y_chinh_sua'];
  return Boolean(exact(value, keys) && text(value.the_loai) && text(value.chu_the) &&
    Array.isArray(value.dac_diem) && value.dac_diem.every(text) &&
    ['bo_cuc','anh_sang','mau_sac','ky_thuat','cam_xuc_sang_tao'].every(key => score(value[key])) &&
    ['diem_manh','diem_yeu','goi_y_khi_chup','goi_y_chinh_sua'].every(key => Array.isArray(value[key]) && value[key].every(text)));
}
async function sha256Blob(blob) {
  const bytes = await blob.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of new Uint8Array(bytes)) hash = Math.imul(hash ^ byte, 16777619);
  return `fnv-${(hash >>> 0).toString(16)}`;
}
const aiCacheMemory = new Map();
function readAiCache(hash) {
  const now = Date.now();
  try {
    const cached = JSON.parse(localStorage.getItem(`photolens_ai_${hash}`) || 'null');
    if (cached?.expires > now && cached?.analysis) { aiCacheMemory.set(hash, cached.analysis); return cached.analysis; }
    localStorage.removeItem(`photolens_ai_${hash}`);
  } catch { /* Storage may be disabled or full; the in-memory cache still works. */ }
  return aiCacheMemory.get(hash) || null;
}
function writeAiCache(hash, analysis) {
  const entry = { expires: Date.now() + 14 * 24 * 60 * 60 * 1000, analysis };
  aiCacheMemory.set(hash, analysis);
  try { localStorage.setItem(`photolens_ai_${hash}`, JSON.stringify(entry)); } catch { /* Continue without persistent cache. */ }
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('photolens_ai_'));
    if (keys.length > 50) keys.slice(0, keys.length - 50).forEach(key => localStorage.removeItem(key));
  } catch { /* localStorage can be unavailable in private browsing. */ }
}
function blobToBase64(blob) { return new Promise((resolve,reject) => { const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(',')[1]); r.onerror=reject; r.readAsDataURL(blob); }); }
const MAX_AI_IMAGE_BASE64_BYTES = 1_500_000;
async function prepareAiJpeg(slot) {
  const attempts = [
    [1024, .85], [1024, .75], [896, .72], [768, .70], [640, .65], [512, .60]
  ];
  for (const [side, quality] of attempts) {
    const blob = await downsizeBlob(slot.file, side, 'image/jpeg', quality);
    const data = await blobToBase64(blob);
    if (data.length <= MAX_AI_IMAGE_BASE64_BYTES) return { blob, data };
  }
  throw new Error('Không thể nén ảnh xuống giới hạn 1,5 MB. Hãy chọn ảnh nhỏ hơn.');
}
function validAiComparison(value) {
  const text = item => typeof item === 'string' && item.trim().length > 0 && item.length <= 1200;
  const exact = (item, keys) => Boolean(item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key)));
  const dimensions = ['bo_cuc', 'anh_sang', 'mau_sac', 'ky_thuat', 'cam_xuc_sang_tao'];
  if (!exact(value, ['criteria', 'best_for', 'conclusion', 'weaker_image_tips']) || !text(value.conclusion)) return false;
  if (!Array.isArray(value.weaker_image_tips) || !value.weaker_image_tips.every(text)) return false;
  if (!exact(value.criteria, dimensions) || !exact(value.best_for, ['social', 'print', 'portfolio'])) return false;
  if (!dimensions.every(key => exact(value.criteria[key], ['winner', 'reason']) && ['A', 'B', 'tie'].includes(value.criteria[key].winner) && text(value.criteria[key].reason))) return false;
  return ['social', 'print', 'portfolio'].every(key => exact(value.best_for[key], ['image', 'reason']) && ['A', 'B'].includes(value.best_for[key].image) && text(value.best_for[key].reason));
}
async function runAnalysis() {
  const targetIds = mode === 'compare' ? ['A', 'B'] : ['A'];
  if (targetIds.some(id => !slots[id])) { toast(mode === 'compare' ? 'Hãy tải đủ ảnh A và ảnh B.' : 'Hãy chọn một ảnh trước.'); return; }
  const runId = ++analysisRun;
  const btn = $('#analyzeBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span>Đang đo ảnh...</span>`;
  $('#report').innerHTML = `<div class="empty-state" aria-busy="true"><div class="loading" style="justify-content:center"><span class="spinner"></span><strong>Đang phân tích cục bộ...</strong></div><p>Đang đo histogram, màu sắc, độ nét và vùng sáng/tối.</p><div class="skeleton-grid" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
  try {
    const local = {};
    for (const id of targetIds) {
      local[id] = await analyzeLocal(slots[id]);
      if (runId !== analysisRun) return;
    }

    let ai = {};
    let aiComparison = null;
    let aiState = 'disabled';
    let aiError = '';
    if (await loadAiEnabled()) {
      const endpoint = await getAiEndpoint();
      aiState = endpoint ? 'error' : 'unconfigured';
      if (endpoint) {
        try {
          const prepared = {};
          const cacheKeys = {};
          for (const id of targetIds) {
            prepared[id] = await prepareAiJpeg(slots[id]);
            cacheKeys[id] = await sha256Blob(prepared[id].blob);
          }

          if (targetIds.length === 1) {
            const cached = readAiCache(cacheKeys.A);
            if (cached && validateAiAnalysis(cached)) ai.A = cached;
          }

          if (targetIds.some(id => !ai[id]) || targetIds.length === 2) {
            const controller = new AbortController();
            activeAiController = controller;
            const timeout = setTimeout(() => controller.abort(new DOMException('Hết thời gian chờ Worker.', 'TimeoutError')), 35_000);
            try {
              const response = await fetch(`${endpoint.replace(/\/+$/, '')}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: targetIds.length === 2 ? 'compare' : 'single', images: targetIds.map(id => prepared[id].data) }),
                signal: controller.signal
              });
              const data = await response.json().catch(() => null);
              if (!response.ok) throw new Error(readableErrorMessage(data?.error, `Worker phản hồi HTTP ${response.status}.`));
              if (targetIds.length === 1) {
                if (!validateAiAnalysis(data?.analysis)) throw new Error('Worker trả kết quả sai cấu trúc phân tích ảnh.');
                ai.A = data.analysis;
                writeAiCache(cacheKeys.A, data.analysis);
              } else {
                if (!data?.analyses || !validateAiAnalysis(data.analyses.A) || !validateAiAnalysis(data.analyses.B) || !validAiComparison(data.comparison)) {
                  throw new Error('Worker trả kết quả so sánh sai cấu trúc. Hãy kiểm tra lại phiên bản Worker.');
                }
                ai = { A: data.analyses.A, B: data.analyses.B };
                aiComparison = data.comparison;
                writeAiCache(cacheKeys.A, ai.A);
                writeAiCache(cacheKeys.B, ai.B);
              }
            } finally {
              clearTimeout(timeout);
              if (activeAiController === controller) activeAiController = null;
            }
          }
          if (targetIds.some(id => !ai[id])) throw new Error('Worker chưa trả đủ nhận xét cho ảnh.');
          aiState = 'ready';
        } catch (error) {
          aiState = 'error';
          if (error?.name === 'TimeoutError' || activeAiController?.signal?.reason?.name === 'TimeoutError') {
            aiError = 'Kết nối AI quá thời gian chờ. Chỉ số cục bộ vẫn được giữ.';
          } else if (error?.name === 'AbortError') {
            aiError = 'Yêu cầu AI đã bị hủy hoặc quá thời gian chờ. Chỉ số cục bộ vẫn được giữ.';
          } else if (error instanceof TypeError) {
            aiError = 'Không kết nối được Worker. Hãy kiểm tra mạng, URL và cấu hình CORS.';
          } else {
            aiError = readableErrorMessage(error);
          }
        }
      }
    }

    if (runId !== analysisRun) return;
    lastResult = {
      mode, local, ai, aiComparison, aiState, aiError,
      names: Object.fromEntries(targetIds.map(id => [id, slots[id].file.name])),
      timestamp: new Date().toISOString(),
      exif: Object.fromEntries(targetIds.map(id => [id, slots[id].exif]))
    };
    renderReport(lastResult);
    await saveHistory(lastResult);
    $$('.overlay-canvas').forEach(canvas => canvas.hidden = !showOverlay);
    $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (runId !== analysisRun) return;
    console.error(error);
    $('#report').innerHTML = `<div class="notice error">Không phân tích được ảnh: ${escapeHtml(readableErrorMessage(error, 'Lỗi không xác định'))}.</div>${emptyReport()}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icons.sparkle}<span>${mode === 'compare' ? 'So sánh ảnh' : 'Phân tích ảnh'}</span>`;
  }
}
function renderReport(result) {
  const a = result.local.A, b = result.local.B;
  const categories = ['Bố cục', 'Ánh sáng', 'Màu sắc', 'Kỹ thuật', 'Cảm xúc'];
  const scoresA = result.ai.A ? ['bo_cuc','anh_sang','mau_sac','ky_thuat','cam_xuc_sang_tao'].map(key => result.ai.A[key]?.diem ?? 0) : a.localScores;
  const scoresB = b ? (result.ai.B ? ['bo_cuc','anh_sang','mau_sac','ky_thuat','cam_xuc_sang_tao'].map(key => result.ai.B[key]?.diem ?? 0) : b.localScores) : null;
  const totalA = result.ai.A ? Math.round(scoresA.reduce((sum, value) => sum + value, 0) / scoresA.length) : a.technicalScore;
  const totalB = b ? (result.ai.B ? Math.round(scoresB.reduce((sum, value) => sum + value, 0) / scoresB.length) : b.technicalScore) : null;
  const scoreTitle = result.ai.A ? 'Điểm tổng AI' : 'Điểm kỹ thuật cục bộ';
  const scoreLabelsA = result.ai.A ? categories : scoreLabels;
  const noticeInfo = {
    ready: { title: 'AI đã sẵn sàng', message: 'Nhận xét được tạo qua Worker. Ảnh gửi đi là JPEG đã thu nhỏ; ảnh gốc không được gửi.', icon: icons.sparkle, className: 'success' },
    disabled: { title: 'AI đang tắt', message: 'Các chỉ số kỹ thuật cục bộ vẫn hiển thị. Bạn có thể bật AI trong Cài đặt.', icon: icons.lock, className: '' },
    error: { title: 'AI chưa khả dụng', message: `${result.aiError || 'Không kết nối được Worker.'} Báo cáo cục bộ vẫn đầy đủ.`, icon: icons.lock, className: 'error' },
    unconfigured: { title: 'AI chưa cấu hình', message: 'Chỉ số kỹ thuật vẫn chạy ngoại tuyến; ảnh chưa được gửi đi đâu.', icon: icons.lock, className: '' }
  }[result.aiState] || { title: 'AI chưa khả dụng', message: 'Báo cáo cục bộ vẫn đầy đủ.', icon: icons.lock, className: 'error' };
  const notice = `<div class="notice ${noticeInfo.className}" role="status"><span class="notice-icon">${noticeInfo.icon}</span><span class="notice-copy"><strong class="notice-title">${noticeInfo.title}</strong><span>${escapeHtml(noticeInfo.message)}</span></span>${result.aiState === 'ready' ? '' : '<button class="soft-btn configure-ai-button" type="button" aria-label="Mở Cài đặt AI">Cấu hình AI</button>'}</div>`;
  const scorePanel = `<section class="panel score-panel"><div class="panel-head"><div><div class="panel-title">${scoreTitle}</div><div class="panel-kicker">${result.ai.A ? 'Trung bình năm tiêu chí AI' : 'Thước đo kỹ thuật tham khảo'}</div></div><span class="ai-pill">${result.ai.A ? 'AI' : 'CỤC BỘ'}</span></div><div class="score-wrap"><div class="score-bubble" style="--score:${totalA}" role="img" aria-label="Điểm tổng ${totalA} trên 100"><div><div class="score-value">${totalA}</div><div class="score-denom">/ 100</div><div class="score-label">Tổng quan</div></div></div><div class="score-bars" aria-label="Điểm theo từng tiêu chí">${scoreLabelsA.map((label,index)=>`<div class="score-line"><span>${label}</span><div class="bar" role="img" aria-label="${label}: ${scoresA[index]} trên 100"><i style="width:${scoresA[index]}%"></i></div><b>${scoresA[index]}</b></div>`).join('')}</div></div></section>`;
  const radarPanel = b
    ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">So sánh theo tiêu chí</div><div class="panel-kicker">${result.ai.A && result.ai.B ? 'Điểm AI trên thang 100' : 'Điểm proxy từ chỉ số kỹ thuật'}</div></div></div><canvas class="chart" id="radar" role="img" aria-label="Biểu đồ radar so sánh năm tiêu chí của ảnh A và ảnh B"></canvas><div class="legend"><span><i class="dot"></i>Ảnh A</span><span><i class="dot b"></i>Ảnh B</span></div></section>`
    : `<section class="panel"><div class="panel-head"><div><div class="panel-title">Điểm theo tiêu chí</div><div class="panel-kicker">Năm khía cạnh, cùng thang điểm 100</div></div></div><canvas class="chart" id="radarSingle" role="img" aria-label="Biểu đồ radar điểm năm tiêu chí ảnh"></canvas><div class="legend"><span><i class="dot"></i>${result.ai.A ? 'Điểm AI' : 'Điểm cục bộ'}</span></div></section>`;
  const details = `<details class="detail-disclosure"><summary><span class="detail-summary-main"><strong>Chi tiết kỹ thuật</strong><span>Thông số, biểu đồ histogram, EXIF và bảng màu</span></span><span class="detail-summary-icon">${icons.chart}</span></summary><div class="detail-content"><div class="detail-grid">
    <section class="panel detail-half"><div class="panel-head"><div><div class="panel-title">Thông số ${b ? 'ảnh A' : 'ảnh'}</div><div class="panel-kicker">Đo trên ảnh đã chuẩn hóa bằng Canvas 2D</div></div></div>${metricTiles(a)}</section>
    ${b ? `<section class="panel detail-half"><div class="panel-head"><div><div class="panel-title">Thông số ảnh B</div><div class="panel-kicker">Đo trên ảnh đã chuẩn hóa bằng Canvas 2D</div></div></div>${metricTiles(b)}</section>` : `<section class="panel detail-half"><div class="panel-head"><div><div class="panel-title">EXIF & thiết bị</div><div class="panel-kicker">Metadata có sẵn trong tệp ảnh</div></div></div>${exifBlock(result.exif.A)}</section>`}
    ${b ? `<section class="panel detail-half"><div class="panel-head"><div><div class="panel-title">EXIF ảnh A</div><div class="panel-kicker">Thông tin có sẵn trong tệp</div></div></div>${exifBlock(result.exif.A)}</section><section class="panel detail-half"><div class="panel-head"><div><div class="panel-title">EXIF ảnh B</div><div class="panel-kicker">Thông tin có sẵn trong tệp</div></div></div>${exifBlock(result.exif.B)}</section>` : ''}
    <section class="panel detail-full"><div class="panel-head"><div><div class="panel-title">Bảng màu chủ đạo</div><div class="panel-kicker">K-means · 5 cụm màu${b ? ' cho mỗi ảnh' : ''}</div></div></div>${b ? `<div class="palette-group"><div class="panel-kicker">Ảnh A</div>${paletteHTML(a.palette)}<div class="palette-subgroup"><div class="panel-kicker">Ảnh B</div>${paletteHTML(b.palette)}</div></div>` : paletteHTML(a.palette)}<p class="comparison-note">Nhiệt độ màu ước lượng: <strong>${a.colorTemperature}</strong>${b ? ` / <strong>${b.colorTemperature}</strong>` : ''}</p></section>
    <section class="panel detail-full"><div class="panel-head"><div><div class="panel-title">Histogram ${b ? 'ảnh A và B' : 'RGB & luma'}</div><div class="panel-kicker">${b ? 'A nét liền · B nét đứt; kênh luma dùng màu riêng cho từng ảnh' : 'Phân bố độ sáng và các kênh màu'}</div></div></div><canvas class="histogram" id="histogram" role="img" aria-label="Histogram ${b ? 'đối chiếu ảnh A và ảnh B' : 'RGB và độ sáng luma'}"></canvas><div class="legend histogram-legend">${b ? '<span><i class="dot"></i>Ảnh A · nét liền</span><span><i class="dot b"></i>Ảnh B · nét đứt</span><span><i class="dot channel-r"></i>R</span><span><i class="dot channel-g"></i>G</span><span><i class="dot channel-blue"></i>B</span>' : '<span><i class="dot channel-r"></i>R</span><span><i class="dot channel-g"></i>G</span><span><i class="dot channel-blue"></i>B</span><span><i class="dot channel-luma"></i>Luma</span>'}</div></section>
    </div></div></details>`;
  $('#report').innerHTML = `${notice}<div class="report-head"><div><h2>${b ? 'So sánh ảnh A và B' : 'Báo cáo phân tích'}</h2><div class="sub">${escapeHtml(result.names.A)}${b ? ` · ${escapeHtml(result.names.B)}` : ''} · ${new Date(result.timestamp).toLocaleString('vi-VN')}</div></div><div class="report-tools"><button class="ghost-btn" data-export="png" aria-label="Xuất báo cáo PNG">${icons.export}<span>PNG</span></button><button class="ghost-btn" data-export="pdf" aria-label="Xuất báo cáo PDF">${icons.export}<span>PDF</span></button><button class="ghost-btn" data-export="json" aria-label="Xuất báo cáo JSON">${icons.export}<span>JSON</span></button></div></div>
    ${b ? comparisonOverview(result,totalA,totalB) : `<div class="stats-grid">${scorePanel}${radarPanel}</div>`}
    ${b ? `<div class="stats-grid comparison-stats-grid">${radarPanel}</div>` : ''}
    ${b ? comparisonSection(result,totalA,totalB) : ''}
    ${details}
    ${aiSection(result.ai.A, b ? 'Nhận xét AI — ảnh A' : 'Nhận xét từ AI')}
    ${b ? aiSection(result.ai.B, 'Nhận xét AI — ảnh B') : ''}
    ${result.aiComparison ? `<section class="ai-comparison-detail">${aiComparisonHTML(result.aiComparison,result.ai)}</section>` : ''}
    ${b ? recommendationSection(result,totalA,totalB) : ''}`;
  if (result.aiState !== 'ready') $('.configure-ai-button', $('#report'))?.addEventListener('click', showSettings);
  bindReportActions();
  const histogram = $('#histogram');
  $('#report .detail-disclosure')?.addEventListener('toggle', event => {
    if (event.currentTarget.open) requestAnimationFrame(() => drawHistogram(a.histogram,b?.histogram));
  });
  requestAnimationFrame(() => {
    const labels = result.ai.A && (!b || result.ai.B) ? categories : scoreLabels;
    if (b) drawRadar(scoresA,scoresB,labels,'radar');
    else drawRadar(scoresA,null,labels,'radarSingle');
    if (histogram && $('#report .detail-disclosure')?.open) drawHistogram(a.histogram,b?.histogram);
  });
}
function resultImage(result,id) {
  const slot = slots[id];
  if (slot && slot.file.name === result.names?.[id]) return slot.url;
  return result.thumbnails?.[id] || '';
}
function comparisonOverview(result, totalA, totalB) {
  const leader = totalA === totalB ? null : totalA > totalB ? 'A' : 'B';
  const cards = [['A', totalA, result.local.A], ['B', totalB, result.local.B]].map(([id, total, metrics]) => {
    const name = result.names[id] || `Ảnh ${id}`;
    const src = resultImage(result, id);
    const badge = leader === id ? 'Điểm cao hơn' : leader ? 'Đối chiếu' : 'Đồng điểm';
    return `<article class="compare-card ${leader === id ? 'is-leading' : ''}" aria-label="Ảnh ${id}, điểm tổng ${total} trên 100">
      <div class="compare-photo">${src ? `<img src="${escapeAttr(src)}" alt="Xem trước ảnh ${id}: ${escapeHtml(name)}">` : `<div class="compare-photo-empty">${icons.photo}<span>Ảnh ${id}</span></div>`}<span class="compare-photo-label slot-${id.toLowerCase()}">Ảnh ${id}</span></div>
      <div class="compare-card-content">
        <div class="compare-card-heading"><span class="compare-file-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><span class="compare-badge">${badge}</span></div>
        <div class="compare-total"><strong>${total}</strong><span>/100 · ${result.ai[id] ? 'điểm AI' : 'điểm kỹ thuật'}</span></div>
        <div class="compare-metrics">
          <div><span>Độ nét</span><strong>${metrics.sharpness}</strong></div>
          <div><span>Độ sáng</span><strong>${metrics.meanBrightness}/255</strong></div>
          <div><span>Độ phân giải</span><strong>${metrics.width} × ${metrics.height}</strong></div>
        </div>
      </div>
    </article>`;
  }).join('');
  const difference = Math.abs(totalA - totalB);
  const summary = leader
    ? `Ảnh ${leader} đang nhỉnh hơn ${difference} điểm`
    : `Hai ảnh hòa điểm tổng hợp · ${totalA}/100`;
  return `<section class="comparison-overview" aria-labelledby="comparison-overview-title"><div class="comparison-overview-heading"><div><h3 id="comparison-overview-title">Đặt hai ảnh cạnh nhau</h3><p>${summary}</p></div></div><div class="comparison-cards">${cards}</div></section>`;
}

function aiComparisonHTML(comparison, analyses) {
  const dimensions = [
    ['Bố cục', 'bo_cuc'], ['Ánh sáng', 'anh_sang'], ['Màu sắc', 'mau_sac'],
    ['Kỹ thuật', 'ky_thuat'], ['Cảm xúc / sáng tạo', 'cam_xuc_sang_tao']
  ];
  const criteria = dimensions.map(([label, key]) => {
    const entry = comparison.criteria[key];
    const difference = (analyses.A[key].diem || 0) - (analyses.B[key].diem || 0);
    const signed = `${difference > 0 ? '+' : ''}${difference}`;
    const winner = entry.winner === 'tie' ? 'Hai ảnh ngang nhau' : `Ảnh ${entry.winner} nhỉnh hơn`;
    return `<li><strong>${label}:</strong> ${winner}, chênh lệch điểm AI A − B là ${signed} điểm. ${escapeHtml(entry.reason)}</li>`;
  }).join('');
  const uses = [
    ['Mạng xã hội', 'social'], ['In ấn', 'print'], ['Portfolio', 'portfolio']
  ].map(([label, key]) => {
    const item = comparison.best_for[key];
    return `<li><strong>${label}:</strong> nên chọn ảnh ${item.image} — ${escapeHtml(item.reason)}</li>`;
  }).join('');
  const tips = comparison.weaker_image_tips.map(escapeHtml);
  return `<h3 class="section-heading">So sánh chuyên sâu từ AI</h3><div class="list-card"><ul class="bullet-list">${criteria}<li><strong>Kết luận:</strong> ${escapeHtml(comparison.conclusion)}</li></ul></div><div class="list-card"><ul class="bullet-list tip">${uses}${tips.length ? `<li><strong>Gợi ý cải thiện ảnh yếu hơn:</strong></li>${tips.map(tip => `<li>${tip}</li>`).join('')}` : ''}</ul></div>`;
}
function metricTiles(m) {
  const values = [
    ['Kích thước',`${m.width} × ${m.height}`,'pixel'], ['Tỉ lệ',`${m.aspectRatio.toFixed(2)}:1`,'khung hình'], ['Dung lượng',formatBytes(m.fileSize),'tệp gốc'], ['Độ sáng',`${m.meanBrightness}/255`,'trung bình'], ['Độ tương phản',`${m.contrast}`,'độ lệch chuẩn'], ['Bão hòa',`${m.saturation}%`,'mức trung bình'], ['Độ nét',`${m.sharpness}`,'phương sai Laplacian'], ['Nhiễu',`${m.noiseEstimate.level}`,'ước lượng'], ['Cháy sáng',`${m.highlightsClipped}%`,'vùng gần trắng'], ['Mất chi tiết tối',`${m.shadowsCrushed}%`,'vùng gần đen']
  ];
  return `<div class="metric-tiles">${values.map(([label,value,hint])=>`<div class="metric-tile"><div class="label">${label}</div><div class="value">${value}</div><div class="hint">${hint}</div></div>`).join('')}</div>`;
}
function paletteHTML(colors) { return `<div class="palette">${colors.map(c=>`<div class="swatch"><div class="swatch-color" style="background:${c.hex}"></div><div class="swatch-meta"><strong>${c.hex}</strong><span>${c.percent}%</span></div></div>`).join('')}</div>`; }
function exifBlock(info) {
  if (!info || !Object.values(info).some(Boolean)) return `<div class="comparison-note">Ảnh không có EXIF hoặc thông tin đã bị xóa.</div>`;
  const rows = [['Máy ảnh',[info.make,info.model].filter(Boolean).join(' ')],['Ống kính',info.lens],['ISO',info.iso],['Khẩu độ',info.aperture ? `f/${info.aperture}` : null],['Tốc độ',info.exposure ? (info.exposure >= 1 ? `${info.exposure} giây` : `1/${Math.round(1/info.exposure)} giây`) : null],['Tiêu cự',info.focalLength ? `${info.focalLength} mm` : null],['Ngày chụp',info.date ? new Date(info.date).toLocaleString('vi-VN') : null]].filter(x=>x[1]);
  return `<div class="metric-tiles">${rows.map(([a,b])=>`<div class="metric-tile"><div class="label">${a}</div><div class="value">${escapeHtml(String(b))}</div></div>`).join('')}</div>`;
}
function aiSection(ai, title = 'Nhận xét AI') {
  if (!ai) return '';
  const categories = [['Bố cục','bo_cuc'],['Ánh sáng','anh_sang'],['Màu sắc','mau_sac'],['Kỹ thuật','ky_thuat'],['Cảm xúc & sáng tạo','cam_xuc_sang_tao']];
  const sectionList = (label,key,cls='') => ai[key]?.length ? `<div class="section-heading">${label}<span class="count">${ai[key].length}</span></div><div class="list-card"><ul class="bullet-list ${cls}">${ai[key].map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : '';
  return `<h3 class="section-heading">${title}</h3><div class="review-grid">${categories.map(([label,key])=>ai[key] && typeof ai[key] === 'object' ? `<article class="review-card"><h3><i class="mark"></i>${label}<span style="margin-left:auto;color:var(--mint)">${ai[key].diem ?? '—'}</span></h3><p>${escapeHtml(ai[key].nhan_xet || '')}</p></article>` : '').join('')}${ai.the_loai || ai.chu_the ? `<article class="review-card"><h3><i class="mark"></i>Nhận diện</h3><p><strong>${escapeHtml(ai.the_loai || '')}</strong>${ai.chu_the ? ` · ${escapeHtml(ai.chu_the)}` : ''}</p>${ai.dac_diem?.length ? `<p style="margin-top:6px">${ai.dac_diem.map(escapeHtml).join(' · ')}</p>` : ''}</article>` : ''}</div>${sectionList('Điểm mạnh','diem_manh')}${sectionList('Điểm cần cải thiện','diem_yeu','weak')}${sectionList('Gợi ý khi chụp','goi_y_khi_chup','tip')}${sectionList('Gợi ý chỉnh sửa','goi_y_chinh_sua','tip')}`;
}
function comparisonSection(result, scoreA, scoreB) {
  const rows = metricRows(result.local.A, result.local.B);
  const winCountA = rows.filter(item => item.winner === 'A').length;
  const winCountB = rows.filter(item => item.winner === 'B').length;
  const stronger = Math.abs(scoreA - scoreB) < 1 ? null : scoreA > scoreB ? 'A' : 'B';
  const scoreDetails = result.ai.A && result.ai.B
    ? [['Bố cục', result.ai.A.bo_cuc.diem, result.ai.B.bo_cuc.diem], ['Ánh sáng', result.ai.A.anh_sang.diem, result.ai.B.anh_sang.diem], ['Màu sắc', result.ai.A.mau_sac.diem, result.ai.B.mau_sac.diem], ['Kỹ thuật', result.ai.A.ky_thuat.diem, result.ai.B.ky_thuat.diem], ['Cảm xúc & sáng tạo', result.ai.A.cam_xuc_sang_tao.diem, result.ai.B.cam_xuc_sang_tao.diem]]
    : scoreLabels.map((label, index) => [label, result.local.A.localScores[index], result.local.B.localScores[index]]);
  const topReasons = stronger
    ? scoreDetails
        .filter(([, aScore, bScore]) => (stronger === 'A' ? aScore - bScore : bScore - aScore) > 0)
        .sort((a, b) => Math.abs(b[1] - b[2]) - Math.abs(a[1] - a[2]))
        .slice(0, 3)
        .map(([label, aScore, bScore]) => `${label} hơn ${Math.abs(aScore - bScore)} điểm`)
        .join(', ')
    : '';
  const overall = stronger
    ? `Ảnh ${stronger} cao hơn ${Math.abs(scoreA - scoreB)} điểm (${Math.max(scoreA, scoreB)}/100 so với ${Math.min(scoreA, scoreB)}/100). Ưu thế rõ nhất: ${topReasons || 'điểm tổng hợp từ các tiêu chí'}.`
    : `Hai ảnh hòa điểm tổng hợp (${scoreA}/100).`;
  const socialWinner = result.local.A.saturation >= result.local.B.saturation ? 'A' : 'B';
  const printWinner = result.local.A.width * result.local.A.height >= result.local.B.width * result.local.B.height ? 'A' : 'B';
  return `<section class="comparison-report" aria-labelledby="comparison-title">
    <div class="comparison-overview-heading">
      <div><h3 id="comparison-title">Kết luận so sánh</h3><p>${result.ai.A && result.ai.B ? 'Điểm tổng từ nhận xét AI' : 'Điểm tổng kỹ thuật cục bộ'} · A hơn ${winCountA} chỉ số, B hơn ${winCountB} chỉ số.</p></div>
      <span class="compare-badge">${stronger ? `Ảnh ${stronger} dẫn ${Math.abs(scoreA - scoreB)} điểm` : 'Hai ảnh đồng điểm'}</span>
    </div>
    <div class="compare-conclusion panel">
      <p class="comparison-overall">${overall}</p>
      <div class="purpose-grid">
        <article><strong>Mạng xã hội</strong><p>Ảnh ${socialWinner} có độ bão hòa cao hơn; phù hợp hơn nếu mục tiêu là màu sắc nổi bật. Hãy cân nhắc chủ thể và cảm xúc trước khi chọn.</p></article>
        <article><strong>In ấn</strong><p>Ảnh ${printWinner} có độ phân giải lớn hơn (${result.local[printWinner].width} × ${result.local[printWinner].height}); kiểm tra thêm vùng cháy sáng và mất chi tiết tối trước khi in.</p></article>
        <article><strong>Portfolio</strong><p>${result.aiComparison?.best_for?.portfolio ? `AI đề xuất ảnh ${result.aiComparison.best_for.portfolio.image}: ${escapeHtml(result.aiComparison.best_for.portfolio.reason)}` : 'Chọn ảnh có bố cục và ý đồ hình ảnh rõ hơn; chỉ số kỹ thuật cục bộ không thể tự đánh giá ý đồ sáng tạo.'}</p></article>
      </div>
    </div>
    <details class="detail-disclosure comparison-details">
      <summary><span class="detail-summary-main"><strong>Đối chiếu ${rows.length} chỉ số kỹ thuật</strong><span>A hơn ${winCountA} · B hơn ${winCountB} · Chênh lệch tính theo A − B</span></span><span class="detail-summary-icon">${icons.chart}</span></summary>
      <div class="detail-content"><div class="table-wrap"><table class="metric-table"><thead><tr><th>Chỉ số</th><th>Ảnh A</th><th>Ảnh B</th><th>Chênh lệch (A − B)</th><th>Ưu thế</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.label}</td><td>${row.a}</td><td>${row.b}</td><td>${row.diff}</td><td><span class="winner-badge ${row.winner === 'A' ? 'winner' : row.winner === 'B' ? 'loser' : ''}">${row.winner === 'tie' ? 'Tương đương' : row.winner === '-' ? '—' : `Ảnh ${row.winner}`}</span></td></tr>`).join('')}</tbody></table></div></div>
    </details>
  </section>`;
}
function recommendationSection(result, scoreA, scoreB) {
  if (Math.abs(scoreA - scoreB) < 1) return `<div class="section-heading">Gợi ý tiếp theo</div><div class="list-card"><ul class="bullet-list tip"><li>Điểm tổng hai ảnh đang hòa (${scoreA}/100). Xem các dòng có ưu thế trong bảng để chọn theo mục đích; nếu chúng cũng bằng nhau, khác biệt nằm ở bố cục hoặc cảm xúc chứ không ở chỉ số đo được.</li></ul></div>`;
  const weak = scoreA < scoreB ? 'A' : 'B', strong = weak === 'A' ? 'B' : 'A';
  const w = result.local[weak], s = result.local[strong];
  const tips = [];
  if (w.sharpness < s.sharpness) tips.push('Tăng tốc độ màn trập hoặc giữ máy chắc hơn để tăng độ nét.');
  if (w.meanBrightness < s.meanBrightness - 12) tips.push('Tăng bù sáng nhẹ hoặc bổ sung ánh sáng vào chủ thể.');
  if (w.highlightsClipped > s.highlightsClipped + 2) tips.push('Giảm phơi sáng và ưu tiên giữ chi tiết vùng sáng.');
  if (w.shadowsCrushed > s.shadowsCrushed + 2) tips.push('Nâng vùng tối có kiểm soát hoặc dùng hắt sáng để giữ chi tiết.');
  if (w.saturation < s.saturation - 10) tips.push('Tăng vibrance vừa phải khi chỉnh sửa, tránh kéo saturation quá tay.');
  if (!tips.length) tips.push('Hai ảnh khá gần nhau về kỹ thuật; hãy thử căn lại bố cục, ánh sáng chủ thể và thời điểm chụp để tạo khác biệt rõ hơn.');
  return `<div class="section-heading">Để ảnh ${weak} tiến gần ưu điểm ảnh ${strong}</div><div class="list-card"><ul class="bullet-list tip">${tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`;
}

function drawHistogram(a, b) {
  const canvas = $('#histogram');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  const css = getComputedStyle(document.documentElement);
  const token = name => css.getPropertyValue(name).trim();
  const channels = [
    ['r', token('--color-chart-r')],
    ['g', token('--color-chart-g')],
    ['b', token('--color-chart-blue')],
    ['y', token('--color-chart-luma')]
  ];
  const draw = (histogram, color, dash = [], alpha = 1) => {
    if (!histogram?.length) return;
    const max = Math.max(...histogram);
    if (!max) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    histogram.forEach((value, index) => {
      const x = index / (histogram.length - 1) * w;
      const y = h - (value / max) * (h - 8) - 4;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  ctx.strokeStyle = token('--color-chart-grid');
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * i / 4);
    ctx.lineTo(w, h * i / 4);
    ctx.stroke();
  }
  channels.forEach(([key, channelColor]) => {
    if (key === 'y' && b) {
      draw(a[key], token('--color-chart-a'));
      draw(b[key], token('--color-chart-b'), [6, 4]);
    } else {
      draw(a[key], channelColor, [], b ? 1 : .9);
      if (b) draw(b[key], channelColor, [6, 4], .72);
    }
  });
}
function drawRadar(valuesA, valuesB, labels, id = 'radar') {
  const canvas = $(`#${id}`);
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  const cx = w / 2;
  const cy = h / 2 + 4;
  const r = Math.min(w, h) * .3;
  const css = getComputedStyle(document.documentElement);
  const token = name => css.getPropertyValue(name).trim();
  const grid = token('--color-chart-grid');
  const text = token('--color-text-secondary');
  const colorA = token('--color-chart-a');
  const colorB = token('--color-chart-b');
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / 5;
      const radius = r * ring / 4;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = grid;
    ctx.stroke();
    ctx.font = `14px ${token('--font-sans', 'sans-serif')}`;
    ctx.fillStyle = text;
    ctx.textAlign = Math.cos(angle) > .25 ? 'left' : Math.cos(angle) < -.25 ? 'right' : 'center';
    ctx.textBaseline = Math.sin(angle) > .45 ? 'top' : Math.sin(angle) < -.45 ? 'bottom' : 'middle';
    ctx.fillText(labels[i], cx + Math.cos(angle) * (r + 12), cy + Math.sin(angle) * (r + 12), 88);
  }
  const polygon = (values, color, dash = []) => {
    ctx.beginPath();
    values.forEach((value, index) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / 5;
      const radius = r * Math.max(0, Math.min(100, value)) / 100;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = .14;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    values.forEach((value, index) => {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / 5;
      const radius = r * Math.max(0, Math.min(100, value)) / 100;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  };
  polygon(valuesA, colorA);
  if (valuesB) polygon(valuesB, colorB, [6, 4]);
}

function drawOverlay(id) {
  const slot = slots[id], card = $(`#card${id}`), canvas = $('.overlay-canvas', card);
  if (!canvas || !slot || !showOverlay || $('.preview-wrap',card).hidden) { if (canvas) canvas.hidden = true; return; }
  canvas.hidden = false;
  const wrap = $('.preview-wrap',card), rect = wrap.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1,Math.round(rect.width*dpr)); canvas.height = Math.max(1,Math.round(rect.height*dpr));
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,rect.width,rect.height);
  const scale = Math.min(rect.width/slot.width,rect.height/slot.height), w=slot.width*scale,h=slot.height*scale,x=(rect.width-w)/2,y=(rect.height-h)/2;
  // Tô mờ điểm sáng/tối bị kẹp và cạnh nét tương đối; đây là gợi ý trực quan, không phải mặt nạ lấy nét tuyệt đối.
  const sample = document.createElement('canvas'); sample.width=100;sample.height=100;
  const sctx=sample.getContext('2d',{willReadFrequently:true});sctx.fillStyle='#fff';sctx.fillRect(0,0,100,100);sctx.drawImage($('img',card),0,0,100,100);
  const im=sctx.getImageData(0,0,100,100), out=sctx.createImageData(100,100);  const tokenRgb = name => { const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().match(/^#([\da-f]{6})$/i)?.[1]; return hex ? [0,2,4].map(index => parseInt(hex.slice(index,index+2),16)) : []; };
  const clippedTone=tokenRgb('--color-danger'), shadowTone=tokenRgb('--color-secondary'), edgeTone=tokenRgb('--color-positive');
  const lum=(xx,yy)=>{const i=(yy*100+xx)*4;return .2126*im.data[i]+.7152*im.data[i+1]+.0722*im.data[i+2]};
  for(let yy=1;yy<99;yy++)for(let xx=1;xx<99;xx++){
    const i=(yy*100+xx)*4,r=im.data[i],g=im.data[i+1],b=im.data[i+2];
    if(r>248&&g>248&&b>248){out.data[i]=clippedTone[0];out.data[i+1]=clippedTone[1];out.data[i+2]=clippedTone[2];out.data[i+3]=100;}
    else if(r<8&&g<8&&b<8){out.data[i]=shadowTone[0];out.data[i+1]=shadowTone[1];out.data[i+2]=shadowTone[2];out.data[i+3]=110;}
    else {const edge=Math.abs(4*lum(xx,yy)-lum(xx-1,yy)-lum(xx+1,yy)-lum(xx,yy-1)-lum(xx,yy+1));if(edge>55){out.data[i]=edgeTone[0];out.data[i+1]=edgeTone[1];out.data[i+2]=edgeTone[2];out.data[i+3]=Math.min(85,Math.round(edge));}}
  }
  sample.getContext('2d').putImageData(out,0,0);ctx.drawImage(sample,x,y,w,h);
  ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();ctx.globalAlpha=.82;ctx.lineWidth=1;ctx.setLineDash([5,4]);
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(x+w*i/3,y);ctx.lineTo(x+w*i/3,y+h);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+h*i/3);ctx.lineTo(x+w,y+h*i/3);ctx.stroke();}
  ctx.setLineDash([]);ctx.globalAlpha=1;ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--color-border-strong').trim();ctx.strokeRect(x+.5,y+.5,w-1,h-1);
}
window.addEventListener('resize',()=>Object.keys(slots).forEach(drawOverlay));

async function loadHistory() {
  try {
    if (Capacitor.isNativePlatform()) { const result=await Preferences.get({key:'photolens_history'});return JSON.parse(result.value||'[]'); }
    if (window.photolens?.loadHistory) return await window.photolens.loadHistory();
    return JSON.parse(localStorage.getItem('photolens_history')||'[]');
  } catch { return []; }
}
async function saveHistory(result) {
  const history=await loadHistory();
  const thumbnails={};
  for(const id of Object.keys(result.local))if(slots[id])thumbnails[id]=await thumbnailData(slots[id]);
  history.unshift({...result,thumbnails});const trimmed=history.slice(0,12);
  try {
    if(Capacitor.isNativePlatform()) await Preferences.set({key:'photolens_history',value:JSON.stringify(trimmed)});
    else if(window.photolens?.saveHistory) await window.photolens.saveHistory(trimmed);
    else localStorage.setItem('photolens_history',JSON.stringify(trimmed));
  } catch(e) { console.warn('Không lưu được lịch sử:',e); toast('Báo cáo xong nhưng không lưu được lịch sử trên thiết bị.'); }
}
async function thumbnailData(slot) {
  const img=new Image();img.src=slot.url;await img.decode();const c=document.createElement('canvas');const s=Math.min(1,240/Math.max(img.naturalWidth,img.naturalHeight));c.width=img.naturalWidth*s;c.height=img.naturalHeight*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.72);
}
async function showHistory() {
  currentHistory = await loadHistory();
  const content = currentHistory.length ? `<div class="history-list">${currentHistory.map((item,i)=>`<button class="history-item" data-history-index="${i}" aria-label="Mở báo cáo ${i+1}"><img src="${item.thumbnails?.A||''}" alt=""><div><strong>${escapeHtml(item.names?.A||'Ảnh A')}${item.names?.B?' · '+escapeHtml(item.names.B):''}</strong><small>${new Date(item.timestamp).toLocaleString('vi-VN')} · ${item.local?.A?.technicalScore??'-'}/100${item.local?.B?' / '+item.local.B.technicalScore+'/100':''}</small></div></button>`).join('')}</div>` : `<div class="comparison-note">Chưa có báo cáo nào được lưu trên thiết bị này.</div>`;
  openModal(`<h2 id="historyTitle">Lịch sử phân tích</h2><p>Lưu cục bộ trên thiết bị của bạn, tối đa 12 báo cáo gần nhất.</p>${content}<div class="modal-actions"><button class="ghost-btn" id="deleteHistory" ${currentHistory.length?'':'disabled'}>Xóa lịch sử</button><button class="primary-btn" id="closeModal">Đóng</button></div>`);
  $$('[data-history-index]').forEach(btn=>btn.addEventListener('click',()=>{lastResult=currentHistory[Number(btn.dataset.historyIndex)];closeModal();renderReport(lastResult);toast('Đã mở báo cáo đã lưu.');}));
  $('#deleteHistory')?.addEventListener('click', clearHistory);
}
async function clearHistory() {
  if (!currentHistory.length || !window.confirm('Xóa toàn bộ lịch sử PhotoLens trên thiết bị này?')) return;
  try {
    if (Capacitor.isNativePlatform()) await Preferences.remove({key:'photolens_history'});
    else if (window.photolens?.clearHistory) await window.photolens.clearHistory();
    else localStorage.removeItem('photolens_history');
    currentHistory = [];
    await showHistory();
    toast('Đã xóa lịch sử phân tích.');
  } catch { toast('Không xóa được lịch sử. Hãy thử lại.'); }
}
async function showSettings() {
  await loadAiEnabled();
  const endpoint = await getAiEndpoint();
  const envLocked = Boolean(ENV_AI_ENDPOINT);
  openModal(`<h2>Cài đặt AI</h2><p>Ảnh được đo ngay trên thiết bị. Khi bật AI, chỉ bản JPEG đã thu nhỏ tối đa 1024 px và đã loại EXIF/GPS mới được gửi tới Cloudflare Worker.</p><label for="proxyInput">URL Cloudflare Worker</label><input id="proxyInput" type="url" placeholder="https://photolens-ai.ten-ban.workers.dev" value="${escapeAttr(endpoint)}" ${envLocked ? 'readonly' : ''} aria-describedby="endpointHelp"><p id="endpointHelp">${envLocked ? 'URL này do biến VITE_AI_ENDPOINT của bản build cung cấp.' : 'Nhập địa chỉ Worker gốc; ứng dụng sẽ gọi /health và /analyze.'}</p><label class="setting-toggle" for="settingsUseAi"><input type="checkbox" id="settingsUseAi" ${aiEnabled ? 'checked' : ''}><span>Dùng AI</span></label><div class="ai-status" role="status" aria-live="polite"><span id="aiStatusBadge" class="ai-status-badge">${endpoint ? 'Đang kiểm tra' : 'Chưa cấu hình'}</span><span id="aiStatusReason">${endpoint ? 'Đang kiểm tra kết nối Worker…' : 'Nhập URL Worker rồi kiểm tra kết nối.'}</span></div><div class="modal-actions settings-actions"><button class="ghost-btn" id="checkAiBtn" type="button" aria-label="Kiểm tra kết nối AI">Kiểm tra kết nối</button><button class="ghost-btn" id="closeModal" type="button">Đóng</button><button class="primary-btn" id="saveAiSettings" type="button">Lưu cài đặt</button></div>`);

  const setStatus = (state, reason) => {
    const badge = $('#aiStatusBadge');
    if (!badge) return;
    badge.textContent = state;
    badge.dataset.state = state;
    $('#aiStatusReason').textContent = reason;
  };
  const checkConnection = async () => {
    const value = ENV_AI_ENDPOINT || $('#proxyInput')?.value.trim() || '';
    if (!value) { setStatus('Chưa cấu hình', 'Hãy nhập URL Worker trước khi kiểm tra.'); return; }
    let parsed;
    try { parsed = new URL(value); } catch { setStatus('Lỗi', 'URL Worker không hợp lệ.'); return; }
    if (!['https:', 'http:'].includes(parsed.protocol)) { setStatus('Lỗi', 'URL Worker phải bắt đầu bằng http:// hoặc https://.'); return; }

    setStatus('Đang kiểm tra', 'Đang gọi /health…');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(`${value.replace(/\/+$/, '')}/health`, { signal: controller.signal, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.ok !== true) throw new Error(readableErrorMessage(body?.error, `Worker phản hồi HTTP ${response.status}.`));
      setStatus('Sẵn sàng', `Đã kết nối. Model: ${body.model || 'chưa khai báo'}.`);
    } catch (error) {
      setStatus('Lỗi', error?.name === 'AbortError' ? 'Kiểm tra quá 8 giây. Hãy kiểm tra Worker và mạng.' : error instanceof TypeError ? 'Không kết nối được Worker. Hãy kiểm tra mạng, URL và CORS.' : readableErrorMessage(error, 'Không kết nối được Worker. Hãy kiểm tra URL, mạng và CORS.'));
    } finally { clearTimeout(timer); }
  };
  $('#checkAiBtn')?.addEventListener('click', checkConnection);
  $('#saveAiSettings')?.addEventListener('click', async () => {
    const value = ENV_AI_ENDPOINT || $('#proxyInput')?.value.trim() || '';
    if (value) {
      try {
        const parsed = new URL(value);
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('scheme');
      } catch { toast('URL Worker không hợp lệ.'); return; }
    }
    aiEnabled = $('#settingsUseAi')?.checked || false;
    aiPreferenceLoaded = true;
    try {
      if (!ENV_AI_ENDPOINT) await setPreference('photolens_worker_url', value);
      await setPreference('photolens_ai_enabled', aiEnabled);
    } catch { toast('Không lưu được cài đặt AI trên thiết bị.'); return; }
    closeModal();
    toast(aiEnabled ? 'Đã lưu cài đặt AI.' : 'Đã tắt AI; chỉ số cục bộ vẫn hoạt động.');
  });
  if (endpoint) checkConnection();
}
let modalReturnFocus = null;
function openModal(html) {
  modalReturnFocus = document.activeElement;
  $('#modalHost').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="PhotoLens">${html}</section></div>`;
  $('#modalHost .modal-backdrop').addEventListener('click', event => { if (event.target.classList.contains('modal-backdrop')) closeModal(); });
  $('#closeModal')?.addEventListener('click', closeModal);
  requestAnimationFrame(() => $('.modal button:not(:disabled), .modal input')?.focus());
}
function closeModal() {
  $('#modalHost').innerHTML = '';
  modalReturnFocus?.focus?.();
  modalReturnFocus = null;
}
document.addEventListener('keydown', event => {
  const dialog = $('.modal');
  if (!dialog || event.key !== 'Tab') return;
  const focusable = [...dialog.querySelectorAll('button:not(:disabled),input,[href],[tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
function bindReportActions() { $$('[data-export]').forEach(btn=>btn.addEventListener('click',()=>exportReport(btn.dataset.export))); }
async function exportReport(type) {
  if(!lastResult){toast('Chưa có báo cáo để xuất.');return;}
  const stem=`PhotoLens-${new Date(lastResult.timestamp).toISOString().slice(0,10)}`;
  if(type==='json'){const blob=new Blob([JSON.stringify(lastResult,null,2)],{type:'application/json'});await deliverBlob(blob,`${stem}.json`);return;}
  try {
    toast(type==='pdf'?'Đang tạo PDF…':'Đang tạo ảnh báo cáo…');
    // PNG chỉ cần html2canvas; chỉ tải jsPDF nếu người dùng thật sự xuất PDF.
    const { default: html2canvas } = await import('html2canvas');
    const node=$('#report');const canvas=await html2canvas(node,{backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim(),scale:1.5,useCORS:true,windowWidth:Math.max(node.scrollWidth,document.documentElement.clientWidth)});
    if(type==='png'){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));await deliverBlob(blob,`${stem}.png`);return;}
    const { jsPDF } = await import('jspdf');
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});const pageW=210,pageH=297,margin=8,drawW=pageW-margin*2,drawH=canvas.height*drawW/canvas.width,chunkPx=Math.floor((pageH-margin*2)*canvas.width/drawW);let y=0,page=0;
    while(y<canvas.height){if(page)pdf.addPage();const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(chunkPx,canvas.height-y);slice.getContext('2d').drawImage(canvas,0,y,canvas.width,slice.height,0,0,canvas.width,slice.height);const partH=slice.height*drawW/canvas.width;pdf.addImage(slice.toDataURL('image/jpeg',.9),'JPEG',margin,margin,drawW,partH);y+=slice.height;page++;}
    await deliverBlob(pdf.output('blob'),`${stem}.pdf`);
  }catch(e){console.error(e);toast('Không tạo được tệp báo cáo.');}
}
async function deliverBlob(blob,filename) {
  if(!blob){toast('Không tạo được tệp xuất.');return;}
  if(Capacitor.isNativePlatform()) {
    try { const base64=await blobToBase64(blob);const path=await Filesystem.writeFile({path:filename,data:base64,directory:Directory.Cache,recursive:true});await Share.share({title:'PhotoLens — Báo cáo',text:'Báo cáo phân tích ảnh PhotoLens',url:path.uri,dialogTitle:'Chia sẻ báo cáo'});return; }
    catch(e){console.warn('Chia sẻ gốc thất bại:',e);}
  }
  if(window.photolens?.saveFile){const data=await blobToBase64(blob);const saved=await window.photolens.saveFile({filename,data,mimeType:blob.type});if(saved?.canceled)return;if(saved?.error)throw new Error(saved.error);toast('Đã lưu báo cáo.');return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Đã tải báo cáo xuống.');
}

function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function escapeAttr(value='') { return escapeHtml(value); }

document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();$(`[data-input="${mode==='compare'&&!slots.A?'A':mode==='compare'?'B':'A'}"]`).click();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(lastResult)exportReport('pdf');else toast('Phân tích ảnh trước khi xuất báo cáo.');}
  if(e.key==='Escape')closeModal();
});
if(window.photolens?.onOpenFiles)window.photolens.onOpenFiles(files=>{
  if(!files?.length)return;
  const ids=mode==='compare'&&files.length>1?['A','B']:[mode==='compare'&&slots.A?'B':'A'];
  files.slice(0,ids.length).forEach((entry,index)=>{const bytes=Uint8Array.from(atob(entry.data),c=>c.charCodeAt(0));addFile(ids[index],new File([bytes],entry.name,{type:entry.type}));});
});
if(window.photolens?.onExport)window.photolens.onExport(()=>{if(lastResult)exportReport('pdf');else toast('Phân tích ảnh trước khi xuất báo cáo.');});

// Khởi tạo PWA/web ở chế độ phân tích một ảnh; Electron và Capacitor dùng chung giao diện/lõi.
$('#report').innerHTML=emptyReport();
if (Capacitor.isNativePlatform()) {
  NativeApp.addListener('backButton', ({ canGoBack }) => {
    if ($('.modal')) closeModal();
    else if (mode === 'compare') setMode('single');
    else if (canGoBack) window.history.back();
    else NativeApp.exitApp();
  }).catch(error => console.warn('Không khởi tạo được nút Back Android:', error));
  NativeApp.addListener('appRestoredResult', async result => {
    if (result?.pluginId !== 'Camera' || result?.methodName !== 'getPhoto' || !result?.success || !result?.data?.webPath) return;
    try { const response = await fetch(result.data.webPath); const blob = await response.blob(); await addFile(mode === 'compare' && slots.A ? 'B' : 'A', new File([blob], `PhotoLens-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })); }
    catch { toast('Không khôi phục được ảnh vừa chụp. Hãy chọn ảnh lại.'); }
  }).catch(error => console.warn('Không khôi phục được kết quả camera:', error));
}
try { applyTheme(localStorage.getItem('photolens_theme') || 'dark'); } catch { applyTheme('dark'); }
showOnboarding();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.photolens) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(error => console.info('PWA offline cache unavailable:', error.message)));
}


window.addEventListener("pagehide", () => { activeAiController?.abort(new DOMException("Da roi trang.", "AbortError")); });
