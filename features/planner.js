import '../css/planner.css';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import builtIns from '../data/devices.json';
import spotsSeed from '../data/spots.json';
import scoreConfig from '../data/device-scoring.json';
import weatherConfig from '../data/weather-scoring.json';
import {DEVICE_FIELDS,expandDevice,compareDevices,deviceScore,conditionScore,bestHours,solarWindows,angleOptions,outfitOptions,createPlanStore,scoreHours,esc} from '../core/photography.js';

const $=(s,r=document)=>r.querySelector(s), genres={portrait:'Chân dung',landscape:'Phong cảnh',architecture:'Kiến trúc',street:'Đường phố',night:'Đường phố đêm',moon:'Chụp trăng',cosplay:'Cosplay',documentary:'Tư liệu'};
let panel=null,tab='devices',place={label:'Hà Nội'},forecast=null,spots=[],pickedSpot=null,genre='portrait',onlyDiff=false,editingPlan='',aiResult=null,aiRoute='',aiMessage='',showEstimatedCost=false;
const repo=createPlanStore();
const json=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};
const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const myDevices=()=>json('photolens_my_devices_v1',[]).map(expandDevice);
const devices=()=>builtIns.map(expandDevice).concat(myDevices());
const get=(o,path)=>path.split('.').reduce((a,k)=>a&&a[k],o);
const fmt=(v,u='')=>v===null||v===undefined||v===''?'Chưa có dữ liệu':String(Array.isArray(v)?v.join(', '):v)+(u?' '+u:'');
const safeHttpUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:'';}catch{return '';}};
const options=(data,current)=>data.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===current?'selected':'')+'>'+esc(x[1])+'</option>').join('');
function makeTabs(){return [['devices','Thiết bị'],['weather','Thời tiết'],['spots','Địa điểm'],['angles','Góc chụp'],['outfit','Trang phục'],['plans','Kế hoạch']].map(x=>'<button role="tab" aria-selected="'+(tab===x[0])+'" class="'+(tab===x[0]?'active':'')+'" data-tab="'+x[0]+'">'+x[1]+'</button>').join('');}
function deviceView(){const all=devices();let ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']);ids=ids.filter(Boolean).slice(0,3);const picked=ids.map(id=>all.find(d=>d.id===id)).filter(Boolean);const rows=compareDevices(picked,onlyDiff);let html='<div class="planner-head"><div><h3>So sánh thiết bị</h3><p>Thiếu thông số sẽ hiện “Chưa có dữ liệu”. Mẫu được đánh dấu chưa xác minh.</p></div><button class="planner-btn" data-action="add-device">+ Thiết bị của tôi</button></div><div class="planner-card"><div class="planner-row">';
for(let i=0;i<3;i++){html+='<label>Thiết bị '+String.fromCharCode(65+i)+'<select data-device="'+i+'">'+(i===2?'<option value="">Không chọn</option>':'')+all.map(d=>'<option value="'+esc(d.id)+'" '+(picked[i]&&picked[i].id===d.id?'selected':'')+'>'+esc(d.brand+' '+d.model)+'</option>').join('')+'</select></label>';}
html+='</div><label class="planner-check"><input type="checkbox" data-diff '+(onlyDiff?'checked':'')+'> Chỉ hiện thông số đã biết và khác nhau</label><div class="planner-badges">'+picked.map(d=>'<span class="planner-badge">'+(d.verified?'Đã xác minh':'Chưa xác minh')+'</span>').join('')+'</div>'+picked.map(d=>safeHttpUrl(d.sourceUrl)?'<small class="planner-source">Nguồn hãng: <a href="'+esc(safeHttpUrl(d.sourceUrl))+'" target="_blank" rel="noopener">'+esc(d.brand+' '+d.model)+'</a> · kiểm tra '+esc(d.checkedAt||'Chưa có ngày')+'</small>':'').join('')+'</div>';
html+='<div class="planner-table-wrap"><table class="planner-table"><thead><tr><th>Yếu tố</th>'+picked.map(d=>'<th>'+esc(d.brand+' '+d.model)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r.label)+'</th>'+r.values.map(v=>'<td>'+esc(fmt(v,r.unit))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
html+='<div class="planner-card"><h4>Điểm theo mục đích</h4><label>Mục đích<select data-purpose>'+options(Object.entries({portrait:'Chân dung',travel:'Du lịch',lowLight:'Thiếu sáng',video:'Video / vlog',architecture:'Kiến trúc',sports:'Thể thao / động vật',editing:'Hậu kỳ'}),'portrait')+'</select></label><div class="planner-score-grid">'+picked.map(d=>{const s=deviceScore(d,'portrait',scoreConfig);return '<article><b>'+esc(d.brand+' '+d.model)+'</b><strong>'+(s.score===null?'Chưa đủ dữ liệu':s.score+'/100')+'</strong><small>'+s.count+' trường số có dữ liệu</small></article>';}).join('')+'</div><details><summary>Cách tính điểm</summary><p>Chuẩn hóa từng trường theo min/max và trọng số trong data/device-scoring.json. Không có ít nhất hai trường số thì không chấm điểm.</p></details></div>';
const custom=all.filter(d=>d.userCreated);html+='<div class="planner-card"><h4>Thiết bị của tôi</h4>'+(custom.length?custom.map(d=>'<p>'+esc(d.brand+' '+d.model)+' <button class="planner-link danger" data-delete-device="'+esc(d.id)+'">Xóa</button></p>').join(''):'<p>Chưa có thiết bị tự thêm.</p>')+'<p class="planner-muted">Khi thêm, nhập thông số JSON đã đối chiếu nhà sản xuất; PhotoLens không tự xác minh.</p></div><div class="planner-card"><button class="planner-primary" data-action="ai-devices">AI diễn giải dữ liệu đã nhập</button><p class="planner-muted">Chỉ dùng thông số đang có trong bảng; thiếu dữ liệu sẽ không được tự điền.</p></div>'+aiPanel('/devices/summary');return html;}
function weatherView(){if(!forecast)return '<div class="planner-head"><div><h3>Thời tiết & khung giờ chụp</h3><p>Mặc định không xin vị trí tự động.</p></div></div><form class="planner-card" data-form="weather"><label>Thành phố / địa điểm<input name="place" value="'+esc(place?.label||'')+'" placeholder="Ví dụ: Hà Đông, Hà Nội" required></label><div class="planner-row"><button class="planner-primary">Tìm dự báo</button><button type="button" class="planner-btn" data-action="locate">Dùng vị trí hiện tại</button></div></form><p class="planner-status">'+esc(status||'Nhập địa điểm để tải dự báo Open-Meteo.')+'</p>';
const c=forecast.current||{},d=forecast.daily||{},h=forecast.hourly||{},ranked=bestHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),timeline=scoreHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),solar=d.sunrise?.[0]?solarWindows(d.sunrise[0],d.sunset?.[0]):null;
let html='<div class="planner-head"><div><h3>Thời tiết & khung giờ chụp</h3><p>'+esc(place.label)+' · nguồn Open-Meteo</p></div><button class="planner-btn" data-action="change-city">Đổi địa điểm</button></div><div class="planner-weather-grid"><article><small>Hiện tại</small><strong>'+fmt(c.temperature_2m)+'°C</strong><span>Cảm giác '+fmt(c.apparent_temperature)+'° · mây '+fmt(c.cloud_cover)+'% · gió '+fmt(c.wind_speed_10m)+' km/h</span></article><article><small>PM2.5</small><strong>'+fmt(forecast.pm25,'µg/m³')+'</strong><span>Cập nhật '+new Date(forecast.fetchedAt).toLocaleString('vi-VN')+(forecast.cached?' · bản lưu':'')+'</span></article></div><div class="planner-card"><div class="planner-row"><label>Thể loại<select data-genre>'+options(Object.entries(genres).filter(x=>['portrait','landscape','architecture','street','night','moon'].includes(x[0])),genre)+'</select></label><div class="planner-callout">Khung đẹp nhất: <b>'+esc(ranked[0]?.time?.replace('T',' ')||'Chưa có dữ liệu')+'</b> · '+(ranked[0]?.score??'—')+'/100</div></div><p class="planner-muted">Điểm là thứ hạng tham khảo theo mưa, mây, gió, tầm nhìn, UV, PM2.5; không bảo đảm ánh sáng tại chỗ.</p><div class="planner-hours">'+ranked.slice(0,8).map(x=>'<div><b>'+esc(x.time.slice(11,16))+'</b><span>'+fmt(x.temp)+'°</span><strong>'+(x.score??'—')+'</strong></div>').join('')+'</div><h4>48 giờ tới</h4><div class="planner-hour-strip">'+timeline.map(x=>'<div title="'+esc(x.time.replace('T',' '))+' · '+(x.score??'Chưa đủ dữ liệu')+'/100"><b>'+esc(x.time.slice(5,16).replace('T',' '))+'</b><span>'+fmt(x.temp)+'°</span><strong>'+(x.score??'—')+'</strong></div>').join('')+'</div></div><div class="planner-card"><h4>Dự báo 7 ngày</h4><div class="planner-hours">'+(d.time||[]).slice(0,7).map((x,i)=>'<div><b>'+esc(x.slice(5))+'</b><span>'+(d.temperature_2m_max?.[i]??'—')+'°/'+(d.temperature_2m_min?.[i]??'—')+'°</span><strong>Mưa '+(d.precipitation_probability_max?.[i]??'—')+'%</strong></div>').join('')+'</div></div>';
if(solar)html+='<div class="planner-card"><h4>Bình minh / hoàng hôn & giờ vàng ước tính</h4><p>Bình minh '+solar.rise+' · Giờ vàng sáng '+solar.goldAM+' · Giờ vàng chiều '+solar.goldPM+' · Hoàng hôn '+solar.set+'</p><p class="planner-muted">Giờ vàng là khoảng ước tính theo độ lệch thời gian, không phải đo ánh sáng tại địa điểm.</p></div>';
return html+'<p class="planner-attribution">Nguồn thời tiết: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>; dữ liệu không khí CAMS ENSEMBLE.</p>';}
let status='';
function spotsView(){const items=spots.concat(spotsSeed.map(s=>({...s,curated:true})));let html='<div class="planner-head"><div><h3>Địa điểm chụp</h3><p>'+esc(place?.label||'Chọn vị trí từ mục Thời tiết để tìm quanh đó')+'</p></div><button class="planner-primary" data-action="find-spots">Tìm quanh vị trí</button></div>';
if(Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)){const d=.025,bounds=[place.longitude-d,place.latitude-d,place.longitude+d,place.latitude+d].join(','),mapUrl='https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bounds)+'&layer=mapnik&marker='+place.latitude+'%2C'+place.longitude,fullMapUrl='https://www.openstreetmap.org/?mlat='+place.latitude+'&mlon='+place.longitude+'#map=14/'+place.latitude+'/'+place.longitude;html+='<div class="planner-map"><iframe title="Bản đồ OpenStreetMap quanh vị trí" loading="lazy" src="'+esc(mapUrl)+'"></iframe><div class="planner-map-link"><a href="'+esc(fullMapUrl)+'" target="_blank" rel="noopener">Nếu bản đồ nhúng không tải, mở OpenStreetMap ↗</a><small>© OpenStreetMap contributors</small></div></div>';}
html+='<p class="planner-status">'+esc(status)+'</p><div class="planner-spot-grid">';
html+=items.slice(0,30).map(s=>{const name=s.name||s.tags?.name||'Địa điểm';const lat=s.lat??s.latitude,lon=s.lon??s.longitude;const url=Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))?'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon:(s.source||'https://www.openstreetmap.org/search?query='+encodeURIComponent(s.search||name));return '<article><h4>'+esc(name)+'</h4><small>'+(s.curated?'Gợi ý tên · chưa có tọa độ':'OpenStreetMap')+'</small><p>'+esc(s.note||'Giờ mở cửa/quyền chụp: Chưa có dữ liệu; hãy tự xác minh.')+'</p><a class="planner-btn" href="'+esc(url)+'" target="_blank" rel="noopener">Mở bản đồ ↗</a><button class="planner-link" data-select-spot="'+esc(s.id||name)+'">Chọn</button></article>';}).join('');
html+='<div class="planner-card"><button class="planner-primary" data-action="ai-spots">AI xếp hạng danh sách này</button><p class="planner-muted">AI chỉ được chọn các địa điểm đang hiển thị; không tự tạo tên địa điểm.</p></div>'+aiPanel('/spots/rank')+'</div><p class="planner-attribution">Dữ liệu bản đồ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors (ODbL)</a>. Tự kiểm tra quyền vào/chụp, quy định drone và an toàn tại chỗ.</p>';return html;}
function angleView(){const angles=angleOptions(genre,json('photolens_angle_subject','chủ thể'),json('photolens_angle_scene',''));return '<div class="planner-head"><div><h3>Gợi ý góc chụp</h3><p>Gợi ý bố cục theo thể loại; không khẳng định máy hỗ trợ ISO/tốc độ thủ công.</p></div></div><form class="planner-card" data-form="angles"><div class="planner-row"><label>Thể loại<select name="genre">'+options(Object.entries(genres),genre)+'</select></label><label>Chủ thể<input name="subject" value="'+esc(json('photolens_angle_subject','chủ thể'))+'"></label><label>Bối cảnh<input name="scene" value="'+esc(json('photolens_angle_scene',''))+'"></label><button class="planner-primary">Tạo gợi ý</button></div></form><div class="planner-angle-grid">'+angles.map((a,i)=>'<article><svg width="160" height="80" viewBox="0 0 160 80" aria-label="Sơ đồ vị trí máy"><path d="M15 65h130M35 18v47M125 18v47M35 18l90 47M125 18 35 65" stroke="currentColor" fill="none" opacity=".4"/><circle cx="'+(35+i*4)+'" cy="'+(35+i*10)+'" r="6" fill="var(--color-accent)"/><circle cx="125" cy="42" r="9" fill="none" stroke="currentColor"/></svg><h4>'+esc(a.name)+'</h4><p>Độ cao: '+esc(a.height)+'</p><p>Khoảng cách: '+esc(a.distance)+'</p><p>Bố cục: '+esc(a.composition)+'</p><p>'+esc(a.tips||'')+'</p><p>Tránh: '+esc(a.avoid)+'</p><small>Khẩu độ/ISO/tốc độ: Chưa có dữ liệu hỗ trợ trên thiết bị.</small></article>').join('')+'</div><div class="planner-card"><button class="planner-primary" data-action="ai-angles">AI gợi ý thêm</button><p class="planner-muted">AI chỉ dùng thể loại, chủ thể và bối cảnh bạn nhập.</p></div>'+aiPanel('/angles');}
function outfitView(){const current=forecast?.current||{};const bg=json('photolens_bg_color','#56736f');const list=outfitOptions({temp:current.temperature_2m,rain:current.precipitation,wind:current.wind_speed_10m,background:bg,style:json('photolens_outfit_style','Tự nhiên')});return '<div class="planner-head"><div><h3>Trang phục lên ảnh</h3><p>Không suy đoán ngoại hình, vóc dáng, màu da, giới tính hay tuổi.</p></div></div><div class="planner-card planner-row"><label>Phong cách<select data-style>'+options([['Tự nhiên','Tự nhiên'],['Tối giản','Tối giản'],['Điện ảnh','Điện ảnh'],['Năng động','Năng động'],['Cổ điển','Cổ điển']],json('photolens_outfit_style','Tự nhiên'))+'</select></label><label>Màu nền dự kiến<input type="color" data-bg value="'+esc(bg)+'"></label><span>'+ (current.temperature_2m==null?'Chưa có dữ liệu thời tiết':current.temperature_2m+'°C · mưa '+(current.precipitation??'—')+' mm · gió '+(current.wind_speed_10m??'—')+' km/h')+'</span></div><div class="planner-outfit-grid">'+list.map(x=>'<article><h4>'+esc(x.name)+'</h4><p>Màu: '+x.colors.map(c=>'<span class="planner-swatch">'+esc(c)+'</span>').join(' ')+'</p><p>'+esc(x.clothes)+'</p><p>'+esc(x.reason)+'</p><p>Lưu ý: '+esc(x.caution)+'</p></article>').join('')+'</div><div class="planner-card"><button class="planner-primary" data-action="ai-outfit">AI gợi ý phối đồ</button><p class="planner-muted">AI chỉ dùng phong cách, màu nền và số liệu thời tiết đang có.</p></div>'+aiPanel('/outfit');}
function aiPanel(route){
 if(aiRoute!==route)return '';
 if(aiMessage)return '<div class="planner-card planner-status" role="status">'+esc(aiMessage)+'</div>';
 if(!aiResult)return '';
 const render=(title,text)=>'<article><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p></article>';
 let items=[];
 if(route==='/devices/summary')items=(aiResult.summaries||[]).map(x=>render(x.id,x.summary+' · Phù hợp: '+x.bestFor+' · Giới hạn: '+x.limitations));
 if(route==='/spots/rank')items=(aiResult.ranked||[]).map(x=>{const spot=spots.concat(spotsSeed).find(s=>String(s.id)===x.id);return render(spot?.name||spot?.tags?.name||x.id,x.score+'/100 · '+x.reason);});
 if(route==='/angles')items=(aiResult.angles||[]).map(x=>render(x.name,x.cameraHeight+' · '+x.distance+' · '+x.focalLength+' · '+x.composition+' · '+x.direction+' · Tránh: '+x.avoid+' · '+x.settingsNote));
 if(route==='/outfit')items=(aiResult.sets||[]).map((x,i)=>render('Phối đồ '+(i+1),x.colors.join(', ')+' · '+x.clothing+' · '+x.accessories+' · '+x.reason+' · Lưu ý: '+x.caution));
 const usage=aiResult.usage;const usageText=showEstimatedCost&&usage?'Token vào '+usage.inputTokens+' · token ra '+usage.outputTokens+(usage.estimatedCostUsd==null?'':' · chi phí ước tính '+Number(usage.estimatedCostUsd).toFixed(5)+' USD'):'';
 return '<div class="planner-card"><h4>Diễn giải từ AI · chỉ dựa trên dữ liệu đã cung cấp</h4><div class="planner-ai-results">'+items.join('')+'</div>'+(usageText?'<small>'+esc(usageText)+'</small>':'')+'</div>';
}
async function callPhotographyAI(route,body){
 const enabled=Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_ai_enabled'})).value:localStorage.getItem('photolens_ai_enabled');
 if(enabled!=='true')throw new Error('AI đang tắt. Hãy bật “Dùng AI” trong Cài đặt AI trước.');
 let endpoint=String(import.meta.env.VITE_AI_ENDPOINT||'').trim();
 if(!endpoint){endpoint=Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_worker_url'})).value:localStorage.getItem('photolens_worker_url');}
 if(!endpoint)throw new Error('Chưa cấu hình URL Cloudflare Worker trong Cài đặt AI.');
 endpoint=String(endpoint).trim();while(endpoint.endsWith('/'))endpoint=endpoint.slice(0,-1);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(endpoint+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.error)throw new Error(data?.error?.message||'Worker trả HTTP '+response.status+'.');
  return data;
 }catch(error){if(error.name==='AbortError')throw new Error('Worker phản hồi quá 30 giây.');throw error;}finally{clearTimeout(timer);}
}
async function runPhotographyAI(action){
 const routeMap={'ai-devices':'/devices/summary','ai-spots':'/spots/rank','ai-angles':'/angles','ai-outfit':'/outfit'},route=routeMap[action];
 if(!route)return;
 aiRoute=route;aiResult=null;aiMessage='Đang gửi dữ liệu đã chọn tới Worker…';render();
 try{
  const deepAnalysis=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_deep_analysis'})).value:localStorage.getItem('photolens_deep_analysis'))==='true';let body={deepAnalysis};
  if(route==='/devices/summary'){
   const ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']).filter(Boolean).slice(0,3);
   body={...body,devices:ids.map(id=>devices().find(d=>d.id===id)).filter(Boolean).map(d=>({id:d.id,brand:d.brand,model:d.model,facts:DEVICE_FIELDS.map(x=>{const value=get(d,x.path);return {label:x.label,value:value!==null&&typeof value==='object'?JSON.stringify(value):value};}).filter(x=>x.value!==null&&x.value!==undefined)}))};
  }else if(route==='/spots/rank'){
   const candidates=spots.concat(spotsSeed.map(s=>({...s,curated:true}))).slice(0,35);
   body={...body,genre,candidates:candidates.map((s,i)=>({id:String(s.id||(s.type?s.type+'-'+s.id:'spot-'+i)),name:s.name||s.tags?.name||'Địa điểm',category:String(s.tags?.tourism||s.tags?.leisure||s.tags?.historic||s.genres?.join(', ')||'Chưa có dữ liệu'),distanceKm:null,conditionScore:null,knownNotes:s.note||null}))};
  }else if(route==='/angles'){
   body={...body,genre,subject:json('photolens_angle_subject','chủ thể'),scene:json('photolens_angle_scene',''),deviceFacts:[]};
  }else{
   const c=forecast?.current||{};
   body={...body,style:json('photolens_outfit_style','Tự nhiên'),backgroundColor:json('photolens_bg_color','#56736f'),temperatureC:c.temperature_2m??null,precipitationMm:c.precipitation??null,windKmh:c.wind_speed_10m??null};
  }
  aiResult=await callPhotographyAI(route,body);aiMessage='';status='AI đã trả kết quả dựa trên dữ liệu hiện có.';
 }catch(error){aiMessage=error.message||'Không gọi được AI.';}
 render();
}
function planView(){const plans=repo.list();const edit=plans.find(p=>p.id===editingPlan)||{};return '<div class="planner-head"><div><h3>Kế hoạch buổi chụp</h3><p>Lưu cục bộ trên thiết bị này.</p></div></div><form class="planner-card planner-form" data-form="plan"><input type="hidden" name="id" value="'+esc(edit.id||'')+'"><label>Tên kế hoạch<input name="title" required value="'+esc(edit.title||'')+'" placeholder="Ví dụ: Chân dung chiều Hồ Tây"></label><div class="planner-row"><label>Ngày<input type="date" name="date" value="'+esc(edit.date||'')+'"></label><label>Thể loại<select name="genre">'+options(Object.entries(genres),edit.genre||genre)+'</select></label><label>Địa điểm<input name="location" value="'+esc(edit.location||pickedSpot?.name||place?.label||'')+'"></label></div><label>Thiết bị<select name="device"><option value="">Chưa chọn</option>'+devices().map(d=>'<option value="'+esc(d.id)+'" '+(edit.device===d.id?'selected':'')+'>'+esc(d.brand+' '+d.model)+'</option>').join('')+'</select></label><label>Đồ mang theo<input name="gear" value="'+esc(edit.gear||'Điện thoại/máy ảnh, pin, thẻ nhớ, khăn lau lens')+'"></label><label>Ghi chú<textarea name="notes">'+esc(edit.notes||'')+'</textarea></label><button class="planner-primary">'+(edit.id?'Cập nhật':'Lưu kế hoạch')+'</button><div class="planner-export-actions"><button type="button" class="planner-btn" data-action="export-plans">JSON</button><button type="button" class="planner-btn" data-action="export-pdf">PDF</button><button type="button" class="planner-btn" data-action="export-png">PNG</button></div></form><div class="planner-plan-list">'+(plans.length?plans.map(p=>'<article><div><h4>'+esc(p.title)+'</h4><p>'+esc([p.date,genres[p.genre],p.location].filter(Boolean).join(' · '))+'</p><p>'+esc(p.notes||'')+'</p></div><button class="planner-link" data-edit-plan="'+esc(p.id)+'">Sửa</button><button class="planner-link danger" data-delete-plan="'+esc(p.id)+'">Xóa</button></article>').join(''):'<div class="planner-empty">Chưa lưu kế hoạch.</div>')+'</div>';}
function render(){if(!panel)return;let content={devices:deviceView,weather:weatherView,spots:spotsView,angles:angleView,outfit:outfitView,plans:planView}[tab]();panel.innerHTML='<div class="planner-backdrop"><section class="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-title"><header><div><small>PHOTOLENS · LÊN KẾ HOẠCH CHỤP</small><h2 id="planner-title">Thiết bị & kế hoạch chụp</h2></div><button class="planner-close" data-action="close" aria-label="Đóng">×</button></header><nav role="tablist">'+makeTabs()+'</nav><main>'+content+'</main><footer>Thiết bị mẫu chưa xác minh · Tự kiểm tra tình trạng, quy định chụp và an toàn tại chỗ.</footer></section></div>';panel.querySelector('[data-action="close"]').onclick=close;panel.querySelector('.planner-backdrop').onclick=e=>{if(e.target.classList.contains('planner-backdrop'))close();};}
function close(){if(panel)panel.hidden=true;$('#photoPlannerButton')?.setAttribute('aria-expanded','false');}
export async function openPhotographyHub(){if(!panel){panel=document.createElement('div');panel.id='photoPlannerHost';document.body.append(panel);panel.addEventListener('click',click);panel.addEventListener('submit',submit);panel.addEventListener('change',change);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden)close();});}showEstimatedCost=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_show_cost'})).value:localStorage.getItem('photolens_show_cost'))==='true';panel.hidden=false;$('#photoPlannerButton')?.setAttribute('aria-expanded','true');render();panel.querySelector('.planner-close')?.focus();}
async function jsonFetch(url,opt={},timeout=12000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const res=await fetch(url,{...opt,signal:ctl.signal});const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.reason||'HTTP '+res.status);return data;}finally{clearTimeout(timer);}}
async function loadForecast(p){const key='photolens_weather_'+p.latitude.toFixed(2)+'_'+p.longitude.toFixed(2);let cache=json(key,null);if(cache&&Date.now()-cache.fetchedAt<20*60*1000){forecast=cache;status='Dữ liệu đã lưu gần đây.';render();return;}const base={latitude:p.latitude,longitude:p.longitude,timezone:'auto'};const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({...base,current:'temperature_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m',hourly:'temperature_2m,precipitation_probability,cloud_cover,visibility,wind_speed_10m,uv_index',daily:'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'7'});const aq=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');aq.search=new URLSearchParams({...base,hourly:'pm2_5',forecast_days:'5'});const pair=await Promise.all([jsonFetch(u),jsonFetch(aq).catch(()=>null)]);const air=pair[1]?.hourly,airByTime=new Map((air?.time||[]).map((time,i)=>[time,air.pm2_5?.[i]??null]));forecast={...pair[0],hourly:{...pair[0].hourly,pm2_5:(pair[0].hourly?.time||[]).map(time=>airByTime.get(time)??null)},pm25:air?.pm2_5?.[0]??null,fetchedAt:Date.now(),cached:false};save(key,forecast);status='';render();}
async function findWeather(name){status='Đang tìm địa điểm và dự báo…';render();try{const geo=new URL('https://geocoding-api.open-meteo.com/v1/search');geo.search=new URLSearchParams({name:name,count:'1',language:'vi',format:'json',countryCode:'VN'});const g=await jsonFetch(geo);const x=g.results?.[0];if(!x)throw new Error('Không tìm thấy địa điểm.');place={label:[x.name,x.admin1,x.country].filter(Boolean).join(', '),latitude:x.latitude,longitude:x.longitude};await loadForecast(place);}catch(e){status='Không tải được dự báo: '+e.message;const key=Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)?'photolens_weather_'+place.latitude.toFixed(2)+'_'+place.longitude.toFixed(2):'';const old=key?json(key,null):null;if(old)forecast={...old,cached:true};render();}}
function locate(){if(!navigator.geolocation){status='Thiết bị không hỗ trợ vị trí. Nhập thành phố thay thế.';render();return;}status='Đang xin quyền vị trí…';render();navigator.geolocation.getCurrentPosition(p=>{const lat=Number(p.coords.latitude.toFixed(2)),lon=Number(p.coords.longitude.toFixed(2));place={label:'Vị trí của tôi',latitude:lat,longitude:lon};loadForecast(place).catch(e=>{status='Không tải được dự báo: '+e.message;render();});},()=>{status='Không có quyền vị trí. Nhập thành phố thay thế.';render();},{timeout:10000,maximumAge:300000});}
async function findSpots(){
  if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude)){
    status='Chọn vị trí trong mục Thời tiết trước.';
    render();
    return;
  }
  status='Đang tìm OpenStreetMap quanh vị trí…';
  render();
  const ql='[out:json][timeout:10];(nwr(around:5000,'+place.latitude+','+place.longitude+')[leisure~"park|garden|nature_reserve"];nwr(around:5000,'+place.latitude+','+place.longitude+')[tourism~"attraction|museum|viewpoint|artwork"];nwr(around:5000,'+place.latitude+','+place.longitude+')[historic];);out center tags 35;';
  let worker=String(import.meta.env.VITE_AI_ENDPOINT||localStorage.getItem('photolens_worker_url')||'');
  while(worker.endsWith('/'))worker=worker.slice(0,-1);
  const endpoints=[
    ['https://overpass-api.de/api/interpreter','máy chủ Overpass chính'],
    ['https://overpass.private.coffee/api/interpreter','máy chủ Overpass dự phòng'],
    ['https://ovp.dresel.systems/api-as/interpreter','máy chủ Overpass khu vực châu Á']
  ];
  let data=null,source='',workerError='';
  if(worker){
    try{
      data=await jsonFetch(worker+'/spots/nearby?lat='+place.latitude.toFixed(2)+'&lon='+place.longitude.toFixed(2)+'&radius=5000');
      if(!Array.isArray(data?.elements))throw new Error('Worker trả dữ liệu không đúng định dạng.');
      source='PhotoLens Worker';
    }catch(error){workerError=error.message||'không kết nối được';}
  }
  if(!data){
    const errors=[];
    for(const [endpoint,label] of endpoints){
      try{
        const result=await jsonFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:'data='+encodeURIComponent(ql)},10000);
        if(!Array.isArray(result?.elements))throw new Error('Máy chủ trả dữ liệu không đúng định dạng.');
        data=result;
        source=label;
        break;
      }catch(error){errors.push(error.message||'lỗi kết nối');}
    }
    if(!data)throw new Error(errors.join(' · ')||'Không kết nối được các máy chủ Overpass.');
  }
  spots=(data.elements||[]).map(e=>({id:'osm-'+e.type+'-'+e.id,name:e.tags?.['name:vi']||e.tags?.name,lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,tags:e.tags,source:'https://www.openstreetmap.org/'+e.type+'/'+e.id,note:'Giờ mở cửa/quyền chụp: Chưa có dữ liệu; hãy tự xác minh.'})).filter(s=>s.name&&Number.isFinite(Number(s.lat)));
  status=spots.length?'Đã nhận '+spots.length+' kết quả từ OpenStreetMap.':'Không có địa điểm phù hợp trong vùng tìm.';
  if(workerError)status+=' Worker lỗi ('+workerError+'); đã tự chuyển sang '+source+'.';
  else if(!worker)status+=' Nguồn: '+source+'.';
  render();
}
async function findSpotsWithFallback(){try{await findSpots();}catch(error){status='Không tải được Overpass: '+(error.message||'lỗi kết nối')+'. Danh sách địa điểm tuyển chọn vẫn dùng được.';render();}}
async function click(e){const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render();if(tab==='weather'&&!forecast&&place?.label==='Hà Nội')findWeather('Hà Nội');return;}const a=e.target.closest('[data-action]')?.dataset.action;if(a==='locate')locate();if(a==='find-spots')findSpotsWithFallback();if(a==='change-city'){tab='weather';forecast=null;render();}if(a==='close')close();if(a==='add-device'){const brand=prompt('Hãng thiết bị:');if(!brand)return;const model=prompt('Tên máy:');if(!model)return;const all=json('photolens_my_devices_v1',[]);let extra={};const raw=prompt('Thông số đã đối chiếu, dạng JSON (để trống nếu chưa có):','');if(raw){try{extra=JSON.parse(raw);if(!extra||typeof extra!=='object'||Array.isArray(extra))throw new Error();}catch{alert('JSON không hợp lệ; thiết bị chưa được lưu.');return;}}all.push({...extra,id:'mine-'+Date.now(),brand,model,type:'my-device',verified:false,userCreated:true,note:'Thông số do người dùng cung cấp; chưa xác minh.'});if(!save('photolens_my_devices_v1',all))alert('Không lưu được thiết bị.');render();}if(e.target.matches('[data-delete-device]')){save('photolens_my_devices_v1',myDevices().filter(d=>d.id!==e.target.dataset.deleteDevice));render();}if(e.target.matches('[data-select-spot]')){pickedSpot=spots.find(s=>s.id===e.target.dataset.selectSpot)||spotsSeed.find(s=>s.id===e.target.dataset.selectSpot);status='Đã chọn địa điểm cho kế hoạch.';render();}if(e.target.matches('[data-delete-plan]')){repo.remove(e.target.dataset.deletePlan);render();}if(e.target.matches('[data-edit-plan]')){editingPlan=e.target.dataset.editPlan;tab='plans';render();}if(a==='export-plans')exportPlans();}
async function submit(e){e.preventDefault();const f=e.target,fd=new FormData(f);if(f.dataset.form==='weather'){findWeather(String(fd.get('place')||'').trim());return;}if(f.dataset.form==='angles'){genre=fd.get('genre');save('photolens_angle_subject',fd.get('subject'));save('photolens_angle_scene',fd.get('scene'));render();return;}if(f.dataset.form==='plan'){const p=Object.fromEntries(fd);const saved=repo.save(p);if(!saved){alert('Không lưu được kế hoạch.');return;}editingPlan='';status='Đã lưu kế hoạch trên thiết bị.';render();}}
function change(e){if(e.target.matches('[data-device]')){let ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']);ids[Number(e.target.dataset.device)]=e.target.value||'';save('photolens_compare_devices',ids);render();}if(e.target.matches('[data-diff]')){onlyDiff=e.target.checked;render();}if(e.target.matches('[data-genre]')){genre=e.target.value;render();}if(e.target.matches('[data-purpose]')){const p=e.target.value;const list=devices().filter(d=>json('photolens_compare_devices',[]).includes(d.id));const grid=$('.planner-score-grid');if(grid)grid.innerHTML=list.map(d=>{const s=deviceScore(d,p,scoreConfig);return '<article><b>'+esc(d.brand+' '+d.model)+'</b><strong>'+(s.score===null?'Chưa đủ dữ liệu':s.score+'/100')+'</strong></article>';}).join('');}if(e.target.matches('[data-bg]')){save('photolens_bg_color',e.target.value);tab='outfit';render();}if(e.target.matches('[data-style]')){save('photolens_outfit_style',e.target.value);render();}}
async function exportPlans(format='json'){
 const plans=repo.list();if(!plans.length){status='Chưa có kế hoạch để xuất.';render();return;}
 if(format==='json'){const blob=new Blob([JSON.stringify(plans,null,2)],{type:'application/json'});await deliverBlob(blob,'PhotoLens-ke-hoach-chup.json');return;}
 const chosen=plans.find(p=>p.id===editingPlan)||plans[plans.length-1],batch=format==='pdf'?plans:[chosen],host=document.createElement('div');
 host.style.cssText='position:fixed;left:-10000px;top:0;z-index:-1;width:800px;';
 document.body.append(host);
 try{
  const html2canvas=(await import('html2canvas')).default;let pdf=null;
  if(format==='pdf'){const mod=await import('jspdf');pdf=new mod.jsPDF({orientation:'portrait',unit:'mm',format:'a4'});}
  for(let i=0;i<batch.length;i++){
   const p=batch[i],card=document.createElement('article'),device=devices().find(d=>d.id===p.device);
   card.style.cssText='box-sizing:border-box;width:760px;padding:40px;background:#0a1017;color:#f3f7fa;font:20px/1.55 Arial,sans-serif;border:2px solid #344656;border-radius:24px;';
   const title=document.createElement('h1');title.textContent=p.title||'Kế hoạch chụp';title.style.cssText='font-size:34px;margin:0 0 24px;color:#8cefc9';card.append(title);
   const lines=[['Ngày',p.date],['Thể loại',genres[p.genre]||'Chưa có dữ liệu'],['Địa điểm',p.location],['Thiết bị',device?device.brand+' '+device.model:null],['Đồ mang theo',p.gear],['Ghi chú',p.notes]];
   for(const pair of lines){const row=document.createElement('p'),strong=document.createElement('strong');strong.textContent=pair[0]+': ';row.append(strong,document.createTextNode(pair[1]||'Chưa có dữ liệu'));row.style.margin='0 0 14px';card.append(row);}
   host.replaceChildren(card);
   const canvas=await html2canvas(card,{backgroundColor:'#0a1017',scale:2,useCORS:false});
   if(format==='pdf'){if(i)pdf.addPage();const pageW=210,pageH=297,margin=14,scale=Math.min((pageW-margin*2)*96/25.4/canvas.width,(pageH-margin*2)*96/25.4/canvas.height),w=canvas.width*scale*25.4/96,h=canvas.height*scale*25.4/96;pdf.addImage(canvas.toDataURL('image/png'),'PNG',(pageW-w)/2,margin,w,h);}
   else{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Không tạo được ảnh PNG.');await deliverBlob(blob,'PhotoLens-ke-hoach-chup.png');}
  }
  if(format==='pdf'){const blob=pdf.output('blob');await deliverBlob(blob,'PhotoLens-ke-hoach-chup.pdf');}
 }catch(error){status='Không xuất được tệp: '+(error.message||'lỗi không xác định');render();}
 finally{host.remove();}
}
async function deliverBlob(blob,name){
 const file=new File([blob],name,{type:blob.type});
 if(Capacitor.isNativePlatform()){
  try{const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});const saved=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});await Share.share({title:'Kế hoạch PhotoLens',files:[saved.uri],dialogTitle:'Chia sẻ kế hoạch'});return;}catch{}
 }
 try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:'Kế hoạch PhotoLens',files:[file]});return;}}catch(error){if(error?.name==='AbortError')return;}
 download(blob,name);
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
