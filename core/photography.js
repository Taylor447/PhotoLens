const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,n));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export const DEVICE_FIELDS=[
['sensor.type','Loại cảm biến'],['sensor.size','Kích thước cảm biến'],['sensor.megapixels','Độ phân giải','MP'],['sensor.pixelPitchUm','Pixel pitch','µm'],['sensor.iso','Dải ISO'],['sensor.highISO','ISO tối đa có thể chọn'],['sensor.raw','RAW'],['sensor.rawBitDepth','Độ sâu RAW','bit'],['sensor.colorDepth','Độ sâu màu','bit'],
['lens.focal35mm','Tiêu cự quy đổi 35mm'],['lens.minFocal35mm','Tiêu cự góc rộng quy đổi 35mm'],['lens.aperture','Khẩu độ'],['lens.maxApertureF','Khẩu độ lớn nhất','f/'],['lens.opticalZoom','Zoom quang','×'],['lens.macro','Macro'],['lens.mount','Ngàm'],['lens.ecosystem','Hệ ống kính'],
['focus.autofocus','Lấy nét'],['focus.subjectTracking','Theo dõi chủ thể'],['focus.subjectTrackingScore','Theo dõi chủ thể (điểm 0–5 do người dùng nhập)','/5'],['focus.stabilization','Chống rung'],['focus.stabilizationScore','Chống rung do người dùng chấm','/5'],['focus.burstFps','Chụp liên tiếp','fps'],
['video.maxResolution','Độ phân giải video'],['video.maxFps','Tốc độ khung hình','fps'],['video.codec','Codec'],['video.hdrLog','HDR / Log'],['video.bitDepth','Độ sâu video','bit'],['video.stabilization','Chống rung video'],['video.continuousLimit','Giới hạn quay'],
['durability.rating','Chống bụi/nước'],['durability.display','Màn hình'],['durability.viewfinder','Kính ngắm'],['power.battery','Pin'],['power.batteryShots','Số ảnh mỗi lần sạc','ảnh'],['power.storage','Lưu trữ'],['power.storageGB','Dung lượng','GB'],['power.weightG','Khối lượng','g'],['power.dimensionsMm','Kích thước'],['power.connectivity','Kết nối'],['power.price','Giá']
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
function recommendationType(type){
 const value=String(type||'other').toLowerCase().trim().replace(/[ _]+/g,'-');
 if(['action-camera','actioncam','action-cam'].includes(value))return 'action';
 if(['smartphone','mobile-phone'].includes(value))return 'phone';
 if(value==='my-device')return 'other';
 return value;
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
 }else if(typeof raw==='string'&&/(VND|₫)/i.test(raw)){
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
 const requestedType=String(filters.type||'all');
 const effectiveType=requestedType!=='all'?recommendationType(requestedType):(current?recommendationType(current.type):'all');
 const typedCandidates=devices.map(expandDevice).filter(device=>
  (!effectiveType||effectiveType==='all'||recommendationType(device.type)===effectiveType)&&
  (!current||device.id!==current.id)
 );
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
  if(hasBudget&&typedCandidates.length&&candidates.length===0)message='Không có mẫu nào có giá VND đã biết nằm trong ngân sách này.';
  else if(!typedCandidates.length)message='Không có thiết bị nào khớp loại hoặc thiết bị nâng cấp đã chọn.';
  else message='Chưa có đủ thông số có nguồn để xếp hạng. Cần ít nhất '+minimum+' tiêu chí có dữ liệu.';
 }
 const notices=[];
 if(hasBudget&&unknownPriceCount)notices.push(unknownPriceCount+' thiết bị chưa có giá VND nên không thể xác nhận theo ngân sách.');
 if(hasBudget&&overBudgetCount)notices.push(overBudgetCount+' thiết bị có giá đã biết vượt ngân sách.');
 return {recommendations:ranked.slice(0,Math.max(1,Number(config.maximumResults)||5)),message,notice:notices.join(' '),candidateCount:typedCandidates.length,eligibleCount:candidates.length,unknownPriceCount,overBudgetCount};
}
export function conditionScore(v={},genre='portrait',weightConfig={}){const W=weightConfig.weights||weightConfig,w=W[genre]||W.portrait||{};const c={rain:num(v.rain)==null?null:100-clamp(v.rain),wind:num(v.wind)==null?null:100-clamp((v.wind-5)*3,0,70),cloud:num(v.cloud)==null?null:(genre==='night'||genre==='moon'?100-clamp(v.cloud):100-Math.abs(v.cloud-(genre==='portrait'?35:25))*.8),visibility:num(v.visibility)==null?null:clamp(v.visibility),uv:num(v.uv)==null?null:100-clamp((v.uv-4)*8,0,60),pm:num(v.pm)==null?null:100-clamp((v.pm-5)*1.2,0,70)};const keys=Object.keys(w).filter(k=>Number.isFinite(c[k])&&Number.isFinite(w[k])&&w[k]>0);const weight=keys.reduce((s,k)=>s+w[k],0);if(keys.length<2||!weight)return {score:null,factors:c,why:'Chưa đủ số liệu thời tiết.'};const score=Math.round(keys.reduce((s,k)=>s+c[k]*w[k],0)/weight);return {score,factors:c,why:'Điểm tham khảo từ mưa, gió, mây, tầm nhìn, UV và PM2.5 hiện có; không phải cam kết thời tiết.'};}
export function scoreHours(hourly,genre='portrait',offset=0,weightConfig={}){const now=Date.now(),until=now+48*60*60*1000;return (hourly.time||[]).map((time,i)=>{const timestamp=Date.parse(time+'Z')-offset*1000;if(!Number.isFinite(timestamp)||timestamp<now||timestamp>until)return null;const r=conditionScore({rain:hourly.precipitation_probability?.[i],wind:hourly.wind_speed_10m?.[i],cloud:hourly.cloud_cover?.[i],visibility:hourly.visibility?.[i]/100,uv:hourly.uv_index?.[i],pm:hourly.pm2_5?.[i]},genre,weightConfig);return {time,timestamp,score:r.score,temp:hourly.temperature_2m?.[i]??null,why:r.why};}).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);}
export function bestHours(hourly,genre='portrait',offset=0,weightConfig={}){return scoreHours(hourly,genre,offset,weightConfig).sort((a,b)=>(b.score??-1)-(a.score??-1)).slice(0,8);}
export function solarWindows(rise,set){const mins=s=>{const m=String(s||'').match(/T(\d\d):(\d\d)/);return m?+m[1]*60+ +m[2]:null;};const fmt=n=>n==null?'Chưa có dữ liệu':String(Math.floor(((n%1440)+1440)%1440/60)).padStart(2,'0')+':'+String(((n%1440)+1440)%60).padStart(2,'0');const a=mins(rise),b=mins(set),sh=(v,n)=>v==null?null:v+n;return {rise:fmt(a),set:fmt(b),goldAM:fmt(sh(a,30))+'–'+fmt(sh(a,90)),goldPM:fmt(sh(b,-90))+'–'+fmt(sh(b,-30)),estimated:true};}
export function angleOptions(genre='portrait',subject='chủ thể',scene=''){const base=[['Ngang tầm mắt','Ngang mắt','Lùi để lấy khung thoáng','Đặt mắt gần đường 1/3; chừa khoảng nhìn','Tránh đứng quá gần góc rộng.'],['Góc thấp nhẹ','Thấp hơn mắt 20–40 cm','Tăng khoảng cách nếu dùng góc rộng','Đưa tiền cảnh vào 1/3 dưới; giữ chân trời thẳng','Không ngửa máy mạnh khi chụp kiến trúc.'],['Góc cao vừa','Cao hơn mắt 30–60 cm','Lùi một bước để không cắt khớp','Dùng đường dẫn để tách chủ thể khỏi nền','Tránh góc quá cao làm biến dạng tỷ lệ.']];if(genre==='architecture')return base.map((x,i)=>({name:['Chính diện cân trục','Góc chéo có kiểm soát','Từ cao nhìn mặt bằng'][i],height:x[1],distance:x[2],composition:x[3],avoid:x[4],tips:'Giữ đường dọc thẳng; dùng lưới cân máy. Tiêu cự cụ thể tùy thiết bị.'}));return base.map(x=>({name:x[0],height:x[1],distance:x[2],composition:x[3],avoid:x[4],tips:'Chỉ đạo '+subject+' thư giãn; xem nền '+(scene||'trước khi chụp')+'. Chân dung ưu tiên 50–85 mm quy đổi nếu thiết bị có.'}));}
export function outfitOptions({temp=null,rain=null,wind=null,background='#56736f',style='Tự nhiên'}={}){const warm=temp!=null&&temp>=28,cold=temp!=null&&temp<=14,wet=rain!=null&&rain>=40,windy=wind!=null&&wind>=25;const options=[['Tự nhiên',['kem','xanh nhạt','vàng đất']],['Tương phản rõ',['xanh navy','nâu cacao','đỏ gạch']],['Điện ảnh',['đỏ rượu','kem','xanh rêu']]];return options.map((x,i)=>({name:i===0?style:x[0],colors:x[1],clothes:warm?'Vải thoáng, ít nhăn; thêm một lớp nhẹ.':cold?'Mặc nhiều lớp mỏng, giữ ấm cổ và tay.':'Áo trơn cùng quần/váy tông trung tính.',accessories:'Phụ kiện gọn, tránh bề mặt phản quang.',reason:'Bảng màu do bạn chọn để tạo tách biệt với nền '+background+'.',caution:'Tránh kẻ nhỏ gây moiré, màu trùng nền và trắng tinh dưới nắng gắt.'+(wet?' Mang lớp chống mưa.':'')+(windy?' Gió mạnh: cố định phụ kiện.':'')}));}
export function createPlanStore(storage=globalThis.localStorage){const key='photolens_plans_v1';const read=()=>{try{const x=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};const write=x=>{try{storage.setItem(key,JSON.stringify(x));return true;}catch{return false;}};return {list:read,save(p){const a=read(),id=p.id||((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()));const item={...p,id,updatedAt:new Date().toISOString()};const i=a.findIndex(x=>x.id===id);i<0?a.unshift(item):a.splice(i,1,item);return write(a)?item:null;},remove(id){return write(read().filter(x=>x.id!==id));}};}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));