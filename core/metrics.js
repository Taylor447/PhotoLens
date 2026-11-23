// Các thuật toán độc lập nền tảng, chạy trên ImageData trong Web Worker.
import { calculateScores, SCORE_CONFIG } from './config.js';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function analyzePixels({ data, width, height, fileSize = 0 }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !data || data.length < width * height * 4) {
    throw new Error('Dữ liệu pixel hoặc kích thước ảnh không hợp lệ.');
  }
  const histR = new Array(256).fill(0), histG = new Array(256).fill(0), histB = new Array(256).fill(0), histY = new Array(256).fill(0);
  let sumY = 0, sumY2 = 0, sumSat = 0, clipped = 0, crushed = 0, warm = 0, cool = 0;
  const pixels = [];
  const step = Math.max(1, Math.floor((width * height) / 60000));
  let ordinal = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = Math.round(.2126 * r + .7152 * g + .0722 * b);
    histR[r]++; histG[g]++; histB[b]++; histY[y]++;
    sumY += y; sumY2 += y * y;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    sumSat += max === 0 ? 0 : (max - min) / max;
    if (r >= 250 && g >= 250 && b >= 250) clipped++;
    if (r <= 6 && g <= 6 && b <= 6) crushed++;
    if (ordinal % step === 0) pixels.push([r, g, b]);
    ordinal++; n++;
    warm += Math.max(0, r - b); cool += Math.max(0, b - r);
  }
  if (n === 0) throw new Error('Ảnh không có pixel để phân tích.');
  const mean = sumY / n;
  const contrast = Math.sqrt(Math.max(0, sumY2 / n - mean * mean));
  const sharp = laplacianVariance(data, width, height);
  const palette = kMeans(pixels, 5, 9);
  const temp = warm + cool === 0 ? 0 : (warm - cool) / (warm + cool);
  const luma = [...histY];
  const clippedPercent = clipped / n * 100, crushedPercent = crushed / n * 100;
  const saturationPercent = sumSat / n * 100;
  const noiseEstimate = estimateNoise(data, width, height);
  const normalizedScores = calculateScores({
    meanBrightness: mean, clippedPercent, crushedPercent, contrast,
    saturation: saturationPercent, sharpnessVariance: sharp,
    noiseValue: noiseEstimate.value, megapixels: width * height / 1e6
  });
  const [exposureScore, contrastScore, colorScore, sharpScore, detailScore] = [
    normalizedScores.exposure, normalizedScores.contrast, normalizedScores.color,
    normalizedScores.sharpness, normalizedScores.detail
  ];
  return {
    width, height, aspectRatio: width / height, fileSize,
    meanBrightness: round(mean, 1), contrast: round(contrast, 1), saturation: round(saturationPercent, 1),
    sharpness: round(sharp, 2), sharpnessScore: sharpScore,
    noiseEstimate, noiseScore: normalizedScores.noise,
    highlightsClipped: round(clippedPercent, 2), shadowsCrushed: round(crushedPercent, 2),
    colorTemperature: temp > .08 ? 'Ấm' : temp < -.08 ? 'Lạnh' : 'Trung tính',
    temperatureBias: round(temp * 100, 1), palette,
    histogram: { r: histR, g: histG, b: histB, y: luma },
    normalizedScores, technicalScore: normalizedScores.total,
    localScores: [exposureScore, contrastScore, colorScore, sharpScore, detailScore]
  };
}

function laplacianVariance(data, w, h) {
  if (w < 3 || h < 3) return 0;
  let sum = 0, sum2 = 0, count = 0;
  const stride = Math.max(1, Math.floor(Math.sqrt((w * h) / 60000)));
  const yAt = (x, y) => .2126 * data[(y * w + x) * 4] + .7152 * data[(y * w + x) * 4 + 1] + .0722 * data[(y * w + x) * 4 + 2];
  for (let y = 1; y < h - 1; y += stride) for (let x = 1; x < w - 1; x += stride) {
    const v = 4 * yAt(x, y) - yAt(x - 1, y) - yAt(x + 1, y) - yAt(x, y - 1) - yAt(x, y + 1);
    sum += v; sum2 += v * v; count++;
  }
  return Math.max(0, sum2 / count - (sum / count) ** 2);
}

function estimateNoise(data, w, h) {
  let sum = 0, sum2 = 0, count = 0;
  const stride = Math.max(3, Math.floor(Math.sqrt(w * h / 30000)));
  const yAt = (x, y) => .2126 * data[(y * w + x) * 4] + .7152 * data[(y * w + x) * 4 + 1] + .0722 * data[(y * w + x) * 4 + 2];
  for (let y = 1; y < h - 1; y += stride) for (let x = 1; x < w - 1; x += stride) {
    const lap = 4 * yAt(x, y) - yAt(x - 1, y) - yAt(x + 1, y) - yAt(x, y - 1) - yAt(x, y + 1);
    sum += Math.abs(lap); sum2 += lap * lap; count++;
  }
  const val = count ? Math.sqrt(sum2 / count) * .45 : 0;
  return { value: round(val, 1), level: val < 5 ? 'Thấp' : val < 12 ? 'Vừa' : 'Cao' };
}

function kMeans(samples, k, iterations) {
  if (!samples.length) return [];
  const centers = [];
  for (let i = 0; i < k; i++) centers.push([...samples[Math.floor(i * (samples.length - 1) / Math.max(1, k - 1))]]);
  const assignments = new Uint8Array(samples.length);
  for (let it = 0; it < iterations; it++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      let best = 0, dist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = colorDistance(samples[i], centers[c]);
        if (d < dist) { dist = d; best = c; }
      }
      assignments[i] = best;
      sums[best][0] += samples[i][0]; sums[best][1] += samples[i][1]; sums[best][2] += samples[i][2]; sums[best][3]++;
    }
    for (let c = 0; c < k; c++) if (sums[c][3]) centers[c] = sums[c].slice(0, 3).map(v => Math.round(v / sums[c][3]));
  }
  const counts = new Array(k).fill(0);
  assignments.forEach(c => counts[c]++);
  return centers.map((rgb, i) => ({ rgb, hex: '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join(''), percent: round(counts[i] / samples.length * 100, 1) })).sort((a, b) => b.percent - a.percent);
}
function colorDistance(a, b) { return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; }
function round(n, digits) { const p = 10 ** digits; return Math.round(n * p) / p; }

export const scoreLabels = ['Ánh sáng', 'Tương phản', 'Màu sắc', 'Độ nét', 'Chi tiết'];
export function metricRows(a, b) {
  const quality = (m) => m.normalizedScores || {
    noise: m.noiseScore ?? Math.max(0, Math.round(100 - (m.noiseEstimate?.value || 0) * 5)),
    highlights: Math.max(0, Math.round(100 - (m.highlightsClipped || 0) * SCORE_CONFIG.thresholds.detailLossPenaltyPerPercent)),
    shadows: Math.max(0, Math.round(100 - (m.shadowsCrushed || 0) * SCORE_CONFIG.thresholds.detailLossPenaltyPerPercent))
  };
  const qa = quality(a), qb = b ? quality(b) : null;
  const rows = [
    ['Độ phân giải', `${a.width} × ${a.height}`, b ? `${b.width} × ${b.height}` : '', a.width * a.height / 1e6, b ? b.width * b.height / 1e6 : null, 'higher'],
    ['Tỉ lệ khung hình', `${a.aspectRatio.toFixed(2)}:1`, b ? `${b.aspectRatio.toFixed(2)}:1` : '', a.aspectRatio, b?.aspectRatio, 'neutral'],
    ['Dung lượng', formatBytes(a.fileSize), b ? formatBytes(b.fileSize) : '', a.fileSize / 1024 ** 2, b ? b.fileSize / 1024 ** 2 : null, 'lower'],
    ['Độ sáng trung bình', `${a.meanBrightness}/255`, b ? `${b.meanBrightness}/255` : '', a.meanBrightness, b?.meanBrightness, 'neutral'],
    ['Độ tương phản', a.contrast, b?.contrast ?? '', a.contrast, b?.contrast, 'neutral'],
    ['Độ bão hòa', `${a.saturation}%`, b ? `${b.saturation}%` : '', a.saturation, b?.saturation, 'neutral'],
    ['Độ nét (Laplacian)', a.sharpness, b?.sharpness ?? '', a.sharpness, b?.sharpness, 'higher'],
    ['Nhiễu ước lượng', `${a.noiseEstimate.level} (${a.noiseEstimate.value})`, b ? `${b.noiseEstimate.level} (${b.noiseEstimate.value})` : '', a.noiseEstimate.value, b?.noiseEstimate.value, 'lower'],
    ['Điểm chất lượng nhiễu', `${qa.noise}/100`, b ? `${qb.noise}/100` : '', qa.noise, qb?.noise, 'higher'],
    ['Điểm giữ vùng sáng', `${qa.highlights}/100`, b ? `${qb.highlights}/100` : '', qa.highlights, qb?.highlights, 'higher'],
    ['Điểm giữ vùng tối', `${qa.shadows}/100`, b ? `${qb.shadows}/100` : '', qa.shadows, qb?.shadows, 'higher'],
    ['Điểm tổng kỹ thuật', `${a.technicalScore}/100`, b ? `${b.technicalScore}/100` : '', a.technicalScore, b?.technicalScore, 'higher'],
    ['Vùng cháy sáng', `${a.highlightsClipped}%`, b ? `${b.highlightsClipped}%` : '', a.highlightsClipped, b?.highlightsClipped, 'lower'],
    ['Vùng tối mất chi tiết', `${a.shadowsCrushed}%`, b ? `${b.shadowsCrushed}%` : '', a.shadowsCrushed, b?.shadowsCrushed, 'lower'],
    ['Nhiệt độ màu', a.colorTemperature, b?.colorTemperature ?? '', null, null, 'neutral']
  ];
  return rows.map(([label, av, bv, an, bn, direction]) => ({ label, a: av, b: bv, diff: an == null || bn == null ? '—' : formatDiff(an - bn, label), winner: an == null || bn == null ? '—' : Math.abs(an - bn) < .01 ? 'tie' : direction === 'neutral' ? '—' : ((an > bn) === (direction === 'higher') ? 'A' : 'B') }));
}
function formatDiff(n, label) {
  const unit = label === 'Độ phân giải' ? ' MP' : label === 'Dung lượng' ? ' MB' : ['Vùng cháy sáng','Vùng tối mất chi tiết'].includes(label) ? ' pp' : '';
  return `${n > 0 ? '+' : ''}${Number(n.toFixed(2))}${unit}`;
}
export function formatBytes(n = 0) { if (n < 1024) return `${n} B`; if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`; return `${(n / 1024 ** 2).toFixed(2)} MB`; }

