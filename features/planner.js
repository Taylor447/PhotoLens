import '../css/planner.css';
import builtInDevices from '../data/devices.json';
import seedSpots from '../data/spots.json';
import deviceScoring from '../data/device-scoring.json';
import deviceSourceRegistry from '../data/sources.json';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { compareDeviceFields, scoreDevice, scorePhotoConditions, bestForecastHours, estimateGoldenWindows, suggestAngles, suggestOutfits, planStore, escapeText } from '../core/photography.js';
import { computeDeviceCoverage, searchDeviceCatalog } from '../core/device-catalog.js';
import { loadDeviceCatalog, checkDeviceCatalogUpdates, downloadFullDeviceData, clearDownloadedDeviceData } from './device-data.js';
import { renderDeviceCatalogView } from './device-catalog-view.js';

const q = (selector, root = document) => root.querySelector(selector);
const genreNames = { portrait:'Chân dung', landscape:'Phong cảnh', architecture:'Kiến trúc', street:'Đường phố', night:'Đường phố đêm', moon:'Chụp trăng', cosplay:'Cosplay', documentary:'Tư liệu' };
const deviceTypes = { phone:'Điện thoại', mirrorless:'Mirrorless', dslr:'DSLR', compact:'Compact', 'action-camera':'Action cam', 'my-device':'Thiết bị của tôi' };
const knownDeviceFields = [
  ['sensor.type','Loại cảm biến'],['sensor.size','Kích thước cảm biến'],['sensor.megapixels','Độ phân giải','MP'],['sensor.pixelPitchUm','Kích thước điểm ảnh','µm'],['sensor.iso','Dải ISO'],['sensor.raw','RAW'],['sensor.rawBitDepth','Độ sâu RAW','bit'],['sensor.colorDepth','Độ sâu màu','bit'],
  ['lens.focal35mm','Tiêu cự quy đổi 35mm'],['lens.aperture','Khẩu độ'],['lens.maxApertureF','Khẩu độ lớn nhất','f/'],['lens.opticalZoom','Zoom quang','×'],['lens.macro','Macro'],['lens.mount','Ngàm'],['lens.ecosystem','Hệ ống kính'],
  ['focus.autofocus','Lấy nét tự động'],['focus.subjectTracking','Theo dõi chủ thể'],['focus.stabilization','Chống rung'],['focus.stabilizationScore','Chống rung (điểm nhập tay)','/5'],['focus.burstFps','Chụp liên tiếp','fps'],
  ['video.maxResolution','Độ phân giải video'],['video.maxFps','Tốc độ khung hình tối đa','fps'],['video.codec','Codec'],['video.hdrLog','HDR / Log'],['video.bitDepth','Độ sâu video','bit'],['video.stabilization','Chống rung video'],['video.continuousLimit','Giới hạn quay liên tục'],
  ['durability.rating','Chống bụi/nước'],['durability.display','Màn hình'],['durability.viewfinder','Kính ngắm'],['power.battery','Pin'],['power.batteryShots','Số ảnh mỗi lần sạc','ảnh'],['power.storage','Lưu trữ'],['power.storageGB','Dung lượng','GB'],['power.weightG','Khối lượng','g'],['power.dimensionsMm','Kích thước'],['power.connectivity','Kết nối'],['power.price','Giá']
].map(([path,label,unit])=>({path,label,unit}));
const purposeNames = { portrait:'Chân dung', travel:'Du lịch', lowLight:'Thiếu sáng', video:'Video / vlog', architecture:'Kiến trúc', sports:'Thể thao / động vật', editing:'Hậu kỳ' };
const store = planStore();
let host, shell, activeTab = 'devices', currentWeather = null, weatherPlace = null, nearbySpots = [], selectedSpot = null, chartMode = 'portrait', statusText = '';
let selectedDevices = [], onlyDifferences = false, activePlanId = null;
let catalogDevices = builtInDevices, catalogMeta = null, catalogStatus = '', catalogBusy = false, catalogLoadPromise = null;
let deviceSearch = '', deviceBrandFilter = '', deviceTypeFilter = '', devicePurpose = 'portrait';

const safeJson = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
function localRead(key, fallback) { try { return safeJson(localStorage.getItem(key), fallback); } catch { return fallback; } }
function localWrite(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
async function preference(key) {
  try { if (Capacitor.isNativePlatform()) return (await Preferences.get({ key })).value || ''; } catch {}
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
async function aiContext() {
  const endpoint = String(import.meta.env.VITE_AI_ENDPOINT || await preference('photolens_worker_url')).replace(/\/+$/, '');
  const enabled = await preference('photolens_ai_enabled');
  return { endpoint, enabled: enabled === true || enabled === 'true' };
}
function allDevices() { return [...catalogDevices, ...localRead('photolens_my_devices_v1', [])]; }
function currentDevice(id) { return allDevices().find(item => item.id === id); }
function fmt(value, unit = '') { if (value === null || value === undefined || value === '') return 'Chua có dữ liệu'; const shown = typeof value === 'boolean' ? (value ? 'Có' : 'Không') : Array.isArray(value) ? value.join(', ') : value; return `${shown}${unit ? ` ${unit}` : ''}`; }
function sourceLink(url) { return url ? `<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">Nguồn / đối chiếu ↗</a>` : 'Chưa có nguồn'; }
function distanceKm(a, b) {
  if (![a?.latitude,a?.longitude,b?.latitude,b?.longitude].every(Number.isFinite)) return null;
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(b.latitude-a.latitude), dLon = rad(b.longitude-a.longitude);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

export function openPhotographyHub() {
  if (!host) {
    host = document.createElement('div'); host.id = 'photoPlannerHost'; host.hidden = true; document.body.append(host);
    host.addEventListener('click', onHubClick);
    host.addEventListener('submit', onHubSubmit);
    host.addEventListener('change', onHubChange);
    host.addEventListener('input', onHubInput);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !host.hidden) closeHub(); });
  }
  host.hidden = false;
  q('#photoPlannerButton')?.setAttribute('aria-expanded','true');
  renderHub(); q('#plannerClose')?.focus();
  if (!catalogLoadPromise) catalogLoadPromise = loadDeviceCatalog(builtInDevices).then(result => {
    catalogDevices = Array.isArray(result.devices) ? result.devices : builtInDevices;
    catalogMeta = result.meta || null; catalogStatus = result.note || '';
    if (!host.hidden && activeTab === 'devices') renderHub();
    return result;
  }).catch(error => { catalogStatus = `Không tải được bộ dữ liệu trực tuyến; vẫn dùng bản nhúng. ${error.message}`; return null; });
}

function closeHub(button = q('#photoPlannerButton')) { host.hidden = true; button?.setAttribute('aria-expanded','false'); button?.focus(); }
function tabsMarkup() {
  const tabs = [['devices','Thiết bị'],['weather','Thời tiết'],['spots','Địa điểm'],['angles','Góc chụp'],['outfit','Trang phục'],['plans','Kế hoạch']];
  return `<nav class="planner-tabs" role="tablist" aria-label="Công cụ chụp ảnh">${tabs.map(([id,label])=>`<button role="tab" aria-selected="${activeTab===id}" class="${activeTab===id?'active':''}" data-planner-tab="${id}">${label}</button>`).join('')}</nav>`;
}
function renderHub() {
  const body = ({ devices: renderDevices, weather: renderWeather, spots: renderSpots, angles: renderAngles, outfit: renderOutfit, plans: renderPlans })[activeTab]();
  host.innerHTML = `<div class="planner-backdrop"><section class="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="plannerTitle"><header class="planner-header"><div><p class="planner-eyebrow">PHOTOLENS · STUDIO NGOÀI TRỜI</p><h2 id="plannerTitle">Thiết bị & kế hoạch chụp</h2><p class="planner-subtitle">So sánh dữ liệu, xem điều kiện và chuẩn bị buổi chụp.</p></div><button id="plannerClose" class="icon-btn" type="button" aria-label="Đóng">×</button></header>${tabsMarkup()}<div class="planner-content" id="plannerContent">${body}</div><footer class="planner-footer">Dữ liệu thiết bị mẫu chưa xác minh · Thời tiết và địa điểm có thể thay đổi. Hãy kiểm tra quy định tại chỗ.</footer></section></div>`;
  q('#plannerClose',host).addEventListener('click', () => closeHub());
  host.querySelector('.planner-backdrop').addEventListener('click', event => { if (event.target.classList.contains('planner-backdrop')) closeHub(); });
}
function renderDevices() {
  const devices = allDevices();
  if (!selectedDevices.length) selectedDevices = devices.slice(0, 2).map(device => device.id);
  const counts = catalogDevices.reduce((result, device) => { const key = device.tier == null ? "Chưa phân tầng" : String(device.tier); result[key] = (result[key] || 0) + 1; return result; }, {});
  const meta = catalogMeta || { counts: { byTier: counts } };
  return renderDeviceCatalogView({ devices, selectedDevices, onlyDifferences, query: deviceSearch, brandFilter: deviceBrandFilter, typeFilter: deviceTypeFilter, purpose: devicePurpose, wifiOnly: localRead('photolens_device_wifi_only', false), coverage: computeDeviceCoverage(catalogDevices), meta, status: catalogStatus, busy: catalogBusy, sources: deviceSourceRegistry.sources, scoring: deviceScoring, purposeNames, fields: knownDeviceFields, searchDeviceCatalog, compareDeviceFields, scoreDevice, fmt, escapeText });
}
function renderWeather() {
  const weather = currentWeather;
  const current = weather?.current || {};
  const dataReady = Boolean(weatherPlace && weather);
  const hourly = weather?.hourly || {};
  const hours = bestForecastHours(hourly, chartMode, weather?.pmByHour || {});
  const best = hours[0];
  const daily = weather?.daily;
  const dayCards = (daily?.time || []).slice(0,7).map((date,index)=>`<article class="planner-forecast-card"><strong>${escapeText(new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}).format(new Date(`${date}T12:00`)))}</strong><span>${daily.temperature_2m_max?.[index] ?? '—'}° / ${daily.temperature_2m_min?.[index] ?? '—'}°</span><small>Mưa ${daily.precipitation_probability_max?.[index] ?? 'Chưa có dữ liệu'}%</small></article>`).join('');
  const solar = dataReady && daily?.sunrise?.[0] ? estimateGoldenWindows(daily.sunrise[0], daily.sunset?.[0]) : null;
  return `<div class="planner-section-head"><div><h3>Thời tiết & khung giờ chụp</h3><p>Chọn tên thành phố/địa điểm. PhotoLens không tự lấy vị trí khi chưa được bạn bấm.</p></div></div>
  <form class="planner-card planner-search" data-form="weather"><label for="weatherPlace">Địa điểm</label><div class="planner-inline"><input id="weatherPlace" name="place" value="${escapeText(weatherPlace?.label || '')}" placeholder="Ví dụ: Hà Nội, Việt Nam" required><button class="planner-primary" type="submit">Tìm thời tiết</button><button class="planner-secondary" type="button" data-action="locate">Vị trí hiện tại</button></div><p class="planner-muted">Tọa độ chỉ được xin khi bạn nhấn “Vị trí hiện tại”. Nếu từ chối, hãy nhập địa điểm bằng chữ.</p></form>
  ${statusText?`<p class="planner-status" role="status">${escapeText(statusText)}</p>`:''}
  ${dataReady?`<div class="planner-current-weather"><div><span class="planner-muted">${escapeText(weatherPlace.label)}</span><strong>${current.temperature_2m ?? '—'}°C</strong><small>Cảm giác ${current.apparent_temperature ?? 'Chưa có dữ liệu'}° · Mây ${current.cloud_cover ?? '—'}% · Gió ${current.wind_speed_10m ?? '—'} km/h</small></div><div><span>PM2.5</span><strong>${weather.pm25 ?? 'Chưa có dữ liệu'}${weather.pm25==null?'':' µg/m³'}</strong><small>Cập nhật: ${escapeText(new Date(weather.fetchedAt).toLocaleString('vi-VN'))}${weather.cached?' · dữ liệu đã lưu':''}</small></div></div>
    <div class="planner-card"><h4>Điều kiện chụp theo khung giờ</h4><div class="planner-inline"><label>Thể loại<select data-weather-genre>${Object.entries(genreNames).filter(([id])=>['portrait','landscape','architecture','street','night','moon'].includes(id)).map(([id,name])=>`<option value="${id}" ${chartMode===id?'selected':''}>${name}</option>`).join('')}</select></label>${best?`<span class="planner-callout">Khung tốt nhất trong 48 giờ: <b>${escapeText(new Date(best.time).toLocaleString('vi-VN',{weekday:'short',hour:'2-digit',minute:'2-digit'}))}</b> · ${best.score??'Chưa đủ dữ liệu'}/100</span>`:''}</div><p class="planner-muted">${escapeText(best?.explanation || 'Chưa có đủ dữ liệu để xếp hạng khung giờ.')}</p><div class="planner-hour-grid">${hours.slice(0,8).map(item=>`<div class="planner-hour"><strong>${escapeText(new Date(item.time).toLocaleString('vi-VN',{weekday:'short',hour:'2-digit'}))}</strong><span>${item.temperature??'—'}°</span><b>${item.score??'—'}</b></div>`).join('')}</div></div>
    <div class="planner-card"><h4>Dự báo 7 ngày</h4><div class="planner-forecast-grid">${dayCards}</div></div>
    <div class="planner-card"><h4>Bình minh, hoàng hôn & giờ vàng</h4>${solar?`<div class="planner-inline"><span>Bình minh <b>${solar.sunrise}</b></span><span>Giờ vàng sáng <b>${solar.morningGolden}</b></span><span>Giờ xanh sáng <b>${solar.morningBlue}</b></span><span>Giờ vàng chiều <b>${solar.eveningGolden}</b></span><span>Giờ xanh chiều <b>${solar.eveningBlue}</b></span><span>Hoàng hôn <b>${solar.sunset}</b></span></div><p class="planner-muted">Giờ vàng/xanh là khoảng ước tính theo độ lệch phút từ bình minh/hoàng hôn, không phải dự báo ánh sáng tại địa điểm cụ thể.</p>`:'Chưa có dữ liệu bình minh/hoàng hôn.'}</div><p class="planner-attribution">Thời tiết: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>. Chất lượng không khí: Open-Meteo / CAMS ENSEMBLE.</p>`:`<div class="planner-empty">Nhập địa điểm rồi bấm “Tìm thời tiết”. Khi mất mạng, dữ liệu đã lưu gần đây sẽ được dùng nếu có.</div>`}`;
}

function renderSpots() {
  const city = weatherPlace?.label || '';
  const candidateList = [...nearbySpots, ...seedSpots.map(item=>({...item, curated:true}))];
  const cards = candidateList.slice(0,24).map(spot=>{
    const distance = distanceKm(weatherPlace, spot);
    const name = spot.name || spot.tags?.name || spot.tags?.['name:vi'] || 'Địa điểm chưa có tên';
    const lat = Number.isFinite(spot.latitude) ? spot.latitude : Number(spot.lat);
    const lon = Number.isFinite(spot.longitude) ? spot.longitude : Number(spot.lon);
    const map = Number.isFinite(lat)&&Number.isFinite(lon) ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}` : spot.source || `https://www.openstreetmap.org/search?query=${encodeURIComponent(spot.search || name)}`;
    return `<article class="planner-spot-card"><div><h4>${escapeText(name)}</h4><span class="planner-badge ${spot.curated?'unverified':'verified'}">${spot.curated?'Gợi ý tên · chưa có tọa độ':'OpenStreetMap'}</span></div><p>${escapeText(spot.typeLabel || spot.tags?.tourism || spot.tags?.leisure || spot.tags?.historic || spot.area || 'Chưa có dữ liệu phân loại')}${distance==null?'':` · ${distance.toFixed(1)} km`}</p><p>${escapeText(spot.access || 'Thông tin giờ mở cửa và quyền chụp: Chưa có dữ liệu. Hãy tự xác minh trước chuyến đi.')}</p><div class="planner-inline"><a class="planner-secondary as-button" href="${escapeText(map)}" target="_blank" rel="noopener noreferrer">Mở bản đồ</a><button class="planner-text-button" data-action="spot-select" data-spot="${escapeText(spot.id || `${lat},${lon}`)}">Chọn cho kế hoạch</button></div></article>`;
  }).join('');
  const mapFrame = selectedSpot && Number.isFinite(Number(selectedSpot.lat)) && Number.isFinite(Number(selectedSpot.lon)) ? `<iframe class="planner-map" title="Bản đồ OpenStreetMap" src="https://www.openstreetmap.org/export/embed.html?bbox=${Number(selectedSpot.lon)-.01}%2C${Number(selectedSpot.lat)-.01}%2C${Number(selectedSpot.lon)+.01}%2C${Number(selectedSpot.lat)+.01}&marker=${Number(selectedSpot.lat)}%2C${Number(selectedSpot.lon)}" loading="lazy"></iframe>` : '';
  return `<div class="planner-section-head"><div><h3>Địa điểm chụp</h3><p>Ứng viên quanh ${city?escapeText(city):'vị trí đã chọn'} · chưa khẳng định giờ mở cửa hay quyền chụp.</p></div><button class="planner-primary" data-action="find-spots">Tìm địa điểm quanh đây</button></div>${!weatherPlace?'<div class="planner-empty">Hãy chọn địa điểm trong thẻ Thời tiết trước để tìm ứng viên OpenStreetMap.</div>':''}${statusText?`<p class="planner-status" role="status">${escapeText(statusText)}</p>`:''}${mapFrame}<div class="planner-spot-grid">${cards || '<div class="planner-empty">Chưa có dữ liệu địa điểm quanh đây. Tìm bằng OpenStreetMap hoặc xem gợi ý tên phổ biến phía dưới.</div>'}</div><div class="planner-card"><h4>Gợi ý phổ biến ở Hà Nội</h4><p class="planner-muted">Danh sách tên dưới đây chỉ là điểm bắt đầu tìm kiếm; tọa độ chưa được xác minh cục bộ và không dùng để xếp hạng.</p><div class="planner-seed-list">${seedSpots.map(item=>`<a href="${escapeText(item.source)}" target="_blank" rel="noopener noreferrer">${escapeText(item.name)} ↗</a>`).join('')}</div></div><p class="planner-attribution">Bản đồ và địa điểm OpenStreetMap © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors (ODbL)</a>. Hãy tự kiểm tra quy định tại chỗ, chụp thương mại, cosplay và drone.</p>`;
}

function diagramSvg(index) {
  const y = [58,76,40][index];
  return `<svg width="160" height="84" viewBox="0 0 160 84" role="img" aria-label="Sơ đồ vị trí máy và chủ thể"><path d="M20 66h120M35 18v48M122 18v48M35 18l87 48M122 18 35 66" fill="none" stroke="currentColor" stroke-opacity=".25"/><circle cx="35" cy="${y}" r="7" fill="var(--color-accent)"/><path d="M31 ${y+12}h8l4 18H27z" fill="currentColor"/><circle cx="122" cy="42" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M116 57h12l5 12h-22z" fill="currentColor"/><text x="18" y="80" font-size="10">Máy</text><text x="106" y="80" font-size="10">Chủ thể</text></svg>`;
}
function renderAngles() {
  const angles = suggestAngles(chartMode, localRead('photolens_angle_subject','chủ thể'), localRead('photolens_angle_scene',''));
  return `<div class="planner-section-head"><div><h3>Gợi ý góc chụp</h3><p>Gợi ý bố cục theo thể loại; thiết lập phơi sáng phụ thuộc camera thật.</p></div></div><form class="planner-card planner-form" data-form="angles"><label>Thể loại<select name="genre">${Object.entries(genreNames).map(([id,name])=>`<option value="${id}" ${chartMode===id?'selected':''}>${name}</option>`).join('')}</select></label><label>Chủ thể<input name="subject" value="${escapeText(localRead('photolens_angle_subject','chủ thể'))}" placeholder="Ví dụ: người, món ăn, tòa nhà"></label><label>Bối cảnh<input name="scene" value="${escapeText(localRead('photolens_angle_scene',''))}" placeholder="Mô tả cảnh nền"></label><button class="planner-primary" type="submit">Tạo gợi ý</button></form><div class="planner-angle-grid">${angles.map((item,index)=>`<article class="planner-angle-card">${diagramSvg(index)}<h4>${escapeText(item.name)}</h4><dl><dt>Độ cao máy</dt><dd>${escapeText(item.height)}</dd><dt>Khoảng cách</dt><dd>${escapeText(item.distance)}</dd><dt>Tiêu cự gợi ý</dt><dd>${escapeText(item.lens)}</dd><dt>Bố cục</dt><dd>${escapeText(item.composition)}</dd><dt>Chỉ đạo chủ thể</dt><dd>${escapeText(item.direction)}</dd><dt>Cần tránh</dt><dd>${escapeText(item.avoid)}</dd></dl><p class="planner-muted">Khẩu độ / ISO / tốc độ: Chưa có dữ liệu điều khiển của thiết bị đang dùng. Chỉ dùng gợi ý thủ công nếu camera thực sự hỗ trợ.</p></article>`).join('')}</div>`;
}

function renderOutfit() {
  const w = currentWeather?.current;
  const current = { temperature:w?.temperature_2m, precipitation:w?.precipitation, wind:w?.wind_speed_10m };
  const background = localRead('photolens_background_color','#56736f');
  const outfits = suggestOutfits({ ...current, style:localRead('photolens_outfit_style','Tự nhiên'), background });
  return `<div class="planner-section-head"><div><h3>Trang phục lên ảnh</h3><p>Gợi ý chỉ dựa trên thời tiết, màu nền và phong cách bạn chọn; không đánh giá ngoại hình.</p></div></div><div class="planner-card planner-inline"><label>Phong cách<select data-outfit-style><option>Tự nhiên</option><option>Tối giản</option><option>Điện ảnh</option><option>Năng động</option><option>Cổ điển</option></select></label><label>Màu nền dự kiến<input type="color" value="${escapeText(background)}" data-bg-color></label><span class="planner-muted">${w?`Thời tiết đang chọn: ${w.temperature_2m ?? '—'}°C · mưa ${w.precipitation ?? '—'} mm · gió ${w.wind_speed_10m ?? '—'} km/h`:'Chưa có dữ liệu thời tiết; chọn theo điều kiện thực tế.'}</span></div><div class="planner-outfit-grid">${outfits.map(item=>`<article class="planner-outfit-card"><h4>${escapeText(item.name)}</h4><div class="planner-swatches">${item.colors.map((name,index)=>`<span><i style="--swatch:${['#eadfc9','#345a82','#a55043'][index]}"></i>${escapeText(name)}</span>`).join('')}</div><p><b>Trang phục:</b> ${escapeText(item.clothes)}</p><p><b>Phụ kiện:</b> ${escapeText(item.accessories)}</p><p><b>Vì sao hợp ảnh:</b> ${escapeText(item.reason)}</p><p><b>Lưu ý:</b> ${escapeText(item.caution)}</p></article>`).join('')}</div>`;
}

function renderPlans() {
  const plans = store.list();
  const editing = activePlanId ? plans.find(p=>p.id===activePlanId) : null;
  return `<div class="planner-section-head"><div><h3>Kế hoạch buổi chụp</h3><p>Lưu trên thiết bị này; không tải kế hoạch lên máy chủ.</p></div></div><form class="planner-card planner-form" data-form="plan"><input type="hidden" name="id" value="${escapeText(editing?.id||'')}"><label>Tên buổi chụp<input name="title" required value="${escapeText(editing?.title||'')}" placeholder="Ví dụ: Chân dung chiều Hồ Tây"></label><div class="planner-inline"><label>Ngày<input name="date" type="date" value="${escapeText(editing?.date||'')}"></label><label>Thể loại<select name="genre">${Object.entries(genreNames).map(([id,name])=>`<option value="${id}" ${editing?.genre===id?'selected':''}>${name}</option>`).join('')}</select></label><label>Thiết bị<select name="device"><option value="">Chưa chọn</option>${allDevices().map(d=>`<option value="${escapeText(d.id)}" ${editing?.device===d.id?'selected':''}>${escapeText(d.brand)} ${escapeText(d.model)}</option>`).join('')}</select></label></div><div class="planner-inline"><label>Địa điểm<input name="location" value="${escapeText(editing?.location||selectedSpot?.name||weatherPlace?.label||'')}" placeholder="Tên hoặc địa chỉ"></label><label>Khung giờ<input name="time" type="time" value="${escapeText(editing?.time||'')}"></label></div><label>Danh sách đồ mang theo<input name="gear" value="${escapeText(editing?.gear||'Máy ảnh/điện thoại, pin, thẻ nhớ, khăn lau lens')}"></label><label>Ghi chú<textarea name="notes" rows="3">${escapeText(editing?.notes||'')}</textarea></label><div class="planner-inline"><button class="planner-primary" type="submit">${editing?'Cập nhật kế hoạch':'Lưu kế hoạch'}</button>${editing?'<button class="planner-secondary" type="button" data-action="plan-cancel">Hủy sửa</button>':''}<button class="planner-secondary" type="button" data-action="plan-export">Xuất / chia sẻ</button></div></form><div class="planner-plan-list">${plans.length?plans.map(plan=>`<article class="planner-plan-card"><div><h4>${escapeText(plan.title)}</h4><p>${escapeText([plan.date,genreNames[plan.genre],plan.location,plan.time].filter(Boolean).join(' · ')||'Chưa đặt lịch')}</p><p>${escapeText(plan.notes||'Không có ghi chú')}</p></div><div><button class="planner-text-button" data-action="plan-edit" data-id="${escapeText(plan.id)}">Sửa</button><button class="planner-text-button danger" data-action="plan-delete" data-id="${escapeText(plan.id)}">Xóa</button></div></article>`).join(''):'<div class="planner-empty">Chưa lưu kế hoạch nào.</div>'}</div>`;
}

async function fetchJson(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try { const response = await fetch(url,{...options,signal:controller.signal}); const body = await response.json().catch(()=>null); if(!response.ok) throw new Error(body?.reason || body?.error?.message || `HTTP ${response.status}`); return body; }
  finally { clearTimeout(timer); }
}
async function geocode(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search'); url.search = new URLSearchParams({name:query,count:'1',language:'vi',format:'json',countryCode:'VN'}).toString();
  const body = await fetchJson(url); const place = body?.results?.[0];
  if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) throw new Error('Không tìm thấy địa điểm. Hãy thử thêm tên quận/tỉnh hoặc quốc gia.');
  return {label:[place.name,place.admin1,place.country].filter(Boolean).join(', '),latitude:place.latitude,longitude:place.longitude,timezone:place.timezone || 'auto'};
}
async function loadWeather(place) {
  const cacheKey = `photolens_weather_${place.latitude.toFixed(2)}_${place.longitude.toFixed(2)}`;
  const cached = localRead(cacheKey,null); const fresh = cached && Date.now()-cached.fetchedAt < 20*60*1000;
  if (fresh) { currentWeather = cached; weatherPlace = place; return; }
  const common = {latitude:String(place.latitude),longitude:String(place.longitude),timezone:'auto'};
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast'); forecastUrl.search = new URLSearchParams({...common,current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,is_day',hourly:'temperature_2m,precipitation_probability,cloud_cover,visibility,wind_speed_10m,uv_index',daily:'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'7'}).toString();
  const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality'); airUrl.search = new URLSearchParams({...common,hourly:'pm2_5',forecast_days:'5'}).toString();
  const [forecast,air] = await Promise.all([fetchJson(forecastUrl),fetchJson(airUrl).catch(()=>null)]);
  const pmByHour = {};
  for (let i=0;i<(air?.hourly?.time||[]).length;i++) pmByHour[air.hourly.time[i]]=air.hourly.pm2_5?.[i] ?? null;
  currentWeather = {current:forecast.current||{},hourly:forecast.hourly||{},daily:forecast.daily||{},pm25:air?.hourly?.pm2_5?.[0]??null,pmByHour,fetchedAt:Date.now(),cached:false};
  weatherPlace=place; localWrite(cacheKey,currentWeather);
}
async function searchWeather(query) {
  statusText='Đang tìm địa điểm và tải dự báo…'; renderHub();
  try { const place=await geocode(query); await loadWeather(place); statusText=''; }
  catch(error) { const cacheCandidates=Object.keys(localStorage).filter(key=>key.startsWith('photolens_weather_')); const cached=cacheCandidates.map(key=>localRead(key,null)).filter(Boolean).sort((a,b)=>b.fetchedAt-a.fetchedAt)[0]; if(cached){currentWeather={...cached,cached:true};statusText=`Không lấy được dữ liệu mới (${error.message}). Đang hiển thị bản đã lưu ${new Date(cached.fetchedAt).toLocaleString('vi-VN')}.`;}else statusText=`Không tải được thời tiết: ${error.message}`; }
  renderHub();
}
async function locateUser() {
  if (!navigator.geolocation) { statusText='Thiết bị/trình duyệt không hỗ trợ vị trí. Hãy nhập địa điểm bằng chữ.'; renderHub(); return; }
  statusText='Đang xin quyền vị trí…'; renderHub();
  navigator.geolocation.getCurrentPosition(async position=>{try{const lat=Number(position.coords.latitude.toFixed(2)),lon=Number(position.coords.longitude.toFixed(2));const place={label:'Vị trí của tôi',latitude:lat,longitude:lon,timezone:'auto'};await loadWeather(place);statusText='';}catch(error){statusText=`Không tải được dự báo: ${error.message}`;}renderHub();},error=>{statusText=error.code===1?'Bạn đã từ chối quyền vị trí. Hãy nhập tên thành phố thay thế.':'Không lấy được vị trí. Hãy nhập tên thành phố thay thế.';renderHub();},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
}
async function findNearbySpots() {
  if(!weatherPlace){statusText='Hãy tìm thời tiết hoặc chọn vị trí trước.';renderHub();return;}
  statusText='Đang tìm dữ liệu OpenStreetMap trong bán kính 5 km…';renderHub();
  const {latitude,longitude}=weatherPlace; const r=5000;
  const query=`[out:json][timeout:10];(nwr(around:${r},${latitude},${longitude})[leisure~"park|garden|nature_reserve"];nwr(around:${r},${latitude},${longitude})[tourism~"attraction|museum|viewpoint|artwork"];nwr(around:${r},${latitude},${longitude})[historic];);out center tags 45;`;
  try {
    const url='https://overpass-api.de/api/interpreter';
    const data=await fetchJson(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:`data=${encodeURIComponent(query)}`},15000);
    nearbySpots=(data.elements||[]).map(element=>{const lat=element.lat??element.center?.lat,lon=element.lon??element.center?.lon;return{id:`osm-${element.type}-${element.id}`,name:element.tags?.['name:vi']||element.tags?.name,typeLabel:element.tags?.tourism||element.tags?.leisure||element.tags?.historic,lat:Number(lat),lon:Number(lon),latitude:Number(lat),longitude:Number(lon),tags:element.tags||{},source:`https://www.openstreetmap.org/${element.type}/${element.id}`,access:'Thông tin giờ mở cửa, quyền chụp và tình trạng hiện tại chưa có dữ liệu; tự xác minh.'};}).filter(item=>item.name&&Number.isFinite(item.lat)&&Number.isFinite(item.lon)).sort((a,b)=>(distanceKm(weatherPlace,a)??Infinity)-(distanceKm(weatherPlace,b)??Infinity));
    statusText=nearbySpots.length?`Tìm thấy ${nearbySpots.length} ứng viên từ OpenStreetMap.`:'OpenStreetMap chưa trả địa điểm phù hợp; danh sách tên phổ biến vẫn còn bên dưới.';
  } catch(error) { statusText=`Không kết nối được Overpass (${error.message}). Có thể thử lại sau; danh sách tên phổ biến không có tọa độ xác minh.`; }
  renderHub();
}

async function handleDeviceDataAction(action) {
  if (action !== 'device-data-clear' && localRead('photolens_device_wifi_only', false)) {
    const connectionType = navigator.connection?.type || navigator.mozConnection?.type || navigator.webkitConnection?.type;
    if (connectionType !== 'wifi') {
      catalogStatus = connectionType ? 'Đang bật “Chỉ cập nhật khi có Wi-Fi”; thao tác bị hoãn vì kết nối hiện tại không phải Wi-Fi.' : 'Trình duyệt không cung cấp loại kết nối; hãy tắt “Chỉ cập nhật khi có Wi-Fi” để cập nhật.';
      renderHub(); return;
    }
  }
  catalogBusy = true; renderHub();
  try {
    if (action === 'device-data-update') {
      const result = await checkDeviceCatalogUpdates({ force: true });
      const latest = await loadDeviceCatalog(builtInDevices);
      catalogDevices = latest.devices || builtInDevices; catalogMeta = latest.meta || catalogMeta;
      catalogStatus = result.message || latest.note || 'Đã kiểm tra bản cập nhật.';
    } else if (action === 'device-data-full') {
      const result = await downloadFullDeviceData();
      catalogDevices = result.devices || catalogDevices; catalogMeta = result.meta || catalogMeta;
      catalogStatus = result.note || 'Đã tải bộ dữ liệu đầy đủ.';
    } else if (action === 'device-data-clear') {
      if (!confirm('Xóa bản dữ liệu thiết bị đã tải trên máy này? Bộ dữ liệu nhúng sẵn và Thiết bị của tôi vẫn được giữ.')) return;
      const result = await clearDownloadedDeviceData();
      catalogDevices = result.devices || builtInDevices; catalogMeta = null; catalogStatus = result.note || "Đã xóa dữ liệu đã tải.";
    }
  } catch (error) {
    catalogStatus = `Không hoàn tất được thao tác dữ liệu. ${error.message || "Kiểm tra kết nối rồi thử lại."}`;
  } finally {
    catalogBusy = false;
    if (!host.hidden && activeTab === 'devices') renderHub();
  }
}
async function onHubClick(event) {
  const tab=event.target.closest('[data-planner-tab]'); if(tab){activeTab=tab.dataset.plannerTab;statusText='';renderHub();return;}
  const action=event.target.closest('[data-action]')?.dataset.action; if(!action)return;
  const target=event.target.closest('[data-action]');
  if(['device-data-update','device-data-full','device-data-clear'].includes(action)){await handleDeviceDataAction(action);return;}
  if(action==='locate') locateUser();
  if(action==='find-spots') findNearbySpots();
  if(action==='device-add') addUserDevice();
  if(action==='device-delete') { const current=localRead('photolens_my_devices_v1',[]).filter(d=>d.id!==target.dataset.id);localWrite('photolens_my_devices_v1',current);selectedDevices=selectedDevices.filter(id=>id!==target.dataset.id);renderHub(); }
  if(action==='device-edit') editUserDevice(target.dataset.id);
  if(action==='spot-select') { const id=target.dataset.spot;selectedSpot=nearbySpots.find(s=>s.id===id)||seedSpots.find(s=>s.id===id)||null; if(selectedSpot)statusText=`Đã chọn ${selectedSpot.name||'địa điểm'} cho kế hoạch.`;renderHub(); }
  if(action==='plan-delete') { store.remove(target.dataset.id);renderHub(); }
  if(action==='plan-edit') { activePlanId=target.dataset.id;renderHub(); q('[name="title"]',host)?.focus(); }
  if(action==='plan-cancel') { activePlanId=null;renderHub(); }
  if(action==='plan-export') exportPlans();
}
function onHubChange(event) {
  const el = event.target;
  if (el.matches('[data-device-select]')) { const index = Number(el.dataset.deviceSelect); const updated = [...selectedDevices]; updated[index] = el.value || null; selectedDevices = updated.filter(Boolean); renderHub(); }
  if (el.matches('[data-differences]')) { onlyDifferences = el.checked; renderHub(); }
  if (el.matches('[data-purpose]')) { devicePurpose = el.value; renderHub(); }
  if (el.matches('[data-device-brand]')) { deviceBrandFilter = el.value; renderHub(); }
  if (el.matches('[data-device-type]')) { deviceTypeFilter = el.value; renderHub(); }
  if (el.matches('[data-device-wifi-only]')) { localWrite('photolens_device_wifi_only', el.checked); }
  if (el.matches('[data-weather-genre]')) { chartMode = el.value; renderHub(); }
  if (el.matches('[data-bg-color]')) { localWrite('photolens_background_color', el.value); renderHub(); }
  if (el.matches('[data-outfit-style]')) { localWrite('photolens_outfit_style', el.value); renderHub(); }
}
function onHubInput(event) {
  const el = event.target;
  if (el.matches('[data-device-search]')) {
    deviceSearch = el.value; const start = el.selectionStart, end = el.selectionEnd, scrollTop = q("#plannerContent", host)?.scrollTop || 0;
    renderHub(); const next = q("[data-device-search]", host); next?.focus(); next?.setSelectionRange(start, end); const content = q("#plannerContent", host); if (content) content.scrollTop = scrollTop;
    return;
  }
  if (el.matches('[name="subject"]')) localWrite('photolens_angle_subject', el.value);
  if (el.matches('[name="scene"]')) localWrite('photolens_angle_scene', el.value);
}
async function onHubSubmit(event) {
  event.preventDefault();const form=event.target;
  if(form.dataset.form==='weather'){await searchWeather(new FormData(form).get('place').trim());return;}
  if(form.dataset.form==='angles'){const data=Object.fromEntries(new FormData(form));chartMode=data.genre;localWrite('photolens_angle_subject',data.subject);localWrite('photolens_angle_scene',data.scene);renderHub();return;}
  if(form.dataset.form==='plan'){
    const data=Object.fromEntries(new FormData(form));const item=store.save({...data,device:data.device||null,selectedSpot:selectedSpot?.id||null});
    if(!item){statusText='Không lưu được. Bộ nhớ thiết bị có thể đã đầy.';renderHub();return;}
    activePlanId=null;statusText='Đã lưu kế hoạch trên thiết bị này.';renderHub();return;
  }
}

function addUserDevice() {
  const brand=prompt('Hãng thiết bị:');if(!brand)return;const model=prompt('Tên mẫu:');if(!model)return;const type=prompt('Loại (phone, mirrorless, dslr, compact, action-camera):','phone')||'phone';
  const specs=prompt('Có thể nhập JSON thông số đã xác minh (để trống nếu chưa có):','');let additional={};
  if(specs?.trim()){try{additional=JSON.parse(specs);if(!additional||typeof additional!=='object'||Array.isArray(additional))throw new Error();}catch{alert('JSON không hợp lệ. Thiết bị chưa được lưu.');return;}}
  const devices=localRead('photolens_my_devices_v1',[]);const id=`my-${Date.now()}`;devices.push({id,brand:brand.trim(),model:model.trim(),type,verified:false,userCreated:true,sourceUrl:null,checkedAt:new Date().toISOString().slice(0,10),note:'Thông số do người dùng nhập; PhotoLens không xác minh độc lập.',...additional});
  if(!localWrite('photolens_my_devices_v1',devices)){alert('Không lưu được thiết bị.');return;}selectedDevices=[...selectedDevices,id].slice(-3);renderHub();
}
function editUserDevice(id) {
  const devices=localRead('photolens_my_devices_v1',[]);const index=devices.findIndex(d=>d.id===id);if(index<0)return;const current=devices[index];
  const raw=prompt('Sửa thông tin thiết bị dạng JSON. Kiểm tra lại nguồn trước khi nhập.',JSON.stringify(current,null,2));if(!raw)return;
  try{const next=JSON.parse(raw);if(!next||next.id!==id||typeof next.brand!=='string'||typeof next.model!=='string')throw new Error();next.verified=false;next.userCreated=true;devices[index]=next;if(!localWrite('photolens_my_devices_v1',devices))throw new Error();renderHub();}catch{alert('Không lưu được. Hãy giữ id, brand, model hợp lệ trong JSON.');}
}
async function exportPlans() {
  const plans=store.list();if(!plans.length){alert('Chưa có kế hoạch để xuất.');return;}
  const blob=new Blob([JSON.stringify(plans,null,2)],{type:'application/json'});const file=new File([blob],'PhotoLens-ke-hoach-chup.json',{type:blob.type});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:'Kế hoạch chụp PhotoLens',files:[file]});return;}}catch{}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

