import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conditionScore,angleOptions,outfitOptions,createPlanStore,solarWindows,scoreHours} from '../core/photography.js';
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
