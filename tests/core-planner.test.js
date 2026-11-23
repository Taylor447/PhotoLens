import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conditionScore,angleOptions,outfitOptions,createPlanStore,solarWindows,scoreHours} from '../core/photography.js';
import {createWardrobeStore,WARDROBE_SAMPLES,filterWardrobeItems,prepareWardrobeTryOn,resolveTryOnMode} from '../core/wardrobe.js';
test('weather score explains missing data and computes when there are inputs',()=>{assert.equal(conditionScore({},'portrait',{weights:{portrait:{rain:.3,wind:.2}}}).score,null);const s=conditionScore({rain:0,wind:4,cloud:35,visibility:100},'portrait',{weights:{portrait:{rain:.3,wind:.2,cloud:.18,visibility:.14}}});assert.ok(s.score>0);assert.equal(s.factors.visibility,100);assert.match(s.why,/tham khảo/);});
test('angle and outfit suggestions have three options and no appearance judgments',()=>{assert.equal(angleOptions('architecture').length,3);const text=JSON.stringify(outfitOptions({temp:30,background:'#234567'}));assert.equal(/skin|gender|age|body/i.test(text),false);});
test('hourly conditions cover the next 48 hours only',()=>{const time=Array.from({length:60},(_,i)=>new Date(Date.now()+(i+1)*3600000).toISOString().slice(0,16));const rows=scoreHours({time,precipitation_probability:time.map(()=>0),wind_speed_10m:time.map(()=>2),cloud_cover:time.map(()=>30),visibility:time.map(()=>10000),uv_index:time.map(()=>1)},'portrait',0,{weights:{portrait:{rain:.5,wind:.5}}});assert.ok(rows.length>=46&&rows.length<=49);assert.ok(rows.every(x=>x.timestamp<=Date.now()+48*3600000));});
test('solar windows preserve location local time',()=>{const x=solarWindows('2026-11-22T06:00','2026-11-22T17:00');assert.equal(x.rise,'06:00');assert.equal(x.estimated,true);});
test('plans can be saved, updated, and removed',()=>{const m=new Map();const s=createPlanStore({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)});const a=s.save({title:'Test'});assert.equal(s.list().length,1);s.save({...a,title:'Updated'});assert.equal(s.list()[0].title,'Updated');s.remove(a.id);assert.equal(s.list().length,0);});

test('curated spot suggestions do not invent coordinates or opening hours',()=>{
 const spots=JSON.parse(readFileSync(new URL('../data/spots.json',import.meta.url),'utf8'));
 assert.equal(spots.length,15);
 for(const spot of spots){assert.equal(spot.coordinates,null);assert.equal(spot.openingHours,undefined);assert.match(spot.source,/openstreetmap\.org/);}
});

function wardrobeMemory(initial={}){
 const values=new Map(Object.entries(initial));
 return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};
}
test('wardrobe item CRUD keeps normalized fields on device',()=>{
 const storage=wardrobeMemory(),wardrobe=createWardrobeStore(storage);
 const item=wardrobe.saveItem({category:'tops',name:'Áo sơ mi',color:'#aabbcc',pattern:'stripes',material:'Cotton',style:'classic',season:'summer',weather:['hot'],note:'Đồ tự thêm'});
 assert.ok(item?.id);assert.equal(wardrobe.listItems().length,1);
 const updated=wardrobe.saveItem({...item,name:'Sơ mi xanh',color:'#112233'});
 assert.equal(wardrobe.listItems()[0].name,'Sơ mi xanh');assert.equal(updated.color,'#112233');
 assert.equal(wardrobe.removeItem(item.id),true);assert.equal(wardrobe.listItems().length,0);
});
test('wardrobe filters by search, category, color, style, and current weather',()=>{
 const items=[
  {id:'a',category:'tops',name:'Áo linen xanh',colorFamily:'blue',style:'casual',weather:['hot']},
  {id:'b',category:'outerwear',name:'Áo khoác đỏ',colorFamily:'red',style:'classic',weather:['cold']}
 ];
 assert.deepEqual(filterWardrobeItems(items,{query:'linen',category:'tops',color:'blue',style:'casual'}).map(x=>x.id),['a']);
 assert.deepEqual(filterWardrobeItems(items,{weather:'current'},{temp:31,rain:0,wind:4}).map(x=>x.id),['a']);
 assert.deepEqual(filterWardrobeItems(items,{weather:'current'},{temp:9,rain:0,wind:4}).map(x=>x.id),['b']);
});
test('saved outfit can be saved, renamed, duplicated, loaded, and deleted',()=>{
 const storage=wardrobeMemory(),wardrobe=createWardrobeStore(storage);
 const top=wardrobe.saveItem({id:'top',category:'tops',name:'Áo'}),pants=wardrobe.saveItem({id:'pants',category:'bottoms',name:'Quần'});
 const outfit=wardrobe.saveOutfit({name:'Cuối tuần',itemIds:[top.id,pants.id]});
 assert.equal(outfit.itemIds.length,2);
 assert.equal(wardrobe.renameOutfit(outfit.id,'Đi dạo').name,'Đi dạo');
 const copy=wardrobe.duplicateOutfit(outfit.id);assert.equal(copy.itemIds.length,2);assert.equal(wardrobe.listOutfits().length,2);
 assert.equal(wardrobe.removeOutfit(copy.id),true);assert.equal(wardrobe.listOutfits().length,1);
});
test('2D and 3D use the same ordered outfit and unsupported 3D falls back',()=>{
 const items=[
  {id:'top',category:'tops',name:'Áo'},
  {id:'pants',category:'bottoms',name:'Quần'}
 ];
 const twoD=prepareWardrobeTryOn(items,['pants','top'],'2d');
 const threeD=prepareWardrobeTryOn(items,['pants','top'],'3d');
 assert.deepEqual(twoD.items,threeD.items);
 assert.deepEqual(twoD.items.map(x=>x.id),['pants','top']);
 assert.equal(resolveTryOnMode('3d',false),'2d');
 assert.equal(prepareWardrobeTryOn(items,['top'],'3d',false).mode,'2d');
});
test('wardrobe storage leaves existing outfit preferences and saved plans intact',()=>{
 const storage=wardrobeMemory({
  photolens_outfit_style:JSON.stringify('Tự nhiên'),
  photolens_bg_color:JSON.stringify('#56736f'),
  photolens_plans_v1:JSON.stringify([{id:'old',title:'Kế hoạch cũ'}])
 });
 const wardrobe=createWardrobeStore(storage);
 wardrobe.saveItem({category:'shoes',name:'Giày mẫu'});
 assert.equal(storage.getItem('photolens_outfit_style'),JSON.stringify('Tự nhiên'));
 assert.equal(storage.getItem('photolens_bg_color'),JSON.stringify('#56736f'));
 assert.equal(storage.getItem('photolens_plans_v1'),JSON.stringify([{id:'old',title:'Kế hoạch cũ'}]));
 assert.equal(wardrobe.listItems().length,1);
});
test('generic example wardrobe items stay local and missing fields remain empty',()=>{
 assert.equal(WARDROBE_SAMPLES.length,8);
 const item=createWardrobeStore(wardrobeMemory()).saveItem({category:'accessories',name:'Món chưa rõ'});
 assert.equal(item.material,'');assert.equal(item.note,'');assert.equal(item.season,'all');
});
