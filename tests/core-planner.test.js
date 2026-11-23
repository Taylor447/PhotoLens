import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareDevices,deviceScore,recommendDevices,conditionScore,angleOptions,outfitOptions,createPlanStore,solarWindows,expandDevice,scoreHours} from '../core/photography.js';
test('unknown device facts are not fabricated and unknown rows are not called different',()=>{const rows=compareDevices([expandDevice({sensor:{megapixels:null}}),expandDevice({sensor:{megapixels:24}})],true);assert.equal(rows.some(r=>r.path==='sensor.megapixels'),false);});
test('device score requires two available numeric facts',()=>{const cfg={purposes:{x:{'sensor.megapixels':{min:0,max:50,weight:.5},'power.weightG':{min:100,max:1000,weight:.5,direction:'lower'}}}};assert.equal(deviceScore({sensor:{megapixels:20},power:{weightG:null}},'x',cfg).score,null);assert.equal(deviceScore({sensor:{megapixels:25},power:{weightG:550}},'x',cfg).score,50);});
test('weather score explains missing data and computes when there are inputs',()=>{assert.equal(conditionScore({},'portrait',{weights:{portrait:{rain:.3,wind:.2}}}).score,null);const s=conditionScore({rain:0,wind:4,cloud:35,visibility:100},'portrait',{weights:{portrait:{rain:.3,wind:.2,cloud:.18,visibility:.14}}});assert.ok(s.score>0);assert.equal(s.factors.visibility,100);assert.match(s.why,/tham khảo/);});
test('angle and outfit suggestions have three options and no appearance judgments',()=>{assert.equal(angleOptions('architecture').length,3);const text=JSON.stringify(outfitOptions({temp:30,background:'#234567'}));assert.equal(/skin|gender|age|body/i.test(text),false);});
test('hourly conditions cover the next 48 hours only',()=>{const time=Array.from({length:60},(_,i)=>new Date(Date.now()+(i+1)*3600000).toISOString().slice(0,16));const rows=scoreHours({time,precipitation_probability:time.map(()=>0),wind_speed_10m:time.map(()=>2),cloud_cover:time.map(()=>30),visibility:time.map(()=>10000),uv_index:time.map(()=>1)},'portrait',0,{weights:{portrait:{rain:.5,wind:.5}}});assert.ok(rows.length>=46&&rows.length<=49);assert.ok(rows.every(x=>x.timestamp<=Date.now()+48*3600000));});
test('solar windows preserve location local time',()=>{const x=solarWindows('2026-11-22T06:00','2026-11-22T17:00');assert.equal(x.rise,'06:00');assert.equal(x.estimated,true);});
test('plans can be saved, updated, and removed',()=>{const m=new Map();const s=createPlanStore({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)});const a=s.save({title:'Test'});assert.equal(s.list().length,1);s.save({...a,title:'Updated'});assert.equal(s.list()[0].title,'Updated');s.remove(a.id);assert.equal(s.list().length,0);});

const recommendationFixtureConfig={recommendation:{
 minimumKnownCriteria:2,maximumResults:5,priorityBoost:4,
 criteria:{
  imageQuality:{label:'Chất lượng ảnh',fields:[{path:'sensor.megapixels',min:0,max:100,direction:'higher',weight:1}]},
  zoom:{label:'Zoom',fields:[{path:'lens.opticalZoom',min:1,max:10,direction:'higher',weight:1}]}
 },
 purposeWeights:{travel:{imageQuality:.5,zoom:.5},portrait:{imageQuality:.8,zoom:.2}}
}};
test('device recommendations filter type, budget, and the selected current device',()=>{
 const devices=[
  {id:'current',brand:'A',model:'Current',type:'phone',sensor:{megapixels:20},lens:{opticalZoom:2},power:{price:{amount:4000000,currency:'VND'}}},
  {id:'phone-upgrade',brand:'B',model:'Phone',type:'phone',sensor:{megapixels:50},lens:{opticalZoom:6},power:{price:{amount:8000000,currency:'VND'}}},
  {id:'phone-unknown',brand:'C',model:'Unknown price',type:'phone',sensor:{megapixels:30},lens:{opticalZoom:5}},
  {id:'camera',brand:'D',model:'Camera',type:'mirrorless',sensor:{megapixels:60},lens:{opticalZoom:10},power:{price:{amount:2000000,currency:'VND'}}}
 ];
 const result=recommendDevices(devices,{type:'all',purpose:'travel',budget:10000000,currentDeviceId:'current',priorities:[]},recommendationFixtureConfig);
 assert.deepEqual(result.recommendations.map(item=>item.device.id),['phone-upgrade']);
 assert.equal(result.unknownPriceCount,1);
 assert.equal(result.recommendations[0].priceVnd,8000000);
});
test('device recommendations exclude missing metrics from the weighted score and report coverage',()=>{
 const devices=[
  {id:'partial',brand:'A',model:'Partial',type:'phone',sensor:{megapixels:90}},
  {id:'complete',brand:'B',model:'Complete',type:'phone',sensor:{megapixels:50},lens:{opticalZoom:5}}
 ];
 const result=recommendDevices(devices,{type:'phone',purpose:'travel'},recommendationFixtureConfig);
 assert.deepEqual(result.recommendations.map(item=>item.device.id),['complete']);
 assert.equal(result.recommendations[0].confidence.known,2);
 assert.equal(result.recommendations[0].confidence.total,2);
 assert.equal(result.recommendations[0].score,50);
 assert.ok(result.recommendations[0].criteria.some(item=>item.id==='zoom'&&item.score===50));
});
test('selected priority changes recommendation ranking using configured weight boost',()=>{
 const devices=[
  {id:'image-first',brand:'A',model:'Image First',type:'phone',sensor:{megapixels:100},lens:{opticalZoom:6}},
  {id:'zoom-first',brand:'B',model:'Zoom First',type:'phone',sensor:{megapixels:20},lens:{opticalZoom:10}}
 ];
 const balanced=recommendDevices(devices,{type:'all',purpose:'travel',priorities:[]},recommendationFixtureConfig);
 const zoomPriority=recommendDevices(devices,{type:'all',purpose:'travel',priorities:['zoom']},recommendationFixtureConfig);
 assert.equal(balanced.recommendations[0].device.id,'image-first');
 assert.equal(zoomPriority.recommendations[0].device.id,'zoom-first');
});
test('budget filtering refuses unknown or non-VND prices and explains the missing data',()=>{
 const devices=[
  {id:'unknown',brand:'A',model:'Unknown',type:'phone',sensor:{megapixels:50},lens:{opticalZoom:4}},
  {id:'usd',brand:'B',model:'USD only',type:'phone',sensor:{megapixels:40},lens:{opticalZoom:5},power:{price:{amount:100,currency:'USD'}}}
 ];
 const result=recommendDevices(devices,{type:'phone',purpose:'travel',budget:10000000},recommendationFixtureConfig);
 assert.equal(result.recommendations.length,0);
 assert.equal(result.unknownPriceCount,2);
 assert.match(result.message,/giá VND đã biết/);
});
test('action camera aliases match the action type filter',()=>{
 const devices=[{id:'action',brand:'A',model:'Action',type:'action-camera',sensor:{megapixels:40},lens:{opticalZoom:4}}];
 const result=recommendDevices(devices,{type:'action',purpose:'travel'},recommendationFixtureConfig);
 assert.equal(result.recommendations[0].device.id,'action');
});
\ntest('device examples are explicitly unverified and keep their source references',()=>{
 const devices=JSON.parse(readFileSync(new URL('../data/devices.json',import.meta.url),'utf8'));
 assert.equal(devices.length,12);
 for(const device of devices){assert.equal(device.verified,false);assert.match(device.sourceUrl,/^https:\/\//);assert.equal(typeof device.brand,'string');assert.equal(typeof device.model,'string');}
});
test('curated spot suggestions do not invent coordinates or opening hours',()=>{
 const spots=JSON.parse(readFileSync(new URL('../data/spots.json',import.meta.url),'utf8'));
 assert.equal(spots.length,15);
 for(const spot of spots){assert.equal(spot.coordinates,null);assert.equal(spot.openingHours,undefined);assert.match(spot.source,/openstreetmap\.org/);}
});
