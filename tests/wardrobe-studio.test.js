import test from 'node:test';
import assert from 'node:assert/strict';
import {createWardrobeRepository,LEGACY_ITEMS,LEGACY_LOOKS,filterGarments,normalizeGarment,calculateFit,chooseSize,contrastRatio,colorHarmony,scoreLook,resolveStudioMode,reconcileLook,inspectTemplateBounds,buildSvgLook,safeSvgText,MANNEQUIN_DEFAULTS_CM,MANNEQUIN_PRESETS,normalizeMannequin,createMannequinAnchors,garmentSvgGeometry,inspectSvgGarmentClipping,classifyWardrobeAsset,hasSupportedImageHeader,validGlbHeader} from '../core/wardrobe-engine.js';
import {readFileSync} from 'node:fs';
function memoryStorage(){const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
const template={id:'test-top',name:'Áo test',category:'tops',color:'#336699',styleTags:['casual'],materialId:'cotton',patternId:'solid',measurementsCm:{chest:100,waist:82},layerOrder:20};

test('CRUD món đồ and legacy migration preserve saved items, looks, and compatible fields',()=>{
 const storage=memoryStorage();
 storage.setItem(LEGACY_ITEMS,JSON.stringify([{id:'legacy-1',name:'Áo cũ',category:'tops',color:'#e8dfc9',pattern:'stripes',material:'Vải dệt mỏng',style:'casual',weather:['hot','mild'],note:'đồ đã lưu'},{id:'legacy-1',name:'Áo cũ trùng ID',category:'tops',color:'#e8dfc9'}]));
 storage.setItem(LEGACY_LOOKS,JSON.stringify([{id:'old-look',name:'Bộ cũ',itemIds:['legacy-1']}]));
 const repo=createWardrobeRepository(storage,null),migrated=repo.listItems().find(x=>x.id==='legacy-1');
 assert.ok(migrated);assert.equal(repo.listItems().filter(x=>x.id==='legacy-1').length,1);assert.equal(migrated.patternId,'thin-stripe');assert.equal(migrated.legacyPatternId,'stripes');assert.deepEqual(migrated.weatherTags,['hot','mild']);assert.equal(migrated.notes,'đồ đã lưu');assert.equal(repo.listLooks()[0].name,'Bộ cũ');
 assert.ok(repo.saveItem(template));assert.equal(repo.listItems().filter(x=>x.id==='test-top').length,1);
 repo.saveItem({...template,color:'#aa3311'});assert.equal(repo.listItems().find(x=>x.id==='test-top').color,'#aa3311');
 repo.removeItem('test-top');assert.ok(!repo.listItems().some(x=>x.id==='test-top'));
});
test('search and category, style, material, color, season filters work',()=>{
 const items=[normalizeGarment({...template,collections:['Capsule'],favorite:true}),normalizeGarment({...template,id:'test-jacket',name:'Áo khoác len',category:'outerwear',styleTags:['classic'],materialId:'wool',season:'winter',color:'#663322'})];
 assert.equal(filterGarments(items,{category:'tops'}).length,1);assert.equal(filterGarments(items,{style:'classic'}).length,1);assert.equal(filterGarments(items,{material:'wool'}).length,1);
 assert.equal(filterGarments(items,{color:'warm'}).length,1);assert.equal(filterGarments(items,{query:'khoác'}).length,1);assert.equal(filterGarments(items,{season:'winter'}).length,2);assert.equal(filterGarments(items,{collection:'Capsule'}).length,1);assert.equal(filterGarments(items,{favorite:'favorites'}).length,1);assert.deepEqual(filterGarments(items,{query:'không có tên'}),[]);
});
test('lookbook save, rename, duplicate and delete preserve item references',()=>{
 const repo=createWardrobeRepository(memoryStorage(),null);repo.saveItem(template);const look=repo.saveLook({name:'Phố chiều',itemIds:['test-top'],tags:['street']});
 assert.ok(look);assert.equal(repo.listLooks().length,1);const renamed=repo.saveLook({...look,name:'Chiều phố'});assert.equal(renamed.id,look.id);assert.equal(renamed.name,'Chiều phố');
 const duplicate=repo.duplicateLook(look.id);assert.ok(duplicate);assert.equal(repo.listLooks().length,2);repo.removeLook(duplicate.id);assert.equal(repo.listLooks().length,1);
});
test('2D generation, 3D fallback, shared ordering, fit and size limits are explicit',()=>{
 const item=normalizeGarment(template),svg=buildSvgLook([item],{background:'#f2f6f4'});
 assert.match(svg,/<svg/);assert.match(svg,/data-garment="test-top"/);assert.equal(resolveStudioMode('3d',false),'2d');assert.equal(resolveStudioMode('3d',true),'3d');
 assert.deepEqual(reconcileLook([item],[item.id,'missing']).map(x=>x.id),[item.id]);
 const fit=calculateFit({chest:96,waist:80},item);assert.deepEqual(fit.details.map(x=>x.easeCm),[4,2]);assert.match(fit.message,/không bảo đảm/);
 assert.equal(chooseSize({chest:96},[]).size,null);assert.equal(contrastRatio('#000000','#ffffff'),21);assert.equal(colorHarmony([{color:'#ff0000'},{color:'#00ff00'},{color:'#0000ff'}]).scheme,'Bộ ba / đa sắc');assert.ok(scoreLook([item],{background:'#ffffff'}).score>=0);
 const bounds=inspectTemplateBounds({virtualShellClearanceCm:1.5},{heightCm:170,shoulderCm:40,chestCm:90,waistCm:70,hipCm:95});assert.equal(bounds.violates,false);assert.match(bounds.method,/proxy/);
 const safe=safeSvgText('<svg onload=alert(1)><script>alert(1)</script><style>@import url(https://evil.test/a.css)</style><image href="https://evil.test/a.png"/><path fill="url(https://evil.test/a.svg#p)"/></svg>');assert.match(safe,/<svg>/);assert.doesNotMatch(safe,/script|onload|evil\.test|@import|<style/i);assert.equal(safeSvgText('not svg'),null);
});
test('generated data has unique template IDs and no invented commercial products',()=>{
 const g=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url))),m=JSON.parse(readFileSync(new URL('../data/wardrobe/materials.json',import.meta.url))),p=JSON.parse(readFileSync(new URL('../data/wardrobe/patterns.json',import.meta.url)));
 assert.equal(g.schemaVersion,1);assert.equal(g.templates.length,60);assert.equal(g.realGarmentCount,0);assert.equal(new Set(g.templates.map(x=>x.id)).size,g.templates.length);assert.ok(m.materials.length>=20);assert.ok(p.patterns.length>=40);
});

test('shared mannequin dimensions clamp in cm and scale all 2D anchors within the stage',()=>{
 const bounded=normalizeMannequin({heightCm:1,shoulders:500,chest:-1,waist:10000,hips:1,sleeve:0,inseam:999,neck:99});
 assert.deepEqual(bounded,{heightCm:140,shoulders:60,chest:60,waist:140,hips:60,sleeve:40,inseam:110,neck:55});
 for(const p of MANNEQUIN_PRESETS){const a=createMannequinAnchors(p);assert.equal(a.heightCm,p.heightCm);assert.ok(Math.abs(a.ankles.y-394.8)<1e-8);assert.equal(a.feet.y,402);assert.equal(a.scalePxPerCm,360/p.heightCm);assert.ok(a.shoulders.left<a.shoulders.right);assert.ok(a.hips.left<a.hips.right);}
 assert.equal(normalizeMannequin({}).heightCm,MANNEQUIN_DEFAULTS_CM.heightCm);
});
test('all 60 procedural garment templates remain inside the 2D SVG viewBox for all four reference presets',()=>{
 const g=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url)));
 let checked=0;
 for(const preset of MANNEQUIN_PRESETS){const anchors=createMannequinAnchors(preset);for(const garment of g.templates){const geometry=garmentSvgGeometry(garment,anchors);assert.ok(geometry.paths.length,garment.id+' has no 2D path');const clipping=inspectSvgGarmentClipping(garment,anchors);assert.equal(clipping.passed,true,preset.id+' / '+garment.id+': '+JSON.stringify(clipping));assert.equal(clipping.clippingRatio,0);checked++;}}
 assert.equal(checked,240);
});

test('local binary import validates declared type/signature and refuses phantom storage',async()=>{
 assert.equal(classifyWardrobeAsset('shirt.png','image/png',100),'image');
 assert.equal(classifyWardrobeAsset('shirt.jpg','image/png',100),null);
 assert.equal(classifyWardrobeAsset('vector.glb','model/gltf-binary',100),'glb');
 assert.equal(classifyWardrobeAsset('large.png','image/png',12*1024*1024+1),null);
 assert.equal(hasSupportedImageHeader(Uint8Array.from([137,80,78,71,13,10,26,10])),true);
 assert.equal(hasSupportedImageHeader(Uint8Array.from([255,216,255,0])),true);
 assert.equal(hasSupportedImageHeader(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80])),true);
 assert.equal(hasSupportedImageHeader(Uint8Array.from([0,0,0,0])),false);
 const bytes=new Uint8Array(20),view=new DataView(bytes.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,20,true);
 assert.equal(validGlbHeader(bytes,20),true);assert.equal(validGlbHeader(bytes,21),false);
 const repo=createWardrobeRepository(memoryStorage(),null);
 await assert.rejects(()=>repo.saveAsset(new Blob(['asset'],{type:'image/png'})),/IndexedDB/);
});
