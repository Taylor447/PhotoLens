import {getDeviceType,isDeviceTypeScoreable,matchesDeviceType,normalizeDeviceTypeFilter} from './device-types.js';
const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,n));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export const DEVICE_FIELDS=[
['sensor.type','Lo?i c?m bi?n'],['sensor.size','K�ch thu?c c?m bi?n'],['sensor.megapixels','D? ph�n gi?i','MP'],['sensor.pixelPitchUm','Pixel pitch','�m'],['sensor.iso','D?i ISO'],['sensor.highISO','ISO t?i da c� th? ch?n'],['sensor.raw','RAW'],['sensor.rawBitDepth','D? s�u RAW','bit'],['sensor.colorDepth','D? s�u m�u','bit'],
['lens.focal35mm','Ti�u c? quy d?i 35mm'],['lens.minFocal35mm','Ti�u c? g�c r?ng quy d?i 35mm'],['lens.aperture','Kh?u d?'],['lens.maxApertureF','Kh?u d? l?n nh?t','f/'],['lens.opticalZoom','Zoom quang','x'],['lens.macro','Macro'],['lens.mount','Ng�m'],['lens.ecosystem','H? ?ng k�nh'],
['focus.autofocus','L?y n�t'],['focus.subjectTracking','Theo doi ch? th?'],['focus.subjectTrackingScore','Theo doi ch? th? (di?m 0-5 do ngu?i d�ng nh?p)','/5'],['focus.stabilization','Ch?ng rung'],['focus.stabilizationScore','Ch?ng rung do ngu?i d�ng ch?m','/5'],['focus.burstFps','Ch?p li�n ti?p','fps'],
['video.maxResolution','D? ph�n gi?i video'],['video.maxFps','T?c d? khung h�nh','fps'],['video.codec','Codec'],['video.hdrLog','HDR / Log'],['video.bitDepth','D? s�u video','bit'],['video.stabilization','Ch?ng rung video'],['video.continuousLimit','Gi?i h?n quay'],
['durability.rating','Ch?ng b?i/nu?c'],['durability.display','M�n h�nh'],['durability.viewfinder','K�nh ng?m'],['power.battery','Pin'],['power.batteryShots','S? ?nh m?i l?n s?c','?nh'],['power.storage','Luu tr?'],['power.storageGB','Dung lu?ng','GB'],['power.weightG','Kh?i lu?ng','g'],['power.dimensionsMm','K�ch thu?c'],['power.connectivity','K?t n?i'],['power.price','Gi�']
].map(x=>({path:x[0],label:x[1],unit:x[2]||''}));
const groups={sensor:['type','size','megapixels','pixelPitchUm','iso','highISO','raw','rawBitDepth','colorDepth'],lens:['focal35mm','minFocal35mm','aperture','maxApertureF','opticalZoom','macro','mount','ecosystem'],focus:['autofocus','subjectTracking','subjectTrackingScore','stabilization','stabilizationScore','burstFps'],video:['maxResolution','maxFps','codec','hdrLog','bitDepth','stabilization','continuousLimit'],durability:['rating','display','viewfinder'],power:['battery','batteryShots','storage','storageGB','weightG','dimensionsMm','connectivity','price']};
export function expandDevice(d){const out={sensor:{},lens:{},focus:{},video:{},durability:{},power:{},...d};for(const [g,keys] of Object.entries(groups)){out[g]={...Object.fromEntries(keys.map(k=>[k,null])),...(d[g]||{})};}return out;}
export function compareDevices(devices,onlyDiff=false){return DEVICE_FIELDS.map(f=>{const vals=devices.map(d=>f.path.split('.').reduce((o,k)=>o&&o[k],d));const known=vals.filter(v=>v!==null&&v!==undefined&&v!=='');return {...f,values:vals,different:known.length>1&&new Set(known.map(v=>JSON.stringify(v))).size>1};}).filter(f=>!onlyDiff||f.different);}
export function deviceScore(device,purpose,config){const weights=config.purposes[purpose]||{};let sum=0,total=0,count=0;for(const [path,d] of Object.entries(weights)){const value=num(path.split('.').reduce((o,k)=>o&&o[k],device));if(value===null)continue;let score=clamp((value-d.min)/(d.max-d.min)*100);if(d.direction==='lower')score=100-score;sum+=score*d.weight;total+=d.weight;count++;}return {score:count>=2?Math.round(sum/total):null,count};}
const recommendationPath=(object,path)=>path.split('.').reduce((value,key)=>value&&value[key],object);
function recommendationNumber(device,field){
 const raw=recommendationPath(device,field.path);
 if(raw===null||raw===undefined||raw==='')return null;
 if(field.mode==='presence')return String(raw).trim()?100:null;
 if(field.parse==='mAh'){
  if(typeof raw==='number'&&Number.isFinite(raw))return raw;
  const match=String(raw).match(/(\\d+(?:[.,]\\d+)?)\\s*mAh/i);
  return match?Number(match[1].replace(',','.')):null;
 }
 if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
 const match=String(raw).match(/-?\\d+(?:[.,]\\d+)?/);
 return match?Number(match[0].replace(',','.')):null;
}
function recommendationPriceVnd(device){
 const raw=device?.power?.price;
 let amount=null,currency='';
 if(raw&&typeof raw==='object'){
  amount=Number(raw.amount??raw.value);
  currency=String(raw.currency||device?.power?.priceCurrency||'').toUpperCase();
  if(!Number.isFinite(amount))amount=Number(String(raw.amount??raw.value??'').replace(/[^0-9]/g,''));
 }else if(typeof raw==='number'){
  amount=raw;
  currency=String(device?.power?.priceCurrency||'').toUpperCase();
 }else if(typeof raw==='string'&&/(VND|?)/i.test(raw)){
  amount=Number(raw.replace(/[^0-9]/g,''));
  currency='VND';
 }
 return currency==='VND'&&Number.isFinite(amount)&&amount>0?amount:null;
}
export function recommendDevices(devices,filters={},configuration={}){
 const config=configuration.recommendation||configuration;
 const criteriaConfig=config.criteria||{};
 const purposes=config.purposeWeights||{};
 const purpose=purposes[filters.purpose]||purposes.portrait||{};
 const activeCriteria=Object.entries(purpose).filter(([id,weight])=>criteriaConfig[id]&&Number.isFinite(Number(weight))&&Number(weight)>0);
 const current=(filters.currentDeviceId?devices.find(device=>device.id===filters.currentDeviceId):null)||null;
 const requestedType=normalizeDeviceTypeFilter(filters.type||'all');
 const currentType=current?normalizeDeviceTypeFilter(current.type):'all';
 const effectiveType=requestedType!=='all'?requestedType:(current?currentType:'all');
 const matchingCandidates=devices.map(expandDevice).filter(device=>
  matchesDeviceType(device,effectiveType)&&(!current||device.id!==current.id)
 );
 const excludedUnscoreableCount=matchingCandidates.filter(device=>!isDeviceTypeScoreable(device)).length;
 const typedCandidates=matchingCandidates.filter(isDeviceTypeScoreable);
 const budget=Number(filters.budget);
 const hasBudget=Number.isFinite(budget)&&budget>0;
 const unknownPriceCount=hasBudget?typedCandidates.filter(device=>recommendationPriceVnd(device)===null).length:0;
 const overBudgetCount=hasBudget?typedCandidates.filter(device=>{const price=recommendationPriceVnd(device);return price!==null&&price>budget;}).length:0;
 const candidates=hasBudget?typedCandidates.filter(device=>{const price=recommendationPriceVnd(device);return price!==null&&price<=budget;}):typedCandidates;
 const selectedPriorities=new Set(Array.isArray(filters.priorities)?filters.priorities:[]);
 const boost=Number.isFinite(Number(config.priorityBoost))?Math.max(1,Number(config.priorityBoost)):1.7;
 const minimum=Math.max(1,Number(config.minimumKnownCriteria)||2);
 const ranked=candidates.map(device=>{
  const results=activeCriteria.map(([id,baseWeight])=>{
   const definition=criteriaConfig[id],known=[];
   for(const field of definition.fields||[]){
    const raw=recommendationPath(device,field.path),value=recommendationNumber(device,field);
    if(value===null)continue;
    let score;
    if(field.mode==='presence')score=100;
    else{
     const min=Number(field.min),max=Number(field.max);
     if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)continue;
     score=clamp((value-min)/(max-min)*100);
     if(field.direction==='lower')score=100-score;
    }
    known.push({label:field.label||field.path,path:field.path,value:raw,score:Math.round(score)});
   }
   if(!known.length)return {id,label:definition.label||id,score:null,weight:0,details:[]};
   const fieldWeight=known.reduce((sum,item)=>sum+(Number((definition.fields||[]).find(field=>field.path===item.path)?.weight)||1),0);
   const criterionScore=Math.round(known.reduce((sum,item)=>sum+item.score*(Number((definition.fields||[]).find(field=>field.path===item.path)?.weight)||1),0)/fieldWeight);
   const weight=Number(baseWeight)*(selectedPriorities.has(id)?boost:1);
   return {id,label:definition.label||id,score:criterionScore,weight,details:known,note:definition.note||''};
  });
  const available=results.filter(result=>result.score!==null&&result.weight>0);
  const totalWeight=available.reduce((sum,result)=>sum+result.weight,0);
  const score=available.length>=minimum&&totalWeight>0?Math.round(available.reduce((sum,result)=>sum+result.score*result.weight,0)/totalWeight):null;
  return {device,score,confidence:{known:available.length,total:activeCriteria.length,percent:activeCriteria.length?Math.round(available.length/activeCriteria.length*100):0},criteria:results,missingCriteria:results.filter(result=>result.score===null).map(result=>result.label),reasons:available.slice().sort((a,b)=>b.score-a.score).slice(0,3),priceVnd:recommendationPriceVnd(device)};
 }).filter(result=>result.score!==null).sort((a,b)=>b.score-a.score||String(a.device.brand+' '+a.device.model).localeCompare(String(b.device.brand+' '+b.device.model)));
 let message='';
 if(!ranked.length){
  const selectedType=getDeviceType(effectiveType);
  if(effectiveType!=='all'&&selectedType.scoreable===false)message='Lo?i '+selectedType.nameVi+' du?c gi? d? ph�n lo?i/l?c nhung kh�ng ph� h?p v?i b? ch?m di?m m�y ?nh th�ng thu?ng.';
  else if(matchingCandidates.length&&!typedCandidates.length)message='C�c thi?t b? kh?p thu?c nh�m kh�ng ph� h?p v?i b? ch?m di?m ?nh th�ng thu?ng.';
  else if(hasBudget&&typedCandidates.length&&candidates.length===0)message='Kh�ng c� m?u n�o c� gi� VND da bi?t n?m trong ng�n s�ch n�y.';
  else if(!typedCandidates.length)message='Kh�ng c� thi?t b? n�o kh?p lo?i ho?c thi?t b? n�ng c?p da ch?n.';
  else message='Chua c� d? th�ng s? c� ngu?n d? x?p h?ng. C?n �t nh?t '+minimum+' ti�u ch� c� d? li?u.';
 }
 const notices=[];
 if(excludedUnscoreableCount)notices.push('Da lo?i '+excludedUnscoreableCount+' thi?t b? chuy�n d?ng kh?i di?m m�y ?nh th�ng thu?ng.');
 if(hasBudget&&unknownPriceCount)notices.push(unknownPriceCount+' thi?t b? chua c� gi� VND n�n kh�ng th? x�c nh?n theo ng�n s�ch.');
 if(hasBudget&&overBudgetCount)notices.push(overBudgetCount+' thi?t b? c� gi� da bi?t vu?t ng�n s�ch.');
 return {recommendations:ranked.slice(0,Math.max(1,Number(config.maximumResults)||5)),message,notice:notices.join(' '),candidateCount:typedCandidates.length,eligibleCount:candidates.length,unknownPriceCount,overBudgetCount};
}
export function conditionScore(v={},genre='portrait',weightConfig={}){const W=weightConfig.weights||weightConfig,w=W[genre]||W.portrait||{};const c={rain:num(v.rain)==null?null:100-clamp(v.rain),wind:num(v.wind)==null?null:100-clamp((v.wind-5)*3,0,70),cloud:num(v.cloud)==null?null:(genre==='night'||genre==='moon'?100-clamp(v.cloud):100-Math.abs(v.cloud-(genre==='portrait'?35:25))*.8),visibility:num(v.visibility)==null?null:clamp(v.visibility),uv:num(v.uv)==null?null:100-clamp((v.uv-4)*8,0,60),pm:num(v.pm)==null?null:100-clamp((v.pm-5)*1.2,0,70)};const keys=Object.keys(w).filter(k=>Number.isFinite(c[k])&&Number.isFinite(w[k])&&w[k]>0);const weight=keys.reduce((s,k)=>s+w[k],0);if(keys.length<2||!weight)return {score:null,factors:c,why:'Chua d? s? li?u th?i ti?t.'};const score=Math.round(keys.reduce((s,k)=>s+c[k]*w[k],0)/weight);return {score,factors:c,why:'Di?m tham kh?o t? mua, gi�, m�y, t?m nh�n, UV v� PM2.5 hi?n c�; kh�ng ph?i cam k?t th?i ti?t.'};}
export function scoreHours(hourly,genre='portrait',offset=0,weightConfig={}){const now=Date.now(),until=now+48*60*60*1000;return (hourly.time||[]).map((time,i)=>{const timestamp=Date.parse(time+'Z')-offset*1000;if(!Number.isFinite(timestamp)||timestamp<now||timestamp>until)return null;const r=conditionScore({rain:hourly.precipitation_probability?.[i],wind:hourly.wind_speed_10m?.[i],cloud:hourly.cloud_cover?.[i],visibility:hourly.visibility?.[i]/100,uv:hourly.uv_index?.[i],pm:hourly.pm2_5?.[i]},genre,weightConfig);return {time,timestamp,score:r.score,temp:hourly.temperature_2m?.[i]??null,why:r.why};}).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);}
export function bestHours(hourly,genre='portrait',offset=0,weightConfig={}){return scoreHours(hourly,genre,offset,weightConfig).sort((a,b)=>(b.score??-1)-(a.score??-1)).slice(0,8);}
export function solarWindows(rise,set){const mins=s=>{const m=String(s||'').match(/T(\d\d):(\d\d)/);return m?+m[1]*60+ +m[2]:null;};const fmt=n=>n==null?'Chua c� d? li?u':String(Math.floor(((n%1440)+1440)%1440/60)).padStart(2,'0')+':'+String(((n%1440)+1440)%60).padStart(2,'0');const a=mins(rise),b=mins(set),sh=(v,n)=>v==null?null:v+n;return {rise:fmt(a),set:fmt(b),goldAM:fmt(sh(a,30))+'-'+fmt(sh(a,90)),goldPM:fmt(sh(b,-90))+'-'+fmt(sh(b,-30)),estimated:true};}
export function angleOptions(genre='portrait',subject='ch? th?',scene=''){const base=[['Ngang t?m m?t','Ngang m?t','L�i d? l?y khung tho�ng','D?t m?t g?n du?ng 1/3; ch?a kho?ng nh�n','Tr�nh d?ng qu� g?n g�c r?ng.'],['G�c th?p nh?','Th?p hon m?t 20-40 cm','Tang kho?ng c�ch n?u d�ng g�c r?ng','Dua ti?n c?nh v�o 1/3 du?i; gi? ch�n tr?i th?ng','Kh�ng ng?a m�y m?nh khi ch?p ki?n tr�c.'],['G�c cao v?a','Cao hon m?t 30-60 cm','L�i m?t bu?c d? kh�ng c?t kh?p','D�ng du?ng d?n d? t�ch ch? th? kh?i n?n','Tr�nh g�c qu� cao l�m bi?n d?ng t? l?.']];if(genre==='architecture')return base.map((x,i)=>({name:['Ch�nh di?n c�n tr?c','G�c ch�o c� ki?m so�t','T? cao nh�n m?t b?ng'][i],height:x[1],distance:x[2],composition:x[3],avoid:x[4],tips:'Gi? du?ng d?c th?ng; d�ng lu?i c�n m�y. Ti�u c? c? th? t�y thi?t b?.'}));return base.map(x=>({name:x[0],height:x[1],distance:x[2],composition:x[3],avoid:x[4],tips:'Ch? d?o '+subject+' thu gian; xem n?n '+(scene||'tru?c khi ch?p')+'. Ch�n dung uu ti�n 50-85 mm quy d?i n?u thi?t b? c�.'}));}
export function outfitOptions({temp=null,rain=null,wind=null,background='#56736f',style='T? nhi�n'}={}){const warm=temp!=null&&temp>=28,cold=temp!=null&&temp<=14,wet=rain!=null&&rain>=40,windy=wind!=null&&wind>=25;const options=[['T? nhi�n',['kem','xanh nh?t','v�ng d?t']],['Tuong ph?n ro',['xanh navy','n�u cacao','d? g?ch']],['Di?n ?nh',['d? ru?u','kem','xanh r�u']]];return options.map((x,i)=>({name:i===0?style:x[0],colors:x[1],clothes:warm?'V?i tho�ng, �t nhan; th�m m?t l?p nh?.':cold?'M?c nhi?u l?p m?ng, gi? ?m c? v� tay.':'Ao tron c�ng qu?n/v�y t�ng trung t�nh.',accessories:'Ph? ki?n g?n, tr�nh b? m?t ph?n quang.',reason:'B?ng m�u do b?n ch?n d? t?o t�ch bi?t v?i n?n '+background+'.',caution:'Tr�nh k? nh? g�y moir�, m�u tr�ng n?n v� tr?ng tinh du?i n?ng g?t.'+(wet?' Mang l?p ch?ng mua.':'')+(windy?' Gi� m?nh: c? d?nh ph? ki?n.':'')}));}
export function createPlanStore(storage=globalThis.localStorage){const key='photolens_plans_v1';const read=()=>{try{const x=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};const write=x=>{try{storage.setItem(key,JSON.stringify(x));return true;}catch{return false;}};return {list:read,save(p){const a=read(),id=p.id||((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()));const item={...p,id,updatedAt:new Date().toISOString()};const i=a.findIndex(x=>x.id===id);i<0?a.unshift(item):a.splice(i,1,item);return write(a)?item:null;},remove(id){return write(read().filter(x=>x.id!==id));}};}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
