import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { computeDeviceCoverage } from '../core/device-catalog.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = new Date().toISOString().slice(0, 10);
const GROUPS = ['sensor', 'lens', 'focus', 'video', 'durability', 'power'];
const TYPES = new Set(['phone', 'mirrorless', 'dslr', 'compact', 'action', 'other']);
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8'); };
const digest = value => createHash('sha256').update(value).digest('hex');
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat('date', { type: 'string', validate: value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value });
ajv.addFormat('uri', { type: 'string', validate: value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } } });
const deviceSchema = await readJson(join(ROOT, 'data/schema/device.schema.json'));
const schemaValidator = ajv.compile(deviceSchema);
const slug = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const known = value => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0);
const sourceMap = sources => new Map(sources.map(source => [source.id, source]));
function editDistance(a, b, limit = 2) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i]; let min = i;
    for (let j = 1; j <= b.length; j++) { next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); min = Math.min(min, next[j]); }
    if (min > limit) return limit + 1; row = next;
  }
  return row[b.length];
}

function csvRows(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') { value += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') { row.push(value); value = ''; }
    else if (!quoted && (ch === '\n' || ch === '\r')) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(value); value = ''; if (row.some(cell => cell !== '')) rows.push(row); row = []; }
    else value += ch;
  }
  if (quoted) throw new Error('CSV lỗi: dấu ngoặc kép chưa đóng.');
  row.push(value); if (row.some(cell => cell !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(x => x.trim());
  return rows.map(cells => Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ''])));
}

function scalar(value) {
  const v = String(value).trim();
  if (!v || /^(null|~)$/i.test(v)) return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) {
    try { return JSON.parse(v.replaceAll("'", '"')); } catch { /* keep as text */ }
  }
  return v.replace(/^(['"])(.*)\1$/, '$2');
}

// Deliberately supports a safe, documented YAML subset for overrides: top-level id and set, then flat dotted keys.
function simpleYaml(text) {
  const result = { set: {} }; let section = '';
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const match = raw.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*?)\s*$/);
    if (!match) throw new Error('Override YAML không đúng dạng key: value.');
    const [, indent, key, value] = match;
    if (!indent && key === 'set' && !value) { section = 'set'; continue; }
    if (indent && section === 'set') result.set[key] = scalar(value);
    else if (!indent) result[key] = scalar(value);
    else throw new Error('Override YAML chỉ hỗ trợ id và set với các khóa dạng field.path.');
  }
  if (!result.id || !Object.keys(result.set).length) throw new Error('Mỗi override cần id và ít nhất một trường trong set.');
  return result;
}

function setPath(target, path, value) {
  const parts = path.split('.'); let node = target;
  for (const part of parts.slice(0, -1)) node = node[part] ||= {};
  node[parts.at(-1)] = value;
}

function parseImport(input, extension) {
  if (extension === '.csv') return csvRows(input).map(row => {
    const record = {};
    for (const [path, raw] of Object.entries(row)) {
      if (raw === '') continue;
      let value = scalar(raw);
      if (['aliases', 'regions'].includes(path) && typeof value === 'string') value = value.split(';').map(part => part.trim()).filter(Boolean);
      if (path.includes('.')) setPath(record, path, value); else record[path] = value;
    }
    return record;
  });
  const parsed = JSON.parse(input);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.devices)) return parsed.devices;
  return [parsed];
}

function normalizeRecord(raw) {
  const record = structuredClone(raw);
  record.brand = String(record.brand || '').trim(); record.model = String(record.model || '').trim();
  record.id = slug(record.id || `${record.brand}-${record.model}`);
  record.aliases = [...new Set([...(Array.isArray(record.aliases) ? record.aliases : []), record.model].filter(Boolean).map(String))];
  record.schemaVersion ??= 2; record.releaseDate ??= null; record.status ??= null; record.tier ??= null; record.verified ??= false; record.sourceUrl ??= null; record.checkedAt ??= null; record.lastCheckedAt ??= null;
  if (record.type === 'action-camera') record.type = 'action';
  for (const group of GROUPS) record[group] ||= {};
  record.variants ||= []; record.regions ||= []; record.cameraModules ||= [];
  return record;
}

function populatedFactGroups(record) {
  return GROUPS.filter(group => Object.entries(record[group] || {}).some(([key, value]) => key !== 'provenance' && known(value)));
}

function validateDevices(devices, sources) {
  const errors = [], sourceById = sourceMap(sources), ids = new Set(), aliases = new Map();
  const modelKeys = [];
  const add = (record, message) => errors.push(`${record.id || '(id thiếu)'}: ${message}`);
  for (const record of devices) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) { errors.push('Bản ghi thiết bị phải là object.'); continue; }
    if (record.schemaVersion !== 2) add(record, 'schemaVersion phải là 2.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id || '')) add(record, 'id cần là slug ổn định.');
    if (ids.has(record.id)) add(record, 'trùng id.'); ids.add(record.id);
    if (!record.brand || !record.model) add(record, 'thiếu brand/model.');
    if (!Array.isArray(record.aliases) || !Array.isArray(record.regions) || !Array.isArray(record.variants)) add(record, 'aliases/regions/variants phải là array.');
    if (!TYPES.has(record.type)) add(record, 'type không nằm trong enum schema.');
    if (record.releaseDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(record.releaseDate)) add(record, 'releaseDate cần ngày ISO YYYY-MM-DD hoặc null.');
    if (record.status != null && !['announced', 'current', 'discontinued'].includes(record.status)) add(record, 'status không nằm trong enum schema.');
    if (record.tier != null && ![0, 1, 2].includes(record.tier)) add(record, 'tier chỉ nhận 0, 1, 2 hoặc null.');
    if (typeof record.verified !== 'boolean') add(record, 'verified phải là boolean.');
    for (const path of ['brand', 'model', 'aliases', 'type', 'regions', 'status']) {
      const value = path.split('.').reduce((node, key) => node?.[key], record);
      if (known(value)) validateProvenance(record, path, record.provenance?.[path], sourceById, add);
    }
    if (record.releaseDate != null) validateProvenance(record, 'releaseDate', record.provenance?.releaseDate, sourceById, add);
    const modelKey = slug(`${record.brand}-${record.model}`).replaceAll('-', '');
    for (const old of modelKeys) if (old.id !== record.id && modelKey.length >= 10 && old.key.length >= 10 && editDistance(modelKey, old.key, 2) <= 2) add(record, `tên model gần trùng với ${old.id}; cần duyệt thủ công.`);
    modelKeys.push({ id: record.id, key: modelKey });
    for (const alias of [record.model, ...(record.aliases || [])]) {
      const key = String(alias).toLowerCase().trim();
      const previous = aliases.get(key);
      if (key && previous && previous !== record.id) add(record, `alias trùng "${alias}" với ${previous}.`);
      else if (key) aliases.set(key, record.id);
    }
    if (!Array.isArray(record.cameraModules)) add(record, 'cameraModules phải là array.');
    for (const group of populatedFactGroups(record)) {
      const provenance = record[group].provenance || record.provenance?.[group];
      validateProvenance(record, group, provenance, sourceById, add);
    }
    for (const camera of record.cameraModules || []) {
      const hasFacts = Object.entries(camera).some(([key, value]) => key !== 'provenance' && known(value));
      if (hasFacts) validateProvenance(record, `cameraModules.${camera.role || 'other'}`, camera.provenance, sourceById, add);
      if (camera.megapixels != null && (!(camera.megapixels > 0) || camera.megapixels > 500)) add(record, 'camera module megapixels ngoài khoảng 0–500.');
      if (camera.apertureF != null && (!(camera.apertureF > 0) || camera.apertureF > 128)) add(record, 'camera module apertureF ngoài khoảng hợp lý.');
      if (camera.role && !['main', 'ultrawide', 'tele', 'macro', 'front', 'action', 'other'].includes(camera.role)) add(record, `camera module role không hợp lệ: ${camera.role}.`);
    }
    for (const [index, variant] of (record.variants || []).entries()) {
      if (!variant.id || !Array.isArray(variant.regions)) add(record, `variants[${index}] thiếu id hoặc regions[].`);
      const hasFacts = Object.entries(variant).some(([key, value]) => !['id', 'regions', 'aliases', 'provenance'].includes(key) && known(value));
      if (hasFacts) validateProvenance(record, `variants.${variant.id || index}`, variant.provenance, sourceById, add);
    }
    for (const [path, max] of [['sensor.megapixels', 500], ['sensor.pixelPitchUm', 200], ['power.weightG', 20000], ['battery.capacityMah', 100000], ['ramGB', 4096], ['storageGB', 100000]]) {
      const value = path.split('.').reduce((node, key) => node?.[key], record);
      if (value != null && (typeof value !== 'number' || value <= 0 || value > max)) add(record, `${path} ngoài khoảng hợp lý.`);
    }
    for (const [path, provenance] of Object.entries(record.provenance || {})) {
      if (known(path.split('.').reduce((node, key) => node?.[key], record))) validateProvenance(record, path, provenance, sourceById, add);
    }
    for (const path of ['chip', 'ramGB', 'storageGB', 'display', 'battery']) {
      if (known(record[path])) validateProvenance(record, path, record.provenance?.[path], sourceById, add);
    }
    for (const [path, item] of Object.entries(record.derived || {})) {
      if (item?.derived !== true || !item.formula || !Array.isArray(item.inputPaths) || !item.inputPaths.length) add(record, `derived.${path} cần derived=true, formula và inputPaths.`);
      else if (item.inputPaths.some(input => !known(input.split('.').reduce((node, key) => node?.[key], record)))) add(record, `derived.${path} tham chiếu đầu vào chưa có dữ liệu.`);
    }
    if (record.verified === true && populatedFactGroups(record).some(group => record[group].provenance?.verified !== true && record.provenance?.[group]?.verified !== true)) add(record, 'verified=true nhưng còn nhóm dữ liệu đã điền chưa xác minh.');
  }
  return errors;
}

function validateProvenance(record, label, provenance, sources, add) {
  if (!provenance || !provenance.sourceId || !provenance.url || !provenance.retrievedAt || !provenance.license || !provenance.extractedBy || typeof provenance.verified !== "boolean") {
    add(record, `${label} có dữ liệu nhưng thiếu provenance đầy đủ.`); return;
  }
  let parsed;
  try { parsed = new URL(provenance.url); } catch { add(record, `${label} có URL provenance không hợp lệ.`); return; }
  const source = sources.get(provenance.sourceId);
  const localImport = source?.type === 'user-import' && /^urn:photolens:local-import:[a-z0-9-]+:.+$/.test(provenance.url) && Boolean(provenance.sourceFile);
  if (!["http:", "https:"].includes(parsed.protocol) && !localImport) add(record, `${label} provenance URL must use HTTP(S) or a registered local-import URN.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(provenance.retrievedAt) || Number.isNaN(Date.parse(`${provenance.retrievedAt}T00:00:00Z`))) add(record, `${label} retrievedAt cần ngày ISO YYYY-MM-DD hợp lệ.`);
  if (!source) { add(record, `${label} tham chiếu sourceId chưa đăng ký: ${provenance.sourceId}.`); return; }
  const allowedUrls = source.urls || [source.url];
  if (!allowedUrls.includes(provenance.url)) add(record, `${label} URL không nằm trong danh sách URL của nguồn ${provenance.sourceId}.`);
  if (provenance.verified === true) {
    const primaryHost = parsed.hostname.toLowerCase();
    const independent = [...new Set((provenance.alternatives || []).map(item => item.sourceId).filter(id => id && id !== provenance.sourceId && sources.has(id)))].filter(id => { try { return new URL(sources.get(id).url).hostname.toLowerCase() !== primaryHost; } catch { return false; } });
    if (source.type !== 'official-manufacturer' && independent.length < 1) add(record, label + ' cannot be verified without an official source or another independent registered source.');
  }
}
function countRecords(devices) {
  const by = key => Object.fromEntries([...new Set(devices.map(d => d[key] ?? 'Chưa phân tầng'))].sort().map(value => [value, devices.filter(d => (d[key] ?? 'Chưa phân tầng') === value).length]));
  return { total: devices.length, byBrand: by('brand'), byType: by('type'), byTier: by('tier'), verified: devices.filter(d => d.verified === true).length };
}

async function readDataset() {
  const devices = await readJson(join(ROOT, 'data/devices.json'));
  const registry = await readJson(join(ROOT, 'data/sources.json'));
  if (!Array.isArray(devices) || !Array.isArray(registry.sources)) throw new Error('devices.json phải là array và sources.json phải có sources[].');
  return { devices, sources: registry.sources };
}

async function ensureValid(devices, sources) {
  const schemaErrors = devices.flatMap((device, index) => {
    if (schemaValidator(device)) return [];
    return schemaValidator.errors.map(error => 'devices[' + index + '] ' + (error.instancePath || '/') + ' ' + error.message);
  });
  const errors = [...schemaErrors, ...validateDevices(devices, sources)];
  if (errors.length) throw new Error('Dataset validation failed:\n- ' + errors.join('\n- '));
}

function reportMarkdown(devices, sources = []) {
  const normalized = devices.map(normalizeRecord).sort((a, b) => a.id.localeCompare(b.id));
  const coverage = computeDeviceCoverage(normalized), counts = countRecords(normalized);
  const bytes = gzipSync(Buffer.from(JSON.stringify({ schemaVersion: 2, devices: normalized })), { level: 9, mtime: 0 }).byteLength;
  const rows = Object.entries(counts.byBrand).map(([brand, count]) => '| ' + brand + ' | ' + count + ' | ' + normalized.filter(d => d.brand === brand && d.verified).length + ' |').join(String.fromCharCode(10));
  const types = Object.entries(counts.byType).map(([type, count]) => '| ' + type + ' | ' + count + ' |').join(String.fromCharCode(10));
  const tiers = Object.entries(counts.byTier).map(([tier, count]) => '| ' + tier + ' | ' + count + ' |').join(String.fromCharCode(10));
  const sourceRows = sources.map(source => '| ' + source.name + ' | ' + source.license + ' |').join(String.fromCharCode(10));
  return [
    '# PhotoLens - device catalog coverage report', '', '- Schema: v2',
    '- Catalog records: **' + counts.total + '**',
    '- Tier 0 / Tier 1 / Tier 2 / unassigned: **' + (counts.byTier['0'] || 0) + ' / ' + (counts.byTier['1'] || 0) + ' / ' + (counts.byTier['2'] || 0) + ' / ' + (counts.byTier['Chưa phân tầng'] || 0) + '**',
    '- Records with verified technical groups: **' + counts.verified + '/' + counts.total + ' (' + (counts.total ? (counts.verified / counts.total * 100).toFixed(1) : '0.0') + '%)**',
    '- Tracked technical-field coverage: **' + coverage.populatedFields + '/' + coverage.totalFields + ' (' + coverage.fieldCoveragePercent + '%)**',
    '- Populated technical fields with verified provenance: **' + coverage.verifiedFields + '/' + coverage.populatedFields + ' (' + coverage.verifiedFieldPercent + '%)**',
    '- Embedded baseline gzip: **' + bytes + ' bytes (' + (bytes / 1024).toFixed(1) + ' KiB)**; limit 3 MiB.',
    '', '## By brand', '', '| Brand | Records | Verified records |', '|---|---:|---:|', rows,
    '', '## By device type', '', '| Type | Records |', '|---|---:|', types,
    '', '## By tier', '', '| Tier | Records |', '|---|---:|', tiers,
    '', '## Coverage by technical group', '', '| Group | Populated | Tracked | Verified populated |', '|---|---:|---:|---:|',
    ...Object.entries(coverage.byGroup).map(([group, values]) => '| ' + group + ' | ' + values.populated + ' | ' + values.total + ' | ' + values.verified + ' |'),
    '', '## Sources and licenses', '', '| Source | License / use notice |', '|---|---|', sourceRows,
    '', '## Interpretation', '',
    'Empty records remain in the record count but do not contribute values or scores. “Verified” applies to populated technical groups with provenance; it does not mean the catalog covers every product or regional variant. Camera-module coverage counts only module slots represented in each record, so unknown modules are not assumed to exist. Source names and license/use notices are registered in data/sources.json.'
  ].join(String.fromCharCode(10)) + String.fromCharCode(10);
}
async function buildData(devices, sources = []) {
  const output = join(ROOT, 'public/data');
  const normalized = devices.map(normalizeRecord).sort((a, b) => a.id.localeCompare(b.id));
  const jsonBytes = value => Buffer.from(JSON.stringify(value));
  const details = new Map(normalized.map(device => [`devices/${device.id}.json`, jsonBytes(device)]));
  const indexBytes = jsonBytes(normalized.map(({ id, brand, model, aliases, type, releaseDate, verified, tier }) => ({ id, brand, model, aliases, type, releaseDate, verified, tier })));
  const baselineBytes = gzipSync(jsonBytes({ schemaVersion: 2, devices: normalized }), { level: 9, mtime: 0 });
  if (baselineBytes.byteLength > 3 * 1024 * 1024) throw new Error(`Baseline gzip ${baselineBytes.byteLength} bytes vượt 3 MiB.`);
  const files = { 'index.json': { sha256: digest(indexBytes), bytes: indexBytes.byteLength }, 'baseline.json.gz': { sha256: digest(baselineBytes), bytes: baselineBytes.byteLength } };
  for (const [path, bytes] of details) files[path] = { sha256: digest(bytes), bytes: bytes.byteLength };
  const lensfun = await readJson(join(ROOT, 'data/lensfun-derived.json'));
  const lensfunBytes = jsonBytes(lensfun); files['lensfun-derived.json'] = { sha256: digest(lensfunBytes), bytes: lensfunBytes.byteLength };
  const dataVersion = digest(Buffer.concat([jsonBytes(normalized), lensfunBytes])).slice(0, 16);
  const manifest = { schemaVersion: 2, dataVersion, builtAt: new Date().toISOString(), counts: countRecords(normalized), coverage: computeDeviceCoverage(normalized), baselineGzipBytes: baselineBytes.byteLength, files };
  const deviceOutput = join(output, 'devices');
  await mkdir(deviceOutput, { recursive: true });
  const expectedDetails = new Set([...details.keys()].map(path => basename(path)));
  for (const oldFile of await readdir(deviceOutput)) if (oldFile.endsWith('.json') && !expectedDetails.has(oldFile)) await unlink(join(deviceOutput, oldFile));
  await writeFile(join(output, 'index.json'), indexBytes); await writeFile(join(output, 'baseline.json.gz'), baselineBytes); await writeFile(join(output, 'lensfun-derived.json'), lensfunBytes);
  for (const [path, bytes] of details) await writeFile(join(output, path), bytes);
  await writeJson(join(output, 'manifest.json'), manifest);
  await writeFile(join(ROOT, 'DATA_REPORT.md'), reportMarkdown(normalized, sources), 'utf8');
  console.log(`Đã tạo data v${dataVersion}: ${normalized.length} thiết bị, baseline gzip ${(baselineBytes.byteLength / 1024).toFixed(1)} KiB.`);
}

async function doImport(args) {
  const arg = name => { const at = args.indexOf(name); return at < 0 ? '' : args[at + 1] || ''; };
  const file = arg('--file'), sourceName = arg('--source'), license = arg('--license'), sourceUrl = arg('--url');
  if (!file || !sourceName || !license) throw new Error('Cú pháp: npm run data:import -- --file <path> --source "<tên>" --license "<giấy phép>"');
  const inputPath = resolve(process.cwd(), file), extension = extname(inputPath).toLowerCase();
  if (!['.csv', '.json'].includes(extension)) throw new Error('Importer chỉ nhận CSV hoặc JSON.');
  const raw = parseImport(await readFile(inputPath, 'utf8'), extension).map(normalizeRecord);
  let sourceId = slug(sourceName);
  const registry = await readJson(join(ROOT, 'data/sources.json'));
  let knownSource = registry.sources.find(source => source.id === sourceId || source.name.toLowerCase() === sourceName.toLowerCase());
  const recordUrl = raw.find(record => record.sourceUrl)?.sourceUrl;
  if (knownSource && (knownSource.license !== license || (sourceUrl && ![knownSource.url, ...(knownSource.urls || [])].includes(sourceUrl)))) {
    sourceId = `${sourceId}-${digest(`${sourceName}|${license}|${sourceUrl || recordUrl || basename(inputPath)}`).slice(0, 8)}`;
    knownSource = null;
  }
  const fallbackUrl = sourceUrl || knownSource?.url || recordUrl || `urn:photolens:local-import:${sourceId}:${encodeURIComponent(basename(inputPath))}`;
  if (!fallbackUrl) throw new Error('Nguồn chưa đăng ký URL. Dùng --url <URL nguồn> hoặc thêm sourceUrl vào các bản ghi.');
  if (!knownSource) registry.sources.push({ id: sourceId, name: sourceName, type: 'user-import', url: fallbackUrl, localFile: basename(inputPath), license, priority: 4, use: 'Nguồn khai báo qua data:import; chưa tự xác minh.' });
  const imported = raw.map(record => {
    record.schemaVersion = 2; record.verified = false;
    const provenance = { sourceId: knownSource?.id || sourceId, url: record.sourceUrl || sourceUrl || knownSource?.url || fallbackUrl, retrievedAt: TODAY, license, extractedBy: 'import', verified: false, sourceFile: basename(inputPath) };
    for (const group of populatedFactGroups(record)) record[group].provenance = provenance;
    record.provenance ||= {};
    for (const key of ['brand', 'model', 'aliases', 'type', 'regions', 'status']) if (known(record[key])) record.provenance[key] = provenance;
    if (record.releaseDate != null) record.provenance.releaseDate = provenance;
    for (const key of ['chip', 'ramGB', 'storageGB', 'display', 'battery']) if (known(record[key])) record.provenance[key] = provenance;
    record.cameraModules = (record.cameraModules || []).map(camera => ({ ...camera, provenance }));
    record.variants = (record.variants || []).map(variant => ({ ...variant, provenance }));
    return record;
  });
  await ensureValid(imported, registry.sources);
  const output = join(ROOT, 'data/imports', `${sourceId}-${TODAY}-${digest(JSON.stringify(imported)).slice(0, 8)}.json`);
  await mkdir(dirname(output), { recursive: true }); await writeJson(output, imported); await writeJson(join(ROOT, 'data/sources.json'), registry);
  console.log(`Đã nhập ${imported.length} bản ghi vào ${output}. Tất cả trường mới giữ verified=false.`);
}

function setNested(target, path, value) { setPath(target, path, value); }

async function mergeImports(devices) {
  const dir = join(ROOT, 'data/imports'); let files = [];
  try { files = (await readdir(dir)).filter(file => file.endsWith('.json')).sort(); } catch { /* no imports yet */ }
  const merged = new Map(devices.map(record => [record.id, structuredClone(record)])); const conflicts = [];
  const reportConflict = (record, field, current, incoming, currentSource, incomingSource) => conflicts.push({ deviceId: record.id, field, existing: current, incoming, existingSource: currentSource || null, incomingSource: incomingSource || null, resolution: "manual-review-required" });
  for (const file of files) for (const incoming of await readJson(join(dir, file))) {
    const incomingAliases = [incoming.brand, incoming.model, ...(incoming.aliases || [])].map(value => String(value).toLowerCase());
    const match = merged.get(incoming.id) || [...merged.values()].find(current => [current.model, ...(current.aliases || [])].some(value => incomingAliases.includes(String(value).toLowerCase())));
    if (!match) { merged.set(incoming.id, incoming); continue; }
    for (const key of ['brand', 'model', 'type', 'releaseDate', 'status', 'regions']) {
      const value = incoming[key]; if (!known(value)) continue; const current = match[key];
      if (!known(current)) { match[key] = value; match.provenance ||= {}; match.provenance[key] = incoming.provenance?.[key]; match.verified = false; }
      else if (JSON.stringify(current) !== JSON.stringify(value)) reportConflict(match, key, current, value, match.provenance?.[key]?.sourceId, incoming.provenance?.[key]?.sourceId);
    }
    for (const group of GROUPS) for (const [key, value] of Object.entries(incoming[group] || {})) {
      if (key === "provenance" || !known(value)) continue;
      const current = match[group]?.[key];
      if (!known(current)) { match[group] ||= {}; match[group][key] = value; match[group].provenance = incoming[group].provenance; match.verified = false; }
      else if (JSON.stringify(current) !== JSON.stringify(value)) reportConflict(match, `${group}.${key}`, current, value, match[group]?.provenance?.sourceId, incoming[group]?.provenance?.sourceId);
    }
    for (const key of ["chip", "ramGB", "storageGB", "display", "battery"]) {
      const value = incoming[key]; if (!known(value)) continue; const current = match[key];
      if (!known(current)) { match[key] = value; match.provenance ||= {}; match.provenance[key] = incoming.provenance?.[key]; match.verified = false; }
      else if (JSON.stringify(current) !== JSON.stringify(value)) reportConflict(match, key, current, value, match.provenance?.[key]?.sourceId, incoming.provenance?.[key]?.sourceId);
    }
    for (const key of ['cameraModules', 'variants']) {
      const occurrences = new Map();
      for (const item of incoming[key] || []) {
        const entries = match[key] ||= [];
        const role = item.role || 'other';
        const occurrence = occurrences.get(role) || 0;
        occurrences.set(role, occurrence + 1);
        const identity = key === 'cameraModules' ? role + '[' + occurrence + ']' : item.id;
        const existing = key === 'cameraModules'
          ? (item.id ? entries.find(entry => entry.id === item.id) : entries.filter(entry => (entry.role || 'other') === role)[occurrence])
          : entries.find(entry => entry.id === item.id);
        if (!existing) { entries.push(structuredClone(item)); match.verified = false; continue; }
        for (const [field, value] of Object.entries(item)) {
          if (['provenance', 'regions', 'role', 'id', 'aliases'].includes(field) || !known(value)) continue;
          if (!known(existing[field])) { existing[field] = value; existing.provenance = item.provenance; match.verified = false; }
          else if (JSON.stringify(existing[field]) !== JSON.stringify(value)) reportConflict(match, key + '.' + identity + '.' + field, existing[field], value, existing.provenance?.sourceId, item.provenance?.sourceId);
        }
      }
    }
    const priorAliases = match.aliases || [];
    const mergedAliases = [...new Set([...priorAliases, ...(incoming.aliases || [])])];
    if (mergedAliases.length !== priorAliases.length) { match.aliases = mergedAliases; match.provenance ||= {}; match.provenance.aliases = incoming.provenance?.aliases; match.verified = false; }
  }
  const conflictPath = join(ROOT, 'data/review/conflicts.json');
  if (conflicts.length) await writeJson(conflictPath, { conflicts });
  else { try { await unlink(conflictPath); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  return { devices: [...merged.values()], conflicts };
}
async function applyOverrides(devices) {
  const dir = join(ROOT, 'data/overrides'); let files = [];
  try { files = (await readdir(dir)).filter(file => file.endsWith('.yaml') || file.endsWith('.yml')).sort(); } catch { return devices; }
  const map = new Map(devices.map(record => [record.id, record]));
  const ignored = new Set(['id','verified','tier','note','sourceUrl','checkedAt','lastCheckedAt','schemaVersion','releaseYear']);
  const provenanceKeys = ['sourceId','url','retrievedAt','license','extractedBy','verified'];
  for (const file of files) {
    const override = simpleYaml(await readFile(join(dir, file), 'utf8'));
    const record = map.get(override.id); if (!record) throw new Error('Override ' + file + ': unknown device id ' + override.id + '.');
    for (const [path, value] of Object.entries(override.set)) {
      if (value === null || path.includes('.provenance.') || path.endsWith('.provenance') || ignored.has(path)) continue;
      let provenancePath;
      const parts = path.split('.');
      if (GROUPS.includes(parts[0])) provenancePath = parts[0] + '.provenance';
      else if (['cameraModules','variants'].includes(parts[0]) && /^\d+$/.test(parts[1] || '')) provenancePath = parts[0] + '.' + parts[1] + '.provenance';
      else if (parts.length === 1) provenancePath = 'provenance.' + parts[0];
      else continue;
      const missing = provenanceKeys.filter(key => !Object.hasOwn(override.set, provenancePath + '.' + key));
      if (missing.length) throw new Error('Override ' + file + ': field ' + path + ' must include ' + provenancePath + ' provenance fields (' + missing.join(', ') + ').');
    }
    for (const [path, value] of Object.entries(override.set)) setNested(record, path, value);
  }
  return [...map.values()];
}
async function fetchCandidates() {
  const registry = await readJson(join(ROOT, 'data/sources.json'));
  const query = `SELECT ?item ?itemLabel ?brandLabel ?date ?classLabel WHERE { VALUES ?class { wd:Q22645 wd:Q19723414 } ?item wdt:P31/wdt:P279* ?class; wdt:P176 ?brand. OPTIONAL { ?item wdt:P571 ?date. } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?itemLabel LIMIT 300`;
  const endpoint = new URL(registry.sources.find(x => x.id === 'wikidata').url); endpoint.searchParams.set('query', query); endpoint.searchParams.set('format', 'json');
  const sources = [endpoint.href, ...registry.sources.find(x => x.id === 'lensfun').fetchUrls];
  const userAgent = 'PhotoLensDataPipeline/1.0 (+https://github.com/Taylor447/PhotoLens)';
  for (const url of sources) {
    await new Promise(resolve => setTimeout(resolve, 1100));
    const response = await fetch(url, { headers: { 'User-Agent': userAgent, 'Accept': 'application/sparql-results+json,application/xml,text/xml,*/*' }, signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`Không tải được nguồn ${url}: HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer()), hash = digest(bytes);
    const filename = url.includes('query.wikidata.org') ? `wikidata-${hash}.json` : `lensfun-${basename(new URL(url).pathname)}-${hash}.xml`;
    const output = join(ROOT, 'data/raw', filename); await mkdir(dirname(output), { recursive: true });
    try { await readFile(output); } catch { await writeFile(output, bytes); await writeJson(output + '.meta.json', { sourceUrl: url, retrievedAt: TODAY, sha256: hash, license: url.includes('query.wikidata.org') ? 'CC0-1.0' : 'CC BY-SA 3.0', userAgent }); }
    console.log(`Nguồn cache: ${filename} (${hash.slice(0, 12)})`);
  }
}

function decodeXml(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

function parseLensfunCameras(xml, provenance) {
  const items = [];
  for (const [, block] of xml.matchAll(/<camera\b[^>]*>([\s\S]*?)<\/camera>/gi)) {
    const values = [...block.matchAll(/<([A-Za-z][A-Za-z0-9_-]*)(?:\s+lang="([^"]+)")?\s*>([\s\S]*?)<\/\1>/g)];
    const first = tag => decodeXml(values.find(([, name, lang]) => name === tag && !lang)?.[3] || '');
    const maker = first('maker'), model = first('model');
    if (!maker || !model) continue;
    const aliases = values.filter(([, name]) => name === 'model').map(([, , , value]) => decodeXml(value)).filter(value => value && value !== model);
    const crop = Number(first('cropfactor'));
    items.push({ brand: maker, model, aliases: [...new Set(aliases)], mount: first('mount') || null, cropFactor: Number.isFinite(crop) && crop > 0 ? crop : null, provenance: { ...provenance, verified: false } });
  }
  return items;
}

async function normalizeLensfunRaw() {
  const rawDir = join(ROOT, 'data/raw'); let files = [];
  try { files = (await readdir(rawDir)).filter(file => /^lensfun-.*\.xml$/.test(file)).sort(); } catch { return; }
  const registry = await readJson(join(ROOT, 'data/lensfun-derived.json'));
  const items = new Map((registry.items || []).map(item => [`${slug(item.brand)}-${slug(item.model)}`, item]));
  for (const file of files) {
    const path = join(rawDir, file), meta = await readJson(path + '.meta.json');
    const parsed = parseLensfunCameras(await readFile(path, 'utf8'), {
      sourceId: 'lensfun', url: meta.sourceUrl, retrievedAt: meta.retrievedAt, license: 'CC BY-SA 3.0', extractedBy: 'pipeline'
    });
    for (const item of parsed) {
      const key = `${slug(item.brand)}-${slug(item.model)}`;
      const old = items.get(key);
      if (old && JSON.stringify([old.mount || null, old.cropFactor ?? null]) !== JSON.stringify([item.mount, item.cropFactor])) {
        throw new Error(`Xung đột Lensfun ${item.brand} ${item.model}; cần duyệt thủ công.`);
      }
      items.set(key, item);
    }
  }
  await writeJson(join(ROOT, 'data/lensfun-derived.json'), { schemaVersion: 1, license: 'CC BY-SA 3.0', attribution: 'Lensfun camera database contributors.', licenseUrl: 'https://github.com/lensfun/lensfun/blob/master/data/COPYING.CC_BY-SA_3.0', items: [...items.values()].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'en')) });
  console.log(`Lensfun normalize: ${items.size} camera rows; kept separate under CC BY-SA 3.0.`);
}

async function normalizeWikidataRaw() {
  const rawDir = join(ROOT, 'data/raw');
  let files = [];
  // Sidecar metadata filenames also end in `.json`; do not treat them as SPARQL payloads.
  try { files = (await readdir(rawDir)).filter(file => /^wikidata-.*\.json$/.test(file) && !file.endsWith('.meta.json')).sort(); } catch { return 0; }
  const rows = new Map();
  for (const file of files) {
    const path = join(rawDir, file), meta = await readJson(path + '.meta.json'), payload = await readJson(path);
    for (const binding of payload.results?.bindings || []) {
      const qid = binding.item?.value?.split('/').at(-1);
      const label = binding.itemLabel?.value;
      if (!qid || !/^Q\d+$/.test(qid) || !label) continue;
      rows.set(qid, { qid, label, brand: binding.brandLabel?.value || null, releaseDate: binding.date?.value?.slice(0, 10) || null, classLabel: binding.classLabel?.value || null, source: { sourceId: 'wikidata', url: meta.sourceUrl, retrievedAt: meta.retrievedAt, license: 'CC0-1.0', extractedBy: 'pipeline', verified: false } });
    }
  }
  const candidates = [...rows.values()].sort((a, b) => ((a.brand || '') + ' ' + a.label).localeCompare((b.brand || '') + ' ' + b.label, 'en'));
  await writeJson(join(ROOT, 'data/review/wikidata-candidates.json'), { schemaVersion: 1, license: 'CC0-1.0', count: candidates.length, candidates });
  console.log('Wikidata normalized: ' + candidates.length + ' candidate rows; held for manual review.');
  return candidates.length;
}

async function run(command, args = []) {
  if (command === 'import') return doImport(args);
  if (command === 'fetch') return fetchCandidates();
  const { devices, sources } = await readDataset();
  let current = devices;
  if (command === 'update') {
    await fetchCandidates();
    await normalizeWikidataRaw();
    await normalizeLensfunRaw();
    const merged = await mergeImports(current);
    if (merged.conflicts.length) throw new Error(`${merged.conflicts.length} xung đột được ghi tại data/review/conflicts.json. Giữ nguyên baseline hiện hành cho tới khi duyệt tay.`);
    current = await applyOverrides(merged.devices);
    await ensureValid(current, sources);
    await writeJson(join(ROOT, 'data/devices.json'), current);
  } else if (command !== 'check' && command !== 'report' && command !== 'build') throw new Error('Lệnh hợp lệ: fetch, import, update, check, report, build.');
  else if (command === 'report' || command === 'build') current = await applyOverrides(current);
  await ensureValid(current, sources);
  const report = reportMarkdown(current, sources);
  if (command === 'report' || command === 'update') await writeFile(join(ROOT, 'DATA_REPORT.md'), report, 'utf8');
  if (command === 'build' || command === 'update') await buildData(current, sources);
  if (command === 'check') console.log(JSON.stringify({ ok: true, ...countRecords(current), coverage: computeDeviceCoverage(current) }, null, 2));
  if (command === 'report') console.log(report);
}

const [command, ...args] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run(command, args).catch(error => { console.error(error.message || error); process.exitCode = 1; });
}

export { csvRows, normalizeRecord, validateDevices, reportMarkdown, simpleYaml, parseLensfunCameras, schemaValidator };
