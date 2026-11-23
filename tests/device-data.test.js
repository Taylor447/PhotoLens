import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDeviceCoverage, searchDeviceCatalog, changedManifestFiles, compareCameraModuleFields, mergeCatalogDelta, shouldCheckDeviceManifest } from '../core/device-catalog.js';
import { csvRows, parseLensfunCameras, schemaValidator, simpleYaml, validateDevices } from '../scripts/device-data.mjs';

const official = [{ id: 'maker', type: 'official-manufacturer', url: 'https://example.com/specs', urls: ['https://example.com/specs'] }];
const factSource = { sourceId: 'maker', url: 'https://example.com/specs', retrievedAt: '2026-11-23', license: 'facts only', extractedBy: 'manual', verified: true };
const device = (overrides = {}) => ({
  schemaVersion: 2, id: 'samsung-s21-ultra', brand: 'Samsung', model: 'Galaxy S21 Ultra 5G', aliases: ['SM-G998'], type: 'phone',
  releaseDate: null, status: null, regions: [], variants: [], cameraModules: [], verified: true,
  sensor: { megapixels: 108, provenance: factSource }, lens: {}, focus: {}, video: {}, durability: {}, power: {},
  provenance: { brand: factSource, model: factSource, aliases: factSource, type: factSource }, ...overrides
});

test('search finds exact alias, brand/model and small typos in a stable order', () => {
  const entries = [device(), { ...device(), id: 'apple-iphone-15-pro', brand: 'Apple', model: 'iPhone 15 Pro', aliases: [] }];
  assert.equal(searchDeviceCatalog(entries, 'SM-G998')[0].id, 'samsung-s21-ultra');
  assert.equal(searchDeviceCatalog(entries, 'S21 Ulra')[0].id, 'samsung-s21-ultra');
  assert.deepEqual(searchDeviceCatalog(entries, 'iphone', { brand: 'Apple' }).map(x => x.id), ['apple-iphone-15-pro']);
});

test('coverage excludes unknown values and reports verified field share separately', () => {
  const result = computeDeviceCoverage([device()]);
  assert.equal(result.deviceCount, 1);
  assert.equal(result.populatedFields, 1);
  assert.equal(result.verifiedFields, 1);
  assert.equal(result.fieldCoveragePercent, Number((1 / result.totalFields * 100).toFixed(1)));
});

test('camera comparison separates repeated tele modules and omits absent values', () => {
  const rows = compareCameraModuleFields([
    { cameraModules: [{ role: 'tele', megapixels: 50, opticalZoom: 5 }, { role: 'tele', megapixels: 10, opticalZoom: 3 }] },
    { cameraModules: [{ role: 'tele', megapixels: 48, opticalZoom: 5 }] }
  ]);
  assert.equal(rows.find(row => row.path === 'cameraModules.tele.0.megapixels').different, true);
  assert.equal(rows.find(row => row.path === 'cameraModules.tele.1.megapixels').values[1], null);
  assert.equal(compareCameraModuleFields([{ cameraModules: [{ role: 'main', megapixels: 50 }] }, { cameraModules: [{ role: 'main', megapixels: 50 }] }], true).length, 0);
});

test('manifest diff fetches only hashes that changed', () => {
  assert.deepEqual(changedManifestFiles({ 'devices/a.json': 'old', 'index.json': 'same' }, { 'devices/a.json': 'new', 'index.json': 'same', 'devices/b.json': 'new' }), ['devices/a.json', 'devices/b.json']);
});

test('catalog delta follows the new index and drops removed records', () => {
  const result = mergeCatalogDelta([device(), { ...device(), id: 'old-device' }], [{ id: 'samsung-s21-ultra' }, { id: 'new-device' }], { 'new-device': { id: 'new-device' } });
  assert.deepEqual(result.map(x => x.id), ['samsung-s21-ultra', 'new-device']);
});

test('daily manifest check is rate-limited but can retry stale timestamps', () => {
  const now = Date.parse('2026-11-23T00:00:00Z');
  assert.equal(shouldCheckDeviceManifest('2026-11-22T12:00:00Z', now), false);
  assert.equal(shouldCheckDeviceManifest('2026-11-21T23:59:00Z', now), true);
  assert.equal(shouldCheckDeviceManifest(null, now), true);
});

test('CSV import handles quoted commas and doubled quotes', () => {
  assert.deepEqual(csvRows('brand,model,note\nSony,"Alpha 6400","Works, with ""quotes"""'), [
    { brand: 'Sony', model: 'Alpha 6400', note: 'Works, with "quotes"' }
  ]);
});

test('override YAML accepts only its explicit id/set subset', () => {
  assert.deepEqual(simpleYaml('id: sony-a6400\nset:\n  power.weightG: 403\n  sensor.raw: true'), { id: 'sony-a6400', set: { 'power.weightG': 403, 'sensor.raw': true } });
  assert.throws(() => simpleYaml('id: sony-a6400\nother:\n  unexpected: true'), /chỉ hỗ trợ/i);
});

test('Lensfun extraction preserves attribution, mount and source confidence', () => {
  const rows = parseLensfunCameras('<database><camera><maker>Sony</maker><model>ILCE-6400</model><model lang="en">Alpha 6400</model><mount>Sony E</mount><cropfactor>1.534</cropfactor></camera></database>', { sourceId: 'lensfun', url: 'https://github.com/lensfun/lensfun/blob/abc/data/db/mil-sony.xml', retrievedAt: '2026-11-23', license: 'CC BY-SA 3.0', extractedBy: 'pipeline' });
  assert.deepEqual(rows.map(({ brand, model, aliases, mount, cropFactor }) => ({ brand, model, aliases, mount, cropFactor })), [{ brand: 'Sony', model: 'ILCE-6400', aliases: ['Alpha 6400'], mount: 'Sony E', cropFactor: 1.534 }]);
  assert.equal(rows[0].provenance.verified, false);
  assert.equal(rows[0].provenance.license, 'CC BY-SA 3.0');
});

test('verification requires an official source or two independent sources', () => {
  const openSource = { id: 'open', type: 'open-data', url: 'https://example.com/specs', urls: ['https://example.com/specs'] };
  const independentSource = { id: 'open-two', type: 'open-data', url: 'https://other.example.org/specs', urls: ['https://other.example.org/specs'] };
  const bad = device({ sensor: { megapixels: 108, provenance: { ...factSource, sourceId: 'open' } } });
  assert.match(validateDevices([bad], [...official, openSource]).join('\n'), /cannot be verified/);
  const corroborated = device({ sensor: { megapixels: 108, provenance: { ...factSource, sourceId: 'open', alternatives: [{ sourceId: 'open-two' }] } } });
  assert.deepEqual(validateDevices([corroborated], [...official, openSource, independentSource]), []);
  assert.deepEqual(validateDevices([device()], official), []);
});

test('JSON Schema v2 accepts the documented record and rejects missing required fields and invalid dates', () => {
  assert.equal(schemaValidator(device()), true);
  const missingAliases = { ...device() }; delete missingAliases.aliases;
  assert.equal(schemaValidator(missingAliases), false);
  const invalidDate = device({ releaseDate: '2026-02-31' });
  assert.equal(schemaValidator(invalidDate), false);
  const wrongUnitType = device({ sensor: { megapixels: 'forty-eight', provenance: factSource } });
  assert.equal(schemaValidator(wrongUnitType), false);
});

test('fields with a value but without provenance fail validation', () => {
  const bad = device({ sensor: { megapixels: 48 } });
  assert.match(validateDevices([bad], official).join('\n'), /sensor có dữ liệu nhưng thiếu provenance/);
});
