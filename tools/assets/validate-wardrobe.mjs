import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
export function validateWardrobeData(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')){
 const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
 const g=read('data/wardrobe/garments.json'),m=read('data/wardrobe/materials.json'),p=read('data/wardrobe/patterns.json'),manifest=read('data/wardrobe/assets-manifest.json');
 assert.equal(g.schemaVersion,1);assert.equal(g.recordType,'procedural-template');assert.equal(g.realGarmentCount,0);
 const ids=g.templates.map(x=>x.id),matIds=new Set(m.materials.map(x=>x.id)),patIds=new Set(p.patterns.map(x=>x.id));
 assert.ok(ids.length>=60,'Need at least 60 templates');assert.equal(new Set(ids).size,ids.length,'Template ID collision');
 assert.ok(matIds.size>=20,'Need at least 20 material labels');assert.ok(patIds.size>=40,'Need at least 40 repeatable patterns');
 for(const x of g.templates){assert.ok(matIds.has(x.materialId),x.id+' has unknown material');assert.ok(patIds.has(x.patternId),x.id+' has unknown pattern');assert.equal(x.measurementsCm,null,'Templates must not invent garment measurements');}
 const assetIds=manifest.assets.map(x=>x.id);assert.equal(new Set(assetIds).size,assetIds.length,'Asset manifest ID collision');
 assert.equal(manifest.assets.length,g.templates.length*2,'Each template needs SVG and procedural 3D provenance');
 assert.ok(manifest.libraries.some(x=>x.name==='Three.js'&&x.version==='0.187.0'&&x.license==='MIT'),'Pinned 3D library provenance missing');
 for(const a of manifest.assets){assert.ok(a.source&&a.license&&a.author,'Missing provenance: '+a.id);assert.match(a.source,/PhotoLens/);}
 const counts=Object.fromEntries([...new Set(g.templates.map(x=>x.category))].map(cat=>[cat,g.templates.filter(x=>x.category===cat).length]));
 return{templateCount:ids.length,realGarmentCount:g.realGarmentCount,materialCount:matIds.size,patternCount:patIds.size,manifestEntries:manifest.assets.length,categoryCounts:counts};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateWardrobeData(),null,2));
