const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const numberOrNull = value => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null;

export function compareDeviceFields(devices, paths, onlyDifferences = false) {
  const read = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  return paths.map(({ path, label, unit = '' }) => {
    const values = devices.map(device => read(device, path));
    const known = values.filter(value => value !== null && value !== undefined && value !== '');
    const different = known.length > 1 && new Set(known.map(value => JSON.stringify(value))).size > 1;
    return { path, label, unit, values, different };
  }).filter(row => !onlyDifferences || row.different);
}

export function scoreDevice(device, purpose, config) {
  const weights = config?.purposes?.[purpose];
  if (!weights || !device) return { score: null, used: [], missing: [] };
  let total = 0, weightTotal = 0;
  const used = [], missing = [];
  for (const [path, definition] of Object.entries(weights)) {
    const value = path.split('.').reduce((object, key) => object?.[key], device);
    const numeric = numberOrNull(value);
    if (numeric === null || !Number.isFinite(definition.min) || !Number.isFinite(definition.max) || definition.max <= definition.min) {
      missing.push(path); continue;
    }
    let normalized = clamp(((numeric - definition.min) / (definition.max - definition.min)) * 100);
    if (definition.direction === 'lower') normalized = 100 - normalized;
    total += normalized * definition.weight;
    weightTotal += definition.weight;
    used.push({ path, value: numeric, score: Math.round(normalized), weight: definition.weight });
  }
  return { score: weightTotal > 0 && used.length >= 2 ? Math.round(total / weightTotal) : null, used, missing };
}

const WEATHER_WEIGHTS = Object.freeze({
  portrait: { rain: .30, wind: .20, clouds: .18, visibility: .14, uv: .10, pm25: .08 },
  landscape: { rain: .24, wind: .14, clouds: .22, visibility: .24, uv: .08, pm25: .08 },
  architecture: { rain: .25, wind: .10, clouds: .20, visibility: .25, uv: .12, pm25: .08 },
  street: { rain: .25, wind: .14, clouds: .18, visibility: .23, uv: .10, pm25: .10 },
  night: { rain: .24, wind: .13, clouds: .30, visibility: .19, uv: .04, pm25: .10 },
  moon: { rain: .20, wind: .10, clouds: .40, visibility: .20, uv: .02, pm25: .08 }
});

export function scorePhotoConditions(values, genre = 'portrait') {
  const weights = WEATHER_WEIGHTS[genre] || WEATHER_WEIGHTS.portrait;
  const cloud = numberOrNull(values?.cloudCover);
  const factors = {
    rain: values?.rainProbability == null ? null : 100 - clamp(values.rainProbability) * .9,
    wind: values?.windSpeed == null ? null : 100 - clamp((values.windSpeed - 5) * 3, 0, 70),
    clouds: cloud == null ? null : (genre === 'night' || genre === 'moon' ? 100 - cloud : 100 - Math.abs(cloud - (genre === 'portrait' ? 35 : 25)) * .8),
    visibility: values?.visibility == null ? null : clamp((values.visibility / 10000) * 100),
    uv: values?.uvIndex == null ? null : 100 - clamp((values.uvIndex - 4) * 8, 0, 60),
    pm25: values?.pm25 == null ? null : 100 - clamp((values.pm25 - 5) * 1.2, 0, 70)
  };
  const present = Object.keys(weights).filter(key => factors[key] !== null && Number.isFinite(factors[key]));
  const totalWeight = present.reduce((sum, key) => sum + weights[key], 0);
  if (present.length < 2 || totalWeight <= 0) return { score: null, factors, explanation: 'Chưa có đủ dữ liệu thời tiết để tính điều kiện chụp.' };
  const score = Math.round(present.reduce((sum, key) => sum + factors[key] * weights[key], 0) / totalWeight);
  const labels = { rain: 'mưa', wind: 'gió', clouds: 'mây', visibility: 'tầm nhìn', uv: 'UV', pm25: 'PM2.5' };
  const sorted = present.map(key => [key, factors[key]]).sort((a, b) => a[1] - b[1]);
  const weakest = sorted[0], strongest = sorted.at(-1);
  return {
    score, factors,
    explanation: `Điểm ${score}/100 dựa trên ${present.map(key => labels[key]).join(', ')}. Yếu tố cần lưu ý nhất: ${labels[weakest[0]]}; thuận lợi nhất: ${labels[strongest[0]]}. Đây là điểm tham khảo theo công thức PhotoLens, không phải dự báo chắc chắn.`
  };
}

export function bestForecastHours(hourly, genre = 'portrait', pmByHour = {}, utcOffsetSeconds = null) {
  if (!Array.isArray(hourly?.time)) return [];
  const now = Date.now();
  return hourly.time.map((time, index) => {
    // Open-Meteo returns local wall-clock times without an offset unless timeformat is changed.
    const timestamp = Number.isFinite(utcOffsetSeconds) ? Date.parse(`${time}Z`) - utcOffsetSeconds * 1000 : Date.parse(time);
    if (!Number.isFinite(timestamp) || timestamp < now) return null;
    const score = scorePhotoConditions({
      rainProbability: hourly.precipitation_probability?.[index],
      windSpeed: hourly.wind_speed_10m?.[index],
      cloudCover: hourly.cloud_cover?.[index],
      visibility: hourly.visibility?.[index],
      uvIndex: hourly.uv_index?.[index],
      pm25: pmByHour[time]
    }, genre);
    return { time, temperature: hourly.temperature_2m?.[index] ?? null, score: score.score, explanation: score.explanation };
  }).filter(Boolean).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 8);
}

export function estimateGoldenWindows(sunrise, sunset) {
  // Preserve the local clock values supplied by the weather API regardless of the viewer's timezone.
  const parseMinutes = value => {
    const match = String(value || '').match(/T(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const rise = parseMinutes(sunrise), set = parseMinutes(sunset);
  const format = value => value == null ? null : `${String(Math.floor(((value % 1440) + 1440) % 1440 / 60)).padStart(2,'0')}:${String(((value % 1440) + 1440) % 60).padStart(2,'0')}`;
  const shift = (value, minutes) => value == null ? null : value + minutes;
  return {
    sunrise: format(rise), sunset: format(set),
    morningGolden: rise ? `${format(shift(rise, 20))}–${format(shift(rise, 80))}` : null,
    eveningGolden: set ? `${format(shift(set, -80))}–${format(shift(set, -20))}` : null,
    morningBlue: rise ? `${format(shift(rise, -50))}–${format(shift(rise, -20))}` : null,
    eveningBlue: set ? `${format(shift(set, 20))}–${format(shift(set, 50))}` : null,
    estimated: true
  };
}

export function suggestAngles(genre, subject = 'chủ thể', scene = '') {
  const common = [
    { name: 'Ngang tầm mắt', height: 'Ngang mắt chủ thể', distance: 'Lùi đủ để giữ viền khung thoáng', lens: 'Tiêu cự trung bình; chân dung ưu tiên khoảng 50–85 mm quy đổi nếu thiết bị có', composition: 'Đặt mắt gần đường 1/3 trên; chừa khoảng nhìn', direction: `Xoay vai nhẹ, giữ ${subject} thoải mái, chụp vài khung ở nhịp thở tự nhiên.`, avoid: 'Đứng quá gần ống kính góc rộng vì có thể làm méo phối cảnh.' },
    { name: 'Góc thấp nhẹ', height: 'Thấp hơn mắt khoảng 20–40 cm', distance: 'Tăng khoảng cách nếu dùng góc rộng', lens: 'Tiêu cự vừa; kiểm tra đường dọc trước khi chụp', composition: 'Đưa tiền cảnh vào 1/3 dưới, giữ đường chân trời thẳng', direction: `Để ${subject} chiếm một vùng rõ ràng, tránh vật thể nền mọc khỏi đầu.`, avoid: 'Không ngửa máy quá nhiều khi chụp kiến trúc.' },
    { name: 'Góc cao vừa', height: 'Cao hơn mắt khoảng 30–60 cm', distance: 'Đứng xa hơn một bước để tránh cắt khớp', lens: 'Tiêu cự trung bình hoặc tele quang học nếu thiết bị có', composition: 'Dùng đường dẫn và khoảng trống để tách chủ thể khỏi nền', direction: `Thử nhìn về phía nguồn sáng; nếu ${scene || 'bối cảnh'} rối, đổi nền trước khi đổi góc.`, avoid: 'Tránh chụp quá cao làm đầu lớn và chân ngắn.' }
  ];
  if (genre === 'architecture') return common.map((item, i) => ({ ...item, name: ['Chính diện cân trục', 'Góc chéo có kiểm soát', 'Từ cao nhìn mặt bằng'][i], lens: 'Giữ đường thẳng đứng; dùng lưới và cân bằng máy; tiêu cự/camera cụ thể tùy thiết bị', avoid: 'Tránh nghiêng máy lên/xuống; không giả định thiết bị có hiệu chỉnh phối cảnh.' }));
  if (genre === 'moon') return common.map(item => ({ ...item, lens: 'Dùng tiêu cự dài nhất có thể; zoom số làm giảm chi tiết', direction: 'Đặt máy cố định, chụp nhiều lần và xem histogram; thông số phơi sáng phụ thuộc pha trăng và thiết bị.' }));
  return common;
}

export function suggestOutfits({ temperature, precipitation, wind, style = 'Tự nhiên', background = '#56736f' } = {}) {
  const temp = numberOrNull(temperature), rain = numberOrNull(precipitation), windSpeed = numberOrNull(wind);
  const bg = /^#[0-9a-f]{6}$/i.test(background) ? background : '#56736f';
  const rgb = bg.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16));
  const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  const neutrals = luminance < 128 ? ['kem', 'xanh nhạt', 'vàng đất'] : ['xanh navy', 'nâu cacao', 'đỏ gạch'];
  const weather = temp == null ? 'Chưa có dữ liệu nhiệt độ.' : temp >= 28 ? 'Ưu tiên vải thoáng, ít nhăn; đội mũ khi nắng.' : temp <= 14 ? 'Mặc nhiều lớp mỏng, giữ ấm cổ và tay.' : 'Chọn một lớp ngoài nhẹ để dễ điều chỉnh.';
  const rainNote = rain != null && rain >= 40 ? 'Mang áo khoác chống mưa mỏng; tránh phụ kiện dễ hỏng khi ướt.' : '';
  const windNote = windSpeed != null && windSpeed >= 25 ? 'Gió mạnh: cố định tóc/phụ kiện và ưu tiên trang phục ít bay.' : '';
  const palettes = [neutrals, ['trắng ngà', 'xanh cobalt', 'xám than'], ['đỏ rượu', 'kem', 'xanh rêu']];
  const labels = [style, 'Tương phản rõ', 'Phim nhẹ'];
  return palettes.map((colors, index) => ({
    name: labels[index], colors,
    clothes: index === 0 ? 'Áo trơn + quần hoặc váy màu trung tính; thêm một lớp ngoài có texture.' : index === 1 ? 'Một món màu nhấn, phần còn lại giữ trung tính.' : 'Phối hai tông trầm và một màu sáng làm điểm nhấn.',
    accessories: index === 1 ? 'Một phụ kiện nhỏ; tránh bề mặt phản quang.' : 'Phụ kiện đơn giản, không lấn chủ thể.',
    reason: `Bảng màu tạo độ tách khỏi nền ${bg} mà không dựa trên ngoại hình người mặc.`,
    caution: `Tránh kẻ sọc li ti (moiré), màu trùng nền và trắng tinh dưới nắng gắt. ${[weather, rainNote, windNote].filter(Boolean).join(' ')}`
  }));
}

export function planStore(storage = globalThis.localStorage) {
  const key = 'photolens_shoot_plans_v1';
  const read = () => { try { const value = JSON.parse(storage?.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const write = plans => { try { storage?.setItem(key, JSON.stringify(plans)); return true; } catch { return false; } };
  return {
    list: read,
    save(plan) { const plans = read(); const item = { ...plan, id: plan.id || crypto.randomUUID(), updatedAt: new Date().toISOString() }; const index = plans.findIndex(p => p.id === item.id); index < 0 ? plans.unshift(item) : plans.splice(index, 1, item); return write(plans) ? item : null; },
    remove(id) { return write(read().filter(plan => plan.id !== id)); }
  };
}

export function escapeText(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
