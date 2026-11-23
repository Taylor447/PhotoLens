import catalog from '../data/device-types.json' with { type: 'json' };

const types = catalog.types;
const byId = new Map(types.map(type => [type.id, type]));
const legacyIds = new Map();
for (const type of types) for (const legacyId of type.legacyIds || []) legacyIds.set(normalizeDeviceText(legacyId), type.id);

export function normalizeDeviceText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[_ ]+/g, '-');
}

function allAliasFields(type) {
  return [...(type.aliases || []), ...(type.modelAliases || []), ...(type.brandAliases || [])];
}

export function getDeviceTypes() {
  return types.slice();
}

export function getDeviceType(id) {
  const normalizedId = normalizeId(id);
  const canonical = legacyIds.get(normalizeDeviceText(id)) || normalizedId;
  return byId.get(canonical) || byId.get('unclassified');
}

export function resolveDeviceTypeAlias(value) {
  const normalized = normalizeDeviceText(value);
  if (!normalized) return null;
  const directId = normalizeId(value);
  if (byId.has(directId)) return directId;
  if (legacyIds.has(normalized)) return legacyIds.get(normalized);
  const matches = types.filter(type => allAliasFields(type).some(alias => normalizeDeviceText(alias) === normalized));
  return matches.length === 1 ? matches[0].id : null;
}

export function normalizeDeviceTypeFilter(value) {
  const raw = String(value ?? 'all').trim();
  const normalized = normalizeDeviceText(raw);
  if (!raw || ['all', 'any', 'moi loai', 'tat ca', 'tat ca thiet bi'].includes(normalized)) return 'all';
  const directId = normalizeId(raw);
  if (byId.has(directId)) return directId;
  if (legacyIds.has(normalized)) return legacyIds.get(normalized);
  return resolveDeviceTypeAlias(raw) || 'unclassified';
}

function isDescendantOf(candidateId, ancestorId) {
  let current = byId.get(candidateId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return false;
}

function addAncestors(id, into) {
  let current = byId.get(id);
  while (current) {
    into.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
}

function phraseAppears(text, phrase) {
  const normalizedPhrase = normalizeDeviceText(phrase);
  return !!normalizedPhrase && (' ' + text + ' ').includes(' ' + normalizedPhrase + ' ');
}

function matchedModelAliases(text) {
  const found = [];
  for (const type of types) {
    for (const alias of type.modelAliases || []) {
      if (phraseAppears(text, alias)) found.push({ id: type.id, alias, length: normalizeDeviceText(alias).length });
    }
  }
  return found.sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
}

function typeValueId(value) {
  if (!value) return null;
  const direct = normalizeId(value);
  if (byId.has(direct)) return direct;
  const normalized = normalizeDeviceText(value);
  return legacyIds.get(normalized) || resolveDeviceTypeAlias(value);
}

function sensorFormatChild(baseId, size) {
  if (!['mirrorless', 'dslr'].includes(baseId)) return null;
  const value = normalizeDeviceText(size);
  let format = null;
  if (/\b(aps c|apsc)\b/.test(value)) format = 'aps-c';
  else if (value.includes('micro four thirds') || /\b(mft|m43)\b/.test(value)) format = 'micro-four-thirds';
  else if (value.includes('medium format')) format = 'medium-format';
  else if (value.includes('full frame') || value.includes('35 mm full')) format = 'full-frame';
  if (!format) return null;
  return types.find(type => type.parentId === baseId && type.sensorFormat === format)?.id || null;
}

function makeClassification(matchedIds, primaryId, method = 'unknown') {
  const direct = [...new Set(matchedIds.filter(id => byId.has(id)))];
  if (!direct.length) direct.push('unclassified');
  const ids = new Set();
  direct.forEach(id => addAncestors(id, ids));
  const primary = byId.has(primaryId) ? primaryId : direct[0];
  return {
    primaryId: primary,
    ids: [...ids],
    matchedIds: direct,
    confidence: primary === 'unclassified' ? 'uncertain' : 'high',
    method
  };
}

export function classifyDeviceTypes(deviceOrType) {
  const device = deviceOrType && typeof deviceOrType === 'object'
    ? deviceOrType
    : { type: deviceOrType };
  const rawType = device.deviceTypeId || device.type || device.category || '';
  const explicitId = typeValueId(rawType);
  const explicit = explicitId && explicitId !== 'unclassified' ? explicitId : null;
  const brand = normalizeDeviceText(device.brand || device.manufacturer || '');
  const text = normalizeDeviceText([device.brand, device.manufacturer, device.model, device.name, device.series].filter(Boolean).join(' '));
  const modelMatches = matchedModelAliases(text);

  // Osmo Mobile and similar phone gimbals are accessories, never standalone cameras.
  const phoneGimbalMatch = modelMatches.find(match => match.id === 'phone-gimbal');
  if (phoneGimbalMatch) return makeClassification(['phone-gimbal'], 'phone-gimbal', 'model-alias');

  let candidates = modelMatches;
  if (explicit) candidates = candidates.filter(match => isDescendantOf(match.id, explicit));
  const direct = [];
  if (explicit) direct.push(explicit);
  for (const match of candidates) direct.push(match.id);

  const phoneContext = explicit === 'phone' || (explicit && isDescendantOf(explicit, 'phone')) ||
    candidates.some(match => isDescendantOf(match.id, 'phone'));
  if (phoneContext) {
    for (const type of types) {
      if ((type.brandAliases || []).some(alias => normalizeDeviceText(alias) === brand)) direct.push(type.id);
    }
  }

  let sensorChild = null;
  const sensorSize = device.sensor?.size;
  if (explicit === 'mirrorless' || explicit === 'dslr') sensorChild = sensorFormatChild(explicit, sensorSize);
  if (!sensorChild) {
    const cameraBase = candidates.find(match => ['mirrorless', 'dslr'].includes(match.id))?.id;
    if (cameraBase) sensorChild = sensorFormatChild(cameraBase, sensorSize);
  }
  if (sensorChild) direct.push(sensorChild);

  if (!direct.length) {
    // If equally specific aliases point to unrelated device families, avoid a false-positive classification.
    const strongest = candidates.filter(match => match.length === candidates[0]?.length);
    const roots = new Set(strongest.map(match => {
      let node = byId.get(match.id);
      while (node?.parentId && byId.has(node.parentId)) node = byId.get(node.parentId);
      return node?.id || match.id;
    }));
    if (roots.size > 1) return makeClassification(['unclassified'], 'unclassified', 'ambiguous-alias');
    if (candidates.length) direct.push(...candidates.map(match => match.id));
  }

  if (!direct.length) return makeClassification([], 'unclassified', 'unknown');

  const specific = [...new Set([...candidates.map(match => match.id), ...(sensorChild ? [sensorChild] : [])])];
  const primaryId = specific[0] || explicit || direct[0];
  return makeClassification(direct, primaryId, candidates.length ? 'model-alias' : sensorChild ? 'sensor-size' : 'explicit-type');
}

export function classifyDeviceType(deviceOrType) {
  return classifyDeviceTypes(deviceOrType).primaryId;
}

export function matchesDeviceType(device, requestedType) {
  const filterId = normalizeDeviceTypeFilter(requestedType);
  return filterId === 'all' || classifyDeviceTypes(device).ids.includes(filterId);
}

export function isDeviceTypeScoreable(device) {
  const classification = classifyDeviceTypes(device);
  return classification.ids.every(id => byId.get(id)?.scoreable !== false);
}

export function isDeviceTypeScoreableId(id) {
  return getDeviceType(id)?.scoreable !== false;
}

export function describeDeviceType(device) {
  const classification = classifyDeviceTypes(device);
  if (classification.confidence !== 'high') return byId.get('unclassified').nameVi;
  const specific = classification.matchedIds.filter(id =>
    !classification.matchedIds.some(other => other !== id && isDescendantOf(other, id))
  );
  return specific.map(id => byId.get(id)?.nameVi).filter(Boolean).join(' · ') || byId.get(classification.primaryId)?.nameVi || 'Chưa phân loại';
}

export function searchDeviceTypes(query = '') {
  const normalizedQuery = normalizeDeviceText(query);
  const searchable = types.map(type => {
    let parent = type.parentId ? byId.get(type.parentId) : null;
    const parentNames = [];
    while (parent) {
      parentNames.unshift(parent.nameVi, parent.nameEn);
      parent = parent.parentId ? byId.get(parent.parentId) : null;
    }
    return {
      ...type,
      searchText: normalizeDeviceText([
        type.id, type.nameVi, type.nameEn, ...(type.aliases || []),
        ...(type.modelAliases || []), ...(type.brandAliases || []),
        ...(type.keywords || []), ...parentNames
      ].join(' '))
    };
  });
  return normalizedQuery ? searchable.filter(type => type.searchText.includes(normalizedQuery)) : searchable;
}

export function getDeviceTypeSearchText(type) {
  if (!type) return '';
  return [
    type.id, type.nameVi, type.nameEn, ...(type.aliases || []),
    ...(type.modelAliases || []), ...(type.brandAliases || []), ...(type.keywords || [])
  ].join(' ');
}

