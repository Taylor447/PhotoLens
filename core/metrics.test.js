import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzePixels, metricRows } from './metrics.js';
import { calculateScores, SCORE_CONFIG } from './config.js';

function fixture(name) {
  const png = readFileSync(resolve('tests/fixtures', name + '.png'));
  let width = 0, height = 0, offset = 8; const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset); const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)); const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1); if (raw[row] !== 0) throw new Error('Fixture must use PNG filter 0.');
    data.set(raw.subarray(row + 1, row + 1 + width * 4), y * width * 4);
  }
  return { data, width, height, fileSize: png.length };
}

function metrics(name) { return analyzePixels(fixture(name)); }

describe('core technical metrics', () => {
  it('measures brightness for dark and bright fixtures', () => {
    expect(metrics('dark').meanBrightness).toBe(12);
    expect(metrics('bright').meanBrightness).toBe(248);
  });

  it('gives a structured image higher contrast and sharpness than a blurred image', () => {
    const sharp = metrics('sharp'), blur = metrics('blur');
    expect(sharp.contrast).toBeGreaterThan(blur.contrast);
    expect(sharp.sharpness).toBeGreaterThan(blur.sharpness);
  });

  it('estimates noise in the noisy fixture above a flat field', () => {
    expect(metrics('noise').noiseEstimate.value).toBeGreaterThan(metrics('dark').noiseEstimate.value);
  });

  it('returns five palette swatches for a five-color image', () => {
    expect(metrics('palette').palette).toHaveLength(5);
  });

  it('keeps every normalized score in the 0–100 range and weights total predictably', () => {
    const score = calculateScores({ meanBrightness: 128, clippedPercent: 0, crushedPercent: 0, contrast: 58, saturation: 38, sharpnessVariance: 450, noiseValue: 0, megapixels: 12 });
    expect(Object.values(score).every(value => Number.isFinite(value) && value >= 0 && value <= 100)).toBe(true);
    expect(score.total).toBe(89);
    expect(Object.values(SCORE_CONFIG.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('assigns ties for identical images in comparison rows', () => {
    const image = metrics('sharp');
    expect(metricRows(image, image).filter(row => row.winner !== '—').every(row => row.winner === 'tie')).toBe(true);
  });

  it('rejects malformed pixel data instead of generating NaN metrics', () => {
    expect(() => analyzePixels({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toThrow();
  });
});
