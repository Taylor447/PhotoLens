// Ngưỡng quy đổi tham khảo cho ảnh đã thu nhỏ cạnh dài tối đa 1024 px.
// Đây là điểm chất lượng kỹ thuật tương đối, không thay cho đánh giá nghệ thuật.
export const SCORE_CONFIG = Object.freeze({
  version: 1,
  maxAnalysisSide: 1024,
  weights: Object.freeze({
    exposure: 0.26,
    contrast: 0.15,
    color: 0.16,
    sharpness: 0.29,
    detail: 0.14
  }),
  thresholds: Object.freeze({
    brightnessTarget: 128,
    brightnessPenaltyPerLevel: 0.68,
    highlightReferencePercent: 2,
    highlightPenaltyPerPercent: 2,
    contrastTargetStdDev: 58,
    contrastPenaltyPerStdDev: 0.7,
    saturationTargetPercent: 38,
    saturationPenaltyPerPercent: 0.55,
    sharpnessVarianceAtScore63: 450,
    detailLossPenaltyPerPercent: 3.5,
    noiseValueAtZeroScore: 20,
    resolutionMegapixelsAtFullScore: 12
  })
});

export function calculateScores({ meanBrightness, clippedPercent, crushedPercent, contrast, saturation, sharpnessVariance, noiseValue, megapixels }) {
  const t = SCORE_CONFIG.thresholds;
  const clamp = (value) => Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const scores = {
    // Độ sáng tối ưu đạt 100; chỉ phạt vùng cháy vượt ngưỡng tham khảo.
    exposure: clamp(100 - Math.abs(meanBrightness - t.brightnessTarget) * t.brightnessPenaltyPerLevel - Math.max(0, clippedPercent - t.highlightReferencePercent) * t.highlightPenaltyPerPercent),
    contrast: clamp(100 - Math.abs(contrast - t.contrastTargetStdDev) * t.contrastPenaltyPerStdDev),
    color: clamp(100 - Math.abs(saturation - t.saturationTargetPercent) * t.saturationPenaltyPerPercent),
    sharpness: clamp(100 * (1 - Math.exp(-Math.max(0, sharpnessVariance) / t.sharpnessVarianceAtScore63))),
    detail: clamp(100 - (clippedPercent + crushedPercent) * t.detailLossPenaltyPerPercent),
    noise: clamp(100 * (1 - Math.max(0, noiseValue) / t.noiseValueAtZeroScore)),
    highlights: clamp(100 - clippedPercent * t.detailLossPenaltyPerPercent),
    shadows: clamp(100 - crushedPercent * t.detailLossPenaltyPerPercent),
    resolution: clamp(Math.min(1, megapixels / t.resolutionMegapixelsAtFullScore) * 100)
  };
  const weighted = Object.entries(SCORE_CONFIG.weights).reduce((sum, [key, weight]) => sum + scores[key] * weight, 0);
  return { ...scores, total: clamp(weighted) };
}
