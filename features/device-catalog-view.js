import { compareCameraModuleFields } from '../core/device-catalog.js';

const GROUP_LABELS = {
  sensor: 'Cảm biến', lens: 'Ống kính', focus: 'Lấy nét & chống rung', video: 'Video',
  durability: 'Độ bền', power: 'Pin, lưu trữ & kích thước', chip: 'Bộ xử lý',
  ramGB: 'RAM', storageGB: 'Bộ nhớ', display: 'Màn hình', battery: 'Pin'
};

const valueKnown = value => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);

function dataSourceState(provenance, sources) {
  if (!provenance) return { label: 'Chưa có nguồn', state: 'unverified', source: null, old: false };
  const source = sources.find(item => item.id === provenance.sourceId) || null;
  const age = Date.now() - Date.parse(`${provenance.retrievedAt}T00:00:00Z`);
  return {
    label: provenance.verified ? (source?.type === 'official-manufacturer' ? 'Nguồn chính thức · đã kiểm tra' : 'Nguồn mở · đã đối chiếu') : 'Chưa xác minh',
    state: provenance.verified ? 'verified' : 'unverified',
    source,
    old: Number.isFinite(age) && age > 180 * 24 * 60 * 60 * 1000
  };
}

function sourceLink(url, label, escapeText) {
  return /^https?:\/\//i.test(url || '')
    ? `<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : '';
}

function provenanceDetails(device, sources, escapeText) {
  const groups = Object.keys(GROUP_LABELS);
  const rows = [];
  for (const group of groups) {
    const provenance = device[group]?.provenance || device.provenance?.[group];
    const item = device[group];
    const hasFacts = item && typeof item === 'object' && !Array.isArray(item)
      ? Object.entries(item).some(([key, value]) => key !== 'provenance' && valueKnown(value))
      : valueKnown(item);
    if (!hasFacts && !provenance) continue;
    const state = dataSourceState(provenance, sources);
    rows.push(`<div class="device-provenance-row"><strong>${GROUP_LABELS[group]}</strong><span class="planner-badge ${state.state}">${state.label}</span>${state.old ? '<span class="device-data-stale">Có thể đã cũ</span>' : ''}<small>${provenance?.retrievedAt ? `Kiểm tra: ${escapeText(provenance.retrievedAt)}` : 'Chưa có ngày kiểm tra'}${state.source ? ` · ${escapeText(state.source.name)}` : ''}${provenance?.sourceFile ? ` · ${escapeText(provenance.sourceFile)}` : ''}${provenance?.license ? ` · ${escapeText(provenance.license)}` : ''}</small>${sourceLink(provenance?.url, 'Mở nguồn ↗', escapeText)}</div>`);
  }
  for (const camera of device.cameraModules || []) {
    const state = dataSourceState(camera.provenance, sources);
    rows.push(`<div class="device-provenance-row"><strong>Camera ${escapeText(camera.role || 'khác')}</strong><span class="planner-badge ${state.state}">${state.label}</span>${state.old ? '<span class="device-data-stale">Có thể đã cũ</span>' : ''}<small>${camera.provenance?.retrievedAt ? `Kiểm tra: ${escapeText(camera.provenance.retrievedAt)}` : 'Chưa có ngày kiểm tra'}${state.source ? ` · ${escapeText(state.source.name)}` : ''}</small>${sourceLink(camera.provenance?.url, 'Mở nguồn ↗', escapeText)}</div>`);
  }
  const variants = (device.variants || []).map(variant => `<li>${escapeText(variant.id)}${Object.entries(variant).filter(([key, value]) => !['id', 'regions', 'provenance'].includes(key) && valueKnown(value)).map(([key, value]) => ` · ${escapeText(key)}: ${escapeText(Array.isArray(value) ? value.join(' × ') : value)}`).join('')} <span class="planner-muted">${escapeText(variant.regions?.join(', ') || 'Khu vực chưa xác định')}</span></li>`).join('');
  const issueTitle = encodeURIComponent(`Báo sai thông số: ${device.brand} ${device.model}`);
  const issueBody = encodeURIComponent(`Thiết bị: ${device.id}\nHãng và mẫu: ${device.brand} ${device.model}\nTrường cần kiểm tra:\nNguồn tham khảo (nếu có): `);
  return `<details class="device-provenance"><summary>Nguồn, giấy phép & độ mới của dữ liệu</summary><div class="device-provenance-list">${rows.length ? rows.join('') : '<p class="planner-muted">Chưa có dữ liệu thông số hoặc provenance cho thiết bị này.</p>'}</div>${variants ? `<h5>Biến thể đã ghi nhận</h5><ul>${variants}</ul>` : ''}<a class="planner-text-button" href="https://github.com/Taylor447/PhotoLens/issues/new?title=${issueTitle}&body=${issueBody}" target="_blank" rel="noopener noreferrer">Báo sai thông số ↗</a></details>`;
}

export function renderDeviceCatalogView({ devices, selectedDevices, onlyDifferences, query, brandFilter, typeFilter, purpose, wifiOnly, coverage, meta, status, busy, sources, scoring, purposeNames, fields, searchDeviceCatalog, compareDeviceFields, scoreDevice, fmt, escapeText }) {
  const brandNames = [...new Set(devices.filter(device => !device.userCreated).map(device => device.brand))].sort((a, b) => a.localeCompare(b, 'vi'));
  const matches = searchDeviceCatalog(devices.filter(device => !device.userCreated), query, { brand: brandFilter, type: typeFilter });
  const picked = selectedDevices.map(id => devices.find(device => device.id === id)).filter(Boolean);
  const choices = [...new Map([...matches, ...picked, ...devices.filter(device => device.userCreated)].map(device => [device.id, device])).values()];
  const rows = [...compareDeviceFields(picked, fields, onlyDifferences), ...compareCameraModuleFields(picked, onlyDifferences)];
  const countByTier = meta?.counts?.byTier || devices.filter(device => !device.userCreated).reduce((result, device) => { const key = device.tier == null ? 'Chưa phân tầng' : String(device.tier); result[key] = (result[key] || 0) + 1; return result; }, {});
  const optionList = (index, empty = false) => `${empty ? '<option value="">Không chọn</option>' : ''}${choices.map(device => `<option value="${escapeText(device.id)}" ${picked[index]?.id === device.id ? 'selected' : ''}>${escapeText(device.brand)} ${escapeText(device.model)}${device.verified ? '' : ' · chưa xác minh'}</option>`).join('')}`;
  const sourceRows = sources.map(source => `<li><strong>${escapeText(source.name)}</strong> · ${escapeText(source.license)}${source.localFile ? ` | tệp: ${escapeText(source.localFile)}` : ''} · ${sourceLink(source.url, 'Nguồn ↗', escapeText) || 'Nguồn cục bộ chưa có liên kết web'}</li>`).join('');
  const version = meta?.dataVersion ? escapeText(meta.dataVersion) : 'Bộ dữ liệu nhúng';
  const builtAt = meta?.builtAt ? new Date(meta.builtAt).toLocaleDateString('vi-VN') : 'Chưa có ngày build';
  const dataStatus = status || 'Đang dùng dữ liệu nhúng sẵn; tra cứu ngoại tuyến được.';
  return `<section class="device-catalog-overview planner-card" aria-label="Tình trạng dữ liệu thiết bị">
    <div class="device-catalog-stats"><div><strong>${coverage.deviceCount}</strong><span>thiết bị trong danh mục</span></div><div><strong>${coverage.fieldCoveragePercent}%</strong><span>độ phủ trường</span></div><div><strong>${coverage.verifiedFieldPercent}%</strong><span>trường có dữ liệu đã xác minh</span></div><div><strong>${coverage.verifiedDeviceCount}/${coverage.deviceCount}</strong><span>bản ghi có dữ kiện được xác minh</span></div></div>
    <p class="planner-muted">Phiên bản ${version} · build ${escapeText(builtAt)} · Tầng 0: ${countByTier['0'] || 0} · Tầng 1: ${countByTier['1'] || 0} · Tầng 2: ${countByTier['2'] || 0} · Chưa phân tầng: ${countByTier['Chưa phân tầng'] || 0}</p>
    <p class="planner-status" role="status">${escapeText(dataStatus)}</p>
    <div class="device-data-actions"><button class="planner-secondary" data-action="device-data-update" ${busy ? 'disabled' : ''}>Kiểm tra cập nhật</button><button class="planner-secondary" data-action="device-data-full" ${busy ? 'disabled' : ''}>Tải bộ dữ liệu đầy đủ</button><button class="planner-text-button" data-action="device-data-clear" ${busy ? 'disabled' : ''}>Xóa dữ liệu đã tải</button></div><label class="planner-check"><input type="checkbox" data-device-wifi-only ${wifiOnly ? 'checked' : ''}> Chỉ cập nhật khi có Wi-Fi</label>
    <details class="device-license-list"><summary>Nguồn dữ liệu & giấy phép (${sources.length})</summary><ul>${sourceRows}</ul><p>Lensfun được giữ riêng trong tệp dẫn xuất theo CC BY-SA 3.0; Wikidata dùng CC0-1.0. Trang hãng không nêu giấy phép tái phân phối thông số riêng nên ứng dụng chỉ lưu dữ kiện kỹ thuật, không sao chép nội dung hay ảnh.</p></details>
  </section>
  <div class="planner-section-head"><div><h3>So sánh thiết bị chụp ảnh</h3><p>Chọn 2–3 mẫu. Trường thiếu dữ liệu được loại khỏi phép tính điểm, không tính thành 0.</p></div><button class="planner-secondary" data-action="device-add">+ Thiết bị của tôi</button></div>
  <section class="planner-card device-catalog-browser" aria-label="Tìm và lọc thiết bị">
    <label>Tìm theo hãng, tên máy hoặc mã model<input data-device-search list="device-catalog-suggestions" value="${escapeText(query)}" placeholder="Ví dụ: S21 Ultra, SM-G998B, ILCE-6400" autocomplete="off"><datalist id="device-catalog-suggestions">${devices.flatMap(device => [device.model, ...(device.aliases || [])]).filter(Boolean).map(alias => `<option value="${escapeText(alias)}"></option>`).join('')}</datalist></label>
    <label>Hãng<select data-device-brand><option value="">Tất cả hãng</option>${brandNames.map(brand => `<option value="${escapeText(brand)}" ${brandFilter === brand ? 'selected' : ''}>${escapeText(brand)}</option>`).join('')}</select></label>
    <label>Loại<select data-device-type><option value="">Tất cả loại</option>${Object.entries({phone:'Điện thoại',mirrorless:'Mirrorless',dslr:'DSLR',compact:'Compact',action:'Action cam',other:'Khác'}).map(([type,label]) => `<option value="${type}" ${typeFilter === type ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    <p class="planner-muted">${matches.length} kết quả phù hợp. Mẫu chưa xác minh vẫn xuất hiện, nhưng không đóng góp vào điểm cho trường thiếu nguồn.</p>
  </section>
  <div class="planner-card"><div class="planner-inline"><label>Thiết bị A<select data-device-select="0">${optionList(0)}</select></label><label>Thiết bị B<select data-device-select="1">${optionList(1)}</select></label><label>Thiết bị C (tùy chọn)<select data-device-select="2">${optionList(2,true)}</select></label></div><label class="planner-check"><input type="checkbox" data-differences ${onlyDifferences ? 'checked' : ''}> Chỉ hiện thông số đã biết và khác nhau</label><div class="planner-badges">${picked.map(device => `<span class="planner-badge ${device.verified ? 'verified' : 'unverified'}">${device.verified ? 'Có dữ kiện từ nguồn chính thức' : 'Chưa xác minh đầy đủ'} · ${escapeText(device.brand)} ${escapeText(device.model)}</span>`).join('')}</div></div>
  ${picked.length ? `<div class="planner-table-wrap"><table class="planner-table"><thead><tr><th>Yếu tố</th>${picked.map(device => `<th>${escapeText(device.brand)} ${escapeText(device.model)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th>${escapeText(row.label)}</th>${row.values.map(value => `<td>${escapeText(fmt(value, row.unit))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="planner-empty">Chọn ít nhất một thiết bị.</p>'}
  ${picked.map(device => provenanceDetails(device, sources, escapeText)).join('')}
  <div class="planner-card"><h4>Điểm theo mục đích</h4><div class="planner-inline"><label>Mục đích<select data-purpose>${Object.entries(purposeNames).map(([id, name]) => `<option value="${id}" ${purpose === id ? 'selected' : ''}>${name}</option>`).join('')}</select></label></div><p class="planner-muted">Cách tính: chuẩn hóa từng tiêu chí theo <code>data/device-scoring.json</code>; trường thiếu bị loại và trọng số còn lại được chuẩn hóa lại.</p><div class="planner-score-grid">${picked.map(device => { const result = scoreDevice(device, purpose, scoring); return `<article><strong>${escapeText(device.brand)} ${escapeText(device.model)}</strong><span class="planner-score">${result.score === null ? 'Chưa đủ dữ liệu' : `${result.score}/100`}</span><small>Dựa trên ${result.used.length}/${result.used.length + result.missing.length} tiêu chí; thiếu ${result.missing.length}</small></article>`; }).join('')}</div></div>
  <div class="planner-card"><h4>Thiết bị của tôi</h4>${devices.filter(device => device.userCreated).length ? devices.filter(device => device.userCreated).map(device => `<div class="planner-list-row"><span>${escapeText(device.brand)} ${escapeText(device.model)}</span><button class="planner-text-button" data-action="device-edit" data-id="${escapeText(device.id)}">Sửa</button><button class="planner-text-button danger" data-action="device-delete" data-id="${escapeText(device.id)}">Xóa</button></div>`).join('') : '<p class="planner-muted">Chưa có thiết bị tự thêm.</p>'}<details><summary>Cách tính điểm</summary><p>Điểm tổng hợp các tiêu chí có dữ liệu theo trọng số trong cấu hình. Trường trống không bị tính thành 0. PhotoLens không tự điền thông số máy.</p></details></div>`;
}
