import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const CATEGORIES=['tops','bottoms','skirts','dresses','outerwear','shoes','hats','bags','eyewear','scarves','jewelry','hair'];
const STYLE_TAGS=['minimal','vintage','streetwear','office','active','traditional','cosplay','classic','cinematic','casual'];
const MEASUREMENT_KEYS=['heightCm','shoulderWidthCm','chestCircumferenceCm','waistCircumferenceCm','hipCircumferenceCm','armLengthCm','legLengthCm','neckCircumferenceCm'];
const REQUIRED_TEMPLATE_KEYS=['id','name','category','legacyCategory','layer','layerOrder','styleTags','season','temperatureC','weather','materialId','patternId','fit','recolorableRegions','sizeTable','sizeTableVersion','measurementsCm','measurementSource','shootingNotes','culturalNote','assets'];
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hasText=x=>typeof x==='string'&&x.trim().length>0;
const readJson=(root,p)=>JSON.parse(readFileSync(path.join(root,p),'utf8'));

function validateMeasurements(value,label){
 if(value===null)return 0;
 assert.ok(isRecord(value),label+' must be an object or null');
 const entries=Object.entries(value);
 assert.ok(entries.length>0,label+' cannot be an empty object');
 for(const [key,n] of entries){
  assert.ok(MEASUREMENT_KEYS.includes(key),label+' has an unknown dimension: '+key);
  assert.ok(Number.isFinite(n)&&n>0&&n<=300,label+'.'+key+' must be a positive centimetre value at most 300');
 }
 return entries.length;
}
function validateProvenance(value,label){
 assert.ok(isRecord(value),label+' provenance is missing');
 for(const key of ['source','license','author'])assert.ok(hasText(value[key]),label+' needs '+key);
}
export function validateWardrobeData(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')){
 const g=readJson(root,'data/wardrobe/garments.json');
 const schema=readJson(root,'data/wardrobe/garment.schema.json');
 const m=readJson(root,'data/wardrobe/materials.json');
 const p=readJson(root,'data/wardrobe/patterns.json');
 const manifest=readJson(root,'data/wardrobe/assets-manifest.json');

 assert.equal(g.schemaVersion,1);
 assert.equal(g.recordType,'procedural-template');
 assert.equal(m.schemaVersion,1,'Unsupported materials schema version');
 assert.equal(p.schemaVersion,1,'Unsupported patterns schema version');
 assert.equal(manifest.schemaVersion,1,'Unsupported asset manifest schema version');
 assert.equal(g.realGarmentCount,0,'Procedural templates must not be counted as physical products');
 assert.ok(Array.isArray(g.templates)&&g.templates.length>=60,'Need at least 60 generated templates');
 assert.equal(schema.properties.schemaVersion.const,g.schemaVersion);
 assert.equal(schema.properties.realGarmentCount.const,g.realGarmentCount);
 assert.deepEqual([...schema.$defs.garmentTemplate.required].sort(),[...REQUIRED_TEMPLATE_KEYS].sort(),'Schema required keys must match the checked catalog contract');
 const categoryCounts=Object.fromEntries(CATEGORIES.map(category=>[category,0]));
 const ids=g.templates.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length,'Template ID collision');

 const materialIds=new Set(m.materials.map(x=>x.id));
 const patternIds=new Set(p.patterns.map(x=>x.id));
 assert.equal(materialIds.size,m.materials.length,'Material ID collision');
 assert.equal(patternIds.size,p.patterns.length,'Pattern ID collision');
 assert.ok(materialIds.size>=20,'Need at least 20 material labels');
 assert.ok(patternIds.size>=40,'Need at least 40 repeatable pattern definitions');
 for(const x of g.templates){
  assert.ok(REQUIRED_TEMPLATE_KEYS.every(key=>Object.hasOwn(x,key)),x.id+' is missing a required schema field');
  assert.ok(CATEGORIES.includes(x.category),x.id+' has an unknown category');
  categoryCounts[x.category]++;
  assert.ok(materialIds.has(x.materialId),x.id+' has unknown material');
  assert.ok(patternIds.has(x.patternId),x.id+' has unknown pattern');
  assert.ok(['base','mid','outer','accessory'].includes(x.layer),x.id+' has invalid layer');
  assert.ok(x.sizeTableVersion===null||hasText(x.sizeTableVersion),x.id+' has invalid size-table version');
  assert.ok(x.layerOrder>=0&&x.layerOrder<=1000&&Number.isInteger(x.layerOrder),x.id+' has invalid layer order');
  assert.ok(['slim','regular','relaxed','oversize','layered'].includes(x.fit),x.id+' has invalid fit label');
  assert.ok(['all','spring','summer','autumn','winter'].includes(x.season),x.id+' has invalid season');
  assert.ok(Array.isArray(x.recolorableRegions)&&x.recolorableRegions.length>0&&x.recolorableRegions.every(hasText),x.id+' has invalid recolorable regions');
  assert.ok(x.culturalNote===null||typeof x.culturalNote==='string',x.id+' has invalid cultural note data');
  assert.ok(Array.isArray(x.styleTags)&&x.styleTags.every(hasText),x.id+' has invalid style tags');
  assert.ok(x.styleTags.every(tag=>STYLE_TAGS.includes(tag)),x.id+' has invalid style tag');
  assert.ok(isRecord(x.temperatureC)&&['min','max'].every(k=>Object.hasOwn(x.temperatureC,k)),x.id+' needs a temperature range');
  for(const value of [x.temperatureC.min,x.temperatureC.max])assert.ok(value===null||(Number.isFinite(value)&&value>=-80&&value<=80),x.id+' has invalid temperature data');
  if(x.temperatureC.min!==null&&x.temperatureC.max!==null)assert.ok(x.temperatureC.min<=x.temperatureC.max,x.id+' has inverted temperature range');
  assert.ok(isRecord(x.weather)&&['rain','wind'].every(k=>Object.hasOwn(x.weather,k)),x.id+' needs weather fields');
  assert.ok([x.weather.rain,x.weather.wind].every(v=>v===null||typeof v==='boolean'),x.id+' has invalid weather capability data');
  const dimensionCount=validateMeasurements(x.measurementsCm,x.id+' measurementsCm');
  for(const size of x.sizeTable){
   assert.ok(hasText(size.size),x.id+' has an unnamed size');
   validateMeasurements(size.measurementsCm,x.id+' size '+size.size);
   assert.ok(hasText(size.measurementSource),x.id+' size '+size.size+' needs a measurement source');
  }
  if(dimensionCount>0)assert.ok(hasText(x.measurementSource),x.id+' measurements need a source');
  assert.ok(isRecord(x.shootingNotes),x.id+' needs shooting notes');
  assert.equal(typeof x.shootingNotes.moireRisk,'boolean',x.id+' needs an explicit moireRisk flag');
  assert.ok(isRecord(x.assets),x.id+' needs asset references');
 }
 assert.ok(CATEGORIES.every(category=>categoryCounts[category]>0),'Every supported category must have templates');

 const manifestIds=new Set();
 const manifestById=new Map();
 for(const asset of manifest.assets){
  assert.ok(hasText(asset.id)&&!manifestIds.has(asset.id),'Asset manifest ID missing or duplicated: '+asset.id);
  manifestIds.add(asset.id);
  manifestById.set(asset.id,asset);
  for(const key of ['templateId','format','generator'])assert.ok(hasText(asset[key]),'Asset '+asset.id+' needs '+key);
  validateProvenance(asset,'Asset '+asset.id);
 }
 const referencedIds=new Set();
 for(const x of g.templates){
  const refs=[
   [x.assets.svg,'svg'],
   [x.assets.procedural3d,'three-procedural-geometry']
  ];
  if(x.assets.glb!==null)refs.push([x.assets.glb,'glb']);
  for(const [ref,format] of refs){
   assert.ok(isRecord(ref)&&hasText(ref.id),'Missing '+format+' reference: '+x.id);
   assert.ok(['generated-by-photolens','licensed-third-party'].includes(ref.provenance),x.id+' has an unknown provenance marker');
   assert.ok(!referencedIds.has(ref.id),x.id+' reuses an asset ID unexpectedly');
   referencedIds.add(ref.id);
   const record=manifestById.get(ref.id);
   assert.ok(record,x.id+' references an asset absent from the manifest: '+ref.id);
   assert.equal(record.templateId,x.id,ref.id+' points to the wrong template');
   assert.equal(record.format,format,ref.id+' format mismatch');
  }
 }
 assert.deepEqual([...referencedIds].sort(),[...manifestIds].sort(),'Every bundled asset must be referenced by exactly one catalog template');
 for(const entry of m.materials)validateProvenance(entry.provenance,'Material '+entry.id);
 for(const entry of p.patterns){assert.equal(entry.repeatable,true,'Pattern '+entry.id+' must repeat');validateProvenance(entry.provenance,'Pattern '+entry.id);}
 for(const library of manifest.libraries){
  for(const key of ['name','version','source','license','author'])assert.ok(hasText(library[key]),'Library provenance needs '+key);
 }
 assert.ok(manifest.libraries.some(x=>x.name==='Three.js'&&x.version==='0.187.0'&&x.license==='MIT'),'Pinned 3D library provenance missing');

 return{
  templateCount:ids.length,
  realGarmentCount:g.realGarmentCount,
  categoryCounts,
  materialCount:materialIds.size,
  patternCount:patternIds.size,
  manifestEntries:manifest.assets.length,
  svgReferences:g.templates.filter(x=>x.assets.svg).length,
  procedural3dReferences:g.templates.filter(x=>x.assets.procedural3d).length,
  glbCount:g.templates.filter(x=>x.assets.glb!==null).length,
  templatesWithKnownMeasurements:g.templates.filter(x=>x.measurementsCm!==null).length
 };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateWardrobeData(),null,2));
