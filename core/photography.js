const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,n));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
export function conditionScore(v={},genre='portrait',weightConfig={}){const W=weightConfig.weights||weightConfig,w=W[genre]||W.portrait||{};const c={rain:num(v.rain)==null?null:100-clamp(v.rain),wind:num(v.wind)==null?null:100-clamp((v.wind-5)*3,0,70),cloud:num(v.cloud)==null?null:(genre==='night'||genre==='moon'?100-clamp(v.cloud):100-Math.abs(v.cloud-(genre==='portrait'?35:25))*.8),visibility:num(v.visibility)==null?null:clamp(v.visibility),uv:num(v.uv)==null?null:100-clamp((v.uv-4)*8,0,60),pm:num(v.pm)==null?null:100-clamp((v.pm-5)*1.2,0,70)};const keys=Object.keys(w).filter(k=>Number.isFinite(c[k])&&Number.isFinite(w[k])&&w[k]>0);const weight=keys.reduce((s,k)=>s+w[k],0);if(keys.length<2||!weight)return {score:null,factors:c,why:'Chưa đủ số liệu thời tiết.'};const score=Math.round(keys.reduce((s,k)=>s+c[k]*w[k],0)/weight);return {score,factors:c,why:'Điểm tham khảo từ mưa, gió, mây, tầm nhìn, UV và PM2.5 hiện có; không phải cam kết thời tiết.'};}
export function scoreHours(hourly,genre='portrait',offset=0,weightConfig={}){const now=Date.now(),until=now+48*60*60*1000;return (hourly.time||[]).map((time,i)=>{const timestamp=Date.parse(time+'Z')-offset*1000;if(!Number.isFinite(timestamp)||timestamp<now||timestamp>until)return null;const r=conditionScore({rain:hourly.precipitation_probability?.[i],wind:hourly.wind_speed_10m?.[i],cloud:hourly.cloud_cover?.[i],visibility:hourly.visibility?.[i]/100,uv:hourly.uv_index?.[i],pm:hourly.pm2_5?.[i]},genre,weightConfig);return {time,timestamp,score:r.score,temp:hourly.temperature_2m?.[i]??null,why:r.why};}).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);}
export function bestHours(hourly,genre='portrait',offset=0,weightConfig={}){return scoreHours(hourly,genre,offset,weightConfig).sort((a,b)=>(b.score??-1)-(a.score??-1)).slice(0,8);}
export function solarWindows(rise,set){const mins=s=>{const m=String(s||'').match(/T(\d\d):(\d\d)/);return m?+m[1]*60+ +m[2]:null;};const fmt=n=>n==null?'Chưa có dữ liệu':String(Math.floor(((n%1440)+1440)%1440/60)).padStart(2,'0')+':'+String(((n%1440)+1440)%60).padStart(2,'0');const a=mins(rise),b=mins(set),sh=(v,n)=>v==null?null:v+n;return {rise:fmt(a),set:fmt(b),goldAM:fmt(sh(a,30))+'–'+fmt(sh(a,90)),goldPM:fmt(sh(b,-90))+'–'+fmt(sh(b,-30)),estimated:true};}
export function angleOptions(genre='portrait',subject='chủ thể',scene='',poseType='solo'){
 const architecture=genre==='architecture';
 const base=architecture?[
  ['Chính diện cân trục','Ngang tầm máy','Lùi đủ xa để tránh méo phối cảnh','Căn các đường dọc song song mép khung; đặt chủ thể lệch nhẹ khỏi trục chính','Tránh nghiêng máy khi đường thẳng của công trình là điểm nhấn.'],
  ['Góc chéo có kiểm soát','Ngang tầm hoặc thấp hơn nhẹ','Đứng chéo công trình, giữ khoảng cách an toàn','Dùng cạnh tường hoặc hàng cột làm đường dẫn vào khung','Tránh đứng quá sát góc rộng vì sẽ kéo méo cạnh.'],
  ['Từ cao nhìn mặt bằng','Cao hơn chủ thể hoặc vị trí chụp','Lùi lại để thấy hình khối tổng thể','Dùng bóng đổ và khoảng trống để tạo nhịp','Tránh để người hoặc vật nhỏ bị lẫn vào nền.']
 ]:[
  ['Ngang tầm mắt','Đặt máy ngang mắt chủ thể','Lùi vừa đủ để lấy cả dáng và bối cảnh','Đặt mắt gần đường 1/3; chừa khoảng nhìn theo hướng mặt','Tránh đứng quá gần ống kính góc rộng.'],
  ['Góc thấp nhẹ','Đặt máy thấp hơn mắt khoảng 20–40 cm','Lùi thêm một bước để giữ tỷ lệ tự nhiên','Dùng tiền cảnh ở 1/3 dưới để tạo chiều sâu','Tránh ngửa máy quá mạnh hoặc cắt bàn chân tại khớp.'],
  ['Góc cao vừa','Đặt máy cao hơn mắt khoảng 30–60 cm','Lùi nhẹ để không cắt khớp tay chân','Dùng đường dẫn hoặc nền gọn để tách chủ thể','Tránh chụp quá cao khiến đầu và thân mất cân đối.']
 ];
 const people=String(subject||'chủ thể').trim()||'chủ thể';
 const poseGuides={
  solo:[
   'Xoay vai và thân khoảng 30°; dồn trọng tâm lên chân sau, thả lỏng vai và để tay có điểm tựa tự nhiên.',
   'Bước một chân nhẹ về phía máy, xoay người theo hướng sáng; giữ tay đang chuyển động mềm để dáng bớt cứng.',
   'Tựa nhẹ vào lan can hoặc ngồi chếch; đặt hai tay thoải mái, nhìn vào máy hoặc nhìn lệch theo hướng ánh sáng.'
  ],
  couple:[
   'Đứng chéo nhau thay vì xếp thành một hàng; xoay nhẹ về phía nhau và tạo tương tác bằng ánh mắt hoặc một cử chỉ nhỏ.',
   'Cùng bước chậm về phía máy hoặc nhìn nhau; để tay gần nhau tự nhiên, tránh kéo vai cứng vào ống kính.',
   'Ngồi hoặc đứng so le trước sau; một người nhìn máy, người còn lại nhìn bạn đồng hành để khung hình có nhịp.'
  ],
  group:[
   'Xếp so le theo chiều sâu, để mọi khuôn mặt cùng thấy rõ; mỗi người xoay vai nhẹ thay vì đứng thẳng hàng.',
   'Tạo đội hình chữ V hoặc vòng cung; người ở giữa lùi nửa bước, cả nhóm thả lỏng tay và nhìn cùng một hướng.',
   'Kết hợp người đứng và ngồi để tạo tầng; giữ khoảng trống quanh đầu, tránh để tay che mặt người bên cạnh.'
  ]
 };
 const poses=poseGuides[poseType]||poseGuides.solo;
 const sceneText=String(scene||'').trim();
 return base.map((item,i)=>({
  name:item[0],height:item[1],distance:item[2],composition:item[3],avoid:item[4],
  poseTip:poses[i],
  tips:sceneText?'Với bối cảnh “'+sceneText+'”, giữ nền gọn và đặt '+people+' tách khỏi các đường hoặc vật thể phía sau.':'Lấy nét vào mắt của '+people+'; chụp vài khung liên tiếp khi chủ thể chuyển động tự nhiên.'
 }));
}
export function outfitOptions({temp=null,rain=null,wind=null,background='#56736f',style='Tự nhiên'}={}){const warm=temp!=null&&temp>=28,cold=temp!=null&&temp<=14,wet=rain!=null&&rain>=40,windy=wind!=null&&wind>=25;const options=[['Tự nhiên',['kem','xanh nhạt','vàng đất']],['Tương phản rõ',['xanh navy','nâu cacao','đỏ gạch']],['Điện ảnh',['đỏ rượu','kem','xanh rêu']]];return options.map((x,i)=>({name:i===0?style:x[0],colors:x[1],clothes:warm?'Vải thoáng, ít nhăn; thêm một lớp nhẹ.':cold?'Mặc nhiều lớp mỏng, giữ ấm cổ và tay.':'Áo trơn cùng quần/váy tông trung tính.',accessories:'Phụ kiện gọn, tránh bề mặt phản quang.',reason:'Bảng màu do bạn chọn để tạo tách biệt với nền '+background+'.',caution:'Tránh kẻ nhỏ gây moiré, màu trùng nền và trắng tinh dưới nắng gắt.'+(wet?' Mang lớp chống mưa.':'')+(windy?' Gió mạnh: cố định phụ kiện.':'')}));}
export function createPlanStore(storage=globalThis.localStorage){const key='photolens_plans_v1';const read=()=>{try{const x=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};const write=x=>{try{storage.setItem(key,JSON.stringify(x));return true;}catch{return false;}};return {list:read,save(p){const a=read(),id=p.id||((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()));const item={...p,id,updatedAt:new Date().toISOString()};const i=a.findIndex(x=>x.id===id);i<0?a.unshift(item):a.splice(i,1,item);return write(a)?item:null;},remove(id){return write(read().filter(x=>x.id!==id));}};}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));