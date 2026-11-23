import '../css/planner.css';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import spotsSeed from '../data/spots.json';
import weatherConfig from '../data/weather-scoring.json';
import {conditionScore,bestHours,solarWindows,angleOptions,outfitOptions,createPlanStore,scoreHours,esc} from '../core/photography.js';
import {createAngleSimulation3D,calculateCameraFov,renderPhotoFrameSvg,analyzeSubjectFraming,SENSOR_PRESETS} from './angle-simulation-3d.js';

const $=(s,r=document)=>r.querySelector(s), genres={portrait:'Chân dung',landscape:'Phong cảnh',architecture:'Kiến trúc',street:'Đường phố',night:'Đường phố đêm',moon:'Chụp trăng',cosplay:'Cosplay',documentary:'Tư liệu'};

let panel=null,angle3DInstance=null,tab='weather',place={label:'Hà Nội'},forecast=null,myPosition=null,spots=[],pickedSpot=null,genre='portrait',angleGenre='portrait',anglePose='solo',angleScene='',angleIndex=0,simMode='2d',simFallbackMessage='',simHeight=160,simDistance=4,simFocal=35,simSubjectHeight=170,simSensor='fullFrame',simSensorWidth=36,simSensorHeight=24,simOrientation='portrait',simOrbitX=28,simOrbitY=30,editingPlan='',aiResult=null,aiRoute='',aiMessage='',showEstimatedCost=false;
const repo=createPlanStore();
const json=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};

const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const fmt=(v,u='')=>v===null||v===undefined||v===''?'Chưa có dữ liệu':String(Array.isArray(v)?v.join(', '):v)+(u?' '+u:'');
const options=(data,current)=>data.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===current?'selected':'')+'>'+esc(x[1])+'</option>').join('');
function makeTabs(){return [['weather','Thời tiết'],['spots','Địa điểm'],['angles','Góc chụp'],['outfit','Trang phục'],['plans','Kế hoạch']].map(x=>'<button role="tab" aria-selected="'+(tab===x[0])+'" class="'+(tab===x[0]?'active':'')+'" data-tab="'+x[0]+'">'+x[1]+'</button>').join('');}
function weatherView(){if(!forecast)return '<div class="planner-head"><div><h3>Thời tiết & khung giờ chụp</h3><p>Mặc định không xin vị trí tự động.</p></div></div><form class="planner-card" data-form="weather"><label>Thành phố / địa điểm<input name="place" value="'+esc(place?.label||'')+'" placeholder="Ví dụ: Hà Đông, Hà Nội" required></label><div class="planner-row"><button class="planner-primary">Tìm dự báo</button><button type="button" class="planner-btn" data-action="locate">Dùng vị trí hiện tại</button></div></form><p class="planner-status">'+esc(status||'Nhập địa điểm để tải dự báo Open-Meteo.')+'</p>';
const c=forecast.current||{},d=forecast.daily||{},h=forecast.hourly||{},ranked=bestHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),timeline=scoreHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),solar=d.sunrise?.[0]?solarWindows(d.sunrise[0],d.sunset?.[0]):null;
let html='<div class="planner-head"><div><h3>Thời tiết & khung giờ chụp</h3><p>'+esc(place.label)+' · nguồn Open-Meteo</p></div><button class="planner-btn" data-action="change-city">Đổi địa điểm</button></div><div class="planner-weather-grid"><article><small>Hiện tại</small><strong>'+fmt(c.temperature_2m)+'°C</strong><span>Cảm giác '+fmt(c.apparent_temperature)+'° · mây '+fmt(c.cloud_cover)+'% · gió '+fmt(c.wind_speed_10m)+' km/h</span></article><article><small>PM2.5</small><strong>'+fmt(forecast.pm25,'µg/m³')+'</strong><span>Cập nhật '+new Date(forecast.fetchedAt).toLocaleString('vi-VN')+(forecast.cached?' · bản lưu':'')+'</span></article></div><div class="planner-card"><div class="planner-row"><label>Thể loại<select data-genre>'+options(Object.entries(genres).filter(x=>['portrait','landscape','architecture','street','night','moon'].includes(x[0])),genre)+'</select></label><div class="planner-callout">Khung đẹp nhất: <b>'+esc(ranked[0]?.time?.replace('T',' ')||'Chưa có dữ liệu')+'</b> · '+(ranked[0]?.score??'—')+'/100</div></div><p class="planner-muted">Điểm là thứ hạng tham khảo theo mưa, mây, gió, tầm nhìn, UV, PM2.5; không bảo đảm ánh sáng tại chỗ.</p><div class="planner-hours">'+ranked.slice(0,8).map(x=>'<div><b>'+esc(x.time.slice(11,16))+'</b><span>'+fmt(x.temp)+'°</span><strong>'+(x.score??'—')+'</strong></div>').join('')+'</div><h4>48 giờ tới</h4><div class="planner-hour-strip">'+timeline.map(x=>'<div title="'+esc(x.time.replace('T',' '))+' · '+(x.score??'Chưa đủ dữ liệu')+'/100"><b>'+esc(x.time.slice(5,16).replace('T',' '))+'</b><span>'+fmt(x.temp)+'°</span><strong>'+(x.score??'—')+'</strong></div>').join('')+'</div></div><div class="planner-card"><h4>Dự báo 7 ngày</h4><div class="planner-hours">'+(d.time||[]).slice(0,7).map((x,i)=>'<div><b>'+esc(x.slice(5))+'</b><span>'+(d.temperature_2m_max?.[i]??'—')+'°/'+(d.temperature_2m_min?.[i]??'—')+'°</span><strong>Mưa '+(d.precipitation_probability_max?.[i]??'—')+'%</strong></div>').join('')+'</div></div>';
if(solar)html+='<div class="planner-card"><h4>Bình minh / hoàng hôn & giờ vàng ước tính</h4><p>Bình minh '+solar.rise+' · Giờ vàng sáng '+solar.goldAM+' · Giờ vàng chiều '+solar.goldPM+' · Hoàng hôn '+solar.set+'</p><p class="planner-muted">Giờ vàng là khoảng ước tính theo độ lệch thời gian, không phải đo ánh sáng tại địa điểm.</p></div>';
return html+'<p class="planner-attribution">Nguồn thời tiết: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>; dữ liệu không khí CAMS ENSEMBLE.</p>';}
let status='';
function spotsView(){
 const items=spots.concat(spotsSeed.map(s=>({...s,curated:true})));
 let html='<div class="planner-head"><div><h3>Địa điểm chụp</h3><p>'+esc(place?.label||'Chọn vị trí từ mục Thời tiết để tìm quanh đó')+'</p></div><div class="planner-map-actions"><button class="planner-primary" data-action="find-spots">Tìm quanh vị trí</button><button class="planner-btn" data-action="show-my-location">Hiển thị vị trí của tôi</button></div></div>';
 const mapPoint=myPosition||place;
 if(Number.isFinite(mapPoint?.latitude)&&Number.isFinite(mapPoint?.longitude)){
  const fullMapUrl='https://www.openstreetmap.org/?mlat='+mapPoint.latitude+'&mlon='+mapPoint.longitude+'#map='+(myPosition?'16':'14')+'/'+mapPoint.latitude+'/'+mapPoint.longitude;
  const coordinateText=myPosition?'Vị trí GPS: '+myPosition.latitude.toFixed(5)+', '+myPosition.longitude.toFixed(5)+(myPosition.accuracy?' · độ chính xác khoảng '+Math.round(myPosition.accuracy)+' m':''):'';
  html+='<div class="planner-map"><div id="plannerMap" class="planner-map-canvas" role="application" aria-label="Bản đồ OpenStreetMap các địa điểm chụp"></div><div class="planner-map-link"><span id="plannerMapMessage" role="status" aria-live="polite">Đang tải bản đồ…</span><a href="'+esc(fullMapUrl)+'" target="_blank" rel="noopener">Mở OpenStreetMap ↗</a><small>© OpenFreeMap · © OpenMapTiles · OpenStreetMap</small>'+(coordinateText?'<small>'+esc(coordinateText)+'</small>':'')+'</div></div>';
 }
 html+='<p class="planner-status">'+esc(status)+'</p><div class="planner-spot-grid">';
 html+=items.slice(0,30).map(s=>{const name=s.name||s.tags?.name||'Địa điểm';const lat=s.lat??s.latitude,lon=s.lon??s.longitude;const url=Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))?'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon:(s.source||'https://www.openstreetmap.org/search?query='+encodeURIComponent(s.search||name));return '<article><h4>'+esc(name)+'</h4><small>'+(s.curated?'Gợi ý tên · chưa có tọa độ':'OpenStreetMap')+'</small><p>'+esc(s.note||'Giờ mở cửa/quyền chụp: Chưa có dữ liệu; hãy tự xác minh.')+'</p><a class="planner-btn" href="'+esc(url)+'" target="_blank" rel="noopener">Mở bản đồ ↗</a><button class="planner-link" data-select-spot="'+esc(s.id||name)+'">Chọn</button></article>';}).join('');
 html+='<div class="planner-card"><button class="planner-primary" data-action="ai-spots">AI xếp hạng danh sách này</button><p class="planner-muted">AI chỉ được chọn các địa điểm đang hiển thị; không tự tạo tên địa điểm.</p></div>'+aiPanel('/spots/rank')+'</div><p class="planner-attribution">Dữ liệu bản đồ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors (ODbL)</a>. Tự kiểm tra quyền vào/chụp, quy định drone và an toàn tại chỗ.</p>';
 return html;
}
const simClamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const simNum=n=>Number.isFinite(n)?Number(n.toFixed(1)):0;
const framingText=config=>{const result=analyzeSubjectFraming(config);return result.cropped?'Một phần chủ thể bị cắt khỏi khung; thử lùi máy, giảm tiêu cự hoặc đổi hướng khung.':'Toàn bộ chủ thể nằm trong khung theo thông số đã chọn.';};
function simPerson(x,y,scale=1,color='#0b7a5a'){
 return '<g transform="translate('+x+' '+y+') scale('+scale+')" stroke="'+color+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="0" cy="-56" r="10" fill="'+color+'" stroke="none"/><path d="M0 -44L0 -16M-15 -35L0 -42L15 -35M-15 -35L-22 -13M15 -35L22 -13M0 -16L-12 0M0 -16L12 0M-12 0L-16 17M12 0L16 17"/></g>';
}
function simPeople(centerX,groundY,scale=1){
 const positions=anglePose==='solo'?[0]:anglePose==='couple'?[-20,20]:[-42,-21,0,21,42];
 return positions.map((offset,i)=>simPerson(centerX+offset,groundY,scale,i%2?'#476e83':'#0b7a5a')).join('');
}
function cameraSymbol(x,y){
 return '<g transform="translate('+x+' '+y+')" stroke="#183c3c" stroke-width="3" stroke-linejoin="round"><path d="M-19 -9h11l5 -7h18l5 7h7v25h-46z" fill="#ffffff"/><circle cx="3" cy="3" r="9" fill="#d8eee6"/><circle cx="3" cy="3" r="4" fill="#0b7a5a"/><path d="M-11 16l-8 18M10 16l8 18M-11 16l-15 18M10 16l15 18" fill="none" stroke-linecap="round"/></g>';
}
function angleSimulationConfig(){
 const preset=SENSOR_PRESETS[simSensor]||SENSOR_PRESETS.fullFrame;
 return {angleIndex,pose:anglePose,cameraHeight:simHeight,distance:simDistance,focalLength:simFocal,subjectHeight:simSubjectHeight,sensorWidth:simSensor==='custom'?simSensorWidth:preset.width,sensorHeight:simSensor==='custom'?simSensorHeight:preset.height,orientation:simOrientation,orbitPitch:simOrbitX,orbitYaw:simOrbitY};
}
function simulatorSvg(item,index,config){
 const ground=300,pxPerMeter=34,cameraX=100,lensX=125,subjectX=cameraX+config.distance*pxPerMeter;
 const cameraY=ground-config.cameraHeight/100*pxPerMeter,targetY=ground-config.subjectHeight/100*.9*pxPerMeter;
 const dx=subjectX-lensX,aim=Math.atan2(targetY-cameraY,dx);
 const fov=calculateCameraFov(config.focalLength,config.sensorWidth,config.sensorHeight,config.orientation);
 const topY=cameraY+dx*Math.tan(aim-fov.verticalRadians/2),bottomY=cameraY+dx*Math.tan(aim+fov.verticalRadians/2);
 const cone='<path d="M125 '+simNum(cameraY)+'L'+simNum(subjectX)+' '+simNum(topY)+'L'+simNum(subjectX)+' '+simNum(bottomY)+'Z" fill="rgba(11,122,90,.13)" stroke="#0b7a5a" stroke-width="2" stroke-dasharray="7 5"/>';
 const height='<path d="M54 '+simNum(cameraY)+'V'+ground+'" stroke="#536e78" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M49 '+simNum(cameraY)+'h10M49 '+ground+'h10" stroke="#536e78" stroke-width="1.5"/><text x="39" y="'+simNum((cameraY+ground)/2)+'" transform="rotate(-90 39 '+simNum((cameraY+ground)/2)+')" text-anchor="middle" fill="#344b56" font-size="12">'+config.cameraHeight+' cm</text>';
 const distance='<path d="M'+lensX+' 329H'+simNum(subjectX)+'" stroke="#536e78" stroke-width="1.5" stroke-dasharray="5 5"/><path d="M'+lensX+' 324v10M'+simNum(subjectX)+' 324v10" stroke="#536e78" stroke-width="1.5"/><text x="'+simNum((lensX+subjectX)/2)+'" y="322" text-anchor="middle" fill="#344b56" font-size="13">'+config.distance+' m</text>';
 const scale=config.subjectHeight/170*.70;
 const people=simPeople(subjectX,ground,scale);
 const grid=Array.from({length:6},(_,i)=>'<path d="M'+(i*100)+' 0v340" stroke="#dfe8e5" stroke-width="1"/>').join('');
 return '<svg viewBox="0 0 520 350" role="img" aria-label="Sơ đồ 2D theo độ cao, khoảng cách, tiêu cự và kích thước cảm biến"><title>'+esc(item.name)+' · góc nhìn '+simNum(fov.vertical)+' độ dọc</title><defs><marker id="angle-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#0b7a5a"/></marker></defs><rect width="520" height="350" rx="14" fill="#f4f8f6"/>'+grid+'<path d="M20 '+ground+'H510" stroke="#81958f" stroke-width="3"/>'+cone+cameraSymbol(cameraX,cameraY)+'<path d="M125 '+simNum(cameraY)+'L'+simNum(subjectX)+' '+simNum(targetY)+'" stroke="#0b7a5a" stroke-width="2" marker-end="url(#angle-arrow)"/>'+people+'<text x="'+cameraX+'" y="'+simNum(cameraY-34)+'" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Máy ảnh</text><text x="'+simNum(subjectX)+'" y="'+simNum(ground+18)+'" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Chủ thể · '+config.subjectHeight+' cm</text>'+height+distance+'<text x="260" y="26" text-anchor="middle" fill="#183c3c" font-size="12" font-weight="700">Vùng nhìn thật theo tiêu cự · '+config.focalLength+' mm · FOV '+simNum(fov.vertical)+'° dọc</text></svg>';
}
function anglesView(){
 const suggestions=angleOptions(angleGenre,'người trong ảnh',angleScene,anglePose);
 const safeIndex=simClamp(angleIndex,0,suggestions.length-1),selected=suggestions[safeIndex],config=angleSimulationConfig();
 const fov=calculateCameraFov(config.focalLength,config.sensorWidth,config.sensorHeight,config.orientation);
 const poseOptions=[['solo','Một người'],['couple','Cặp đôi'],['group','Nhóm bạn']];
 const cards=suggestions.map((item,index)=>'<button type="button" class="planner-angle-choice'+(index===safeIndex?' active':'')+'" data-angle-index="'+index+'" aria-pressed="'+(index===safeIndex)+'"><small>Gợi ý '+(index+1)+(index===safeIndex?' · Đang mô phỏng':'')+'</small><h4>'+esc(item.name)+'</h4><p><b>Đặt máy:</b> '+esc(item.height)+'. '+esc(item.distance)+'.</p><p><b>Bố cục:</b> '+esc(item.composition)+'</p><p class="planner-pose-tip"><b>Tạo dáng:</b> '+esc(item.poseTip)+'</p><p><b>Mẹo:</b> '+esc(item.tips)+'</p><p><b>Nên tránh:</b> '+esc(item.avoid)+'</p></button>').join('');
 const sensorOptions=Object.entries(SENSOR_PRESETS).map(([id,x])=>[id,x.label]);
 const sensor=SENSOR_PRESETS[simSensor]||SENSOR_PRESETS.fullFrame;
 const customFields=simSensor==='custom'?'<div class="planner-sim-custom"><label>Rộng cảm biến<input type="number" min="1" max="60" step="0.1" value="'+simSensorWidth+'" data-sim-sensor-width aria-label="Chiều rộng cảm biến tính bằng milimet"></label><label>Cao cảm biến<input type="number" min="1" max="60" step="0.1" value="'+simSensorHeight+'" data-sim-sensor-height aria-label="Chiều cao cảm biến tính bằng milimet"></label></div>':'<small class="planner-sim-sensor-note">'+esc(sensor.width)+' × '+esc(sensor.height)+' mm · '+(simSensor==='apsc'?'Kích thước tham chiếu, có thể khác theo hãng':'kích thước tham chiếu')+'</p>';
 const stage=simMode==='3d'?'<div class="planner-sim-stage" data-sim-stage data-mode="3d"><canvas data-sim-canvas tabindex="0" role="img" aria-label="Cảnh 3D tương tác; kéo để xoay hoặc dùng phím mũi tên"></canvas><div class="planner-sim-legend"><span><i class="camera"></i>Máy ảnh và tripod</span><span><i class="person"></i>Mannequin</span><span><i class="frustum"></i>Vùng nhìn theo tiêu cự</span></div></div>':'<div class="planner-sim-stage" data-sim-stage data-mode="2d">'+simulatorSvg(selected,safeIndex,config)+'</div>';
 const framing=analyzeSubjectFraming(config),frame='<aside class="planner-sim-frame" data-orientation="'+simOrientation+'"><div><h5>Khung ảnh dự kiến</h5><p data-sim-fov>FOV '+simNum(fov.horizontal)+'° ngang / '+simNum(fov.vertical)+'° dọc</p></div><div data-sim-frame>'+renderPhotoFrameSvg(config)+'</div><small data-sim-fit class="'+(framing.cropped?'is-cropped':'is-fit')+'">'+framingText(config)+'</small><small>Ước tính từ thông số bên trái; mannequin là hình minh họa.</small></aside>';
 return '<div class="planner-head"><div><h3>Góc chụp & tạo dáng</h3><p>Chọn thể loại và số người để nhận gợi ý góc máy cùng cách tạo dáng tự nhiên.</p></div></div><form class="planner-card planner-form" data-form="angles"><div class="planner-row"><label>Thể loại ảnh<select name="genre">'+options(Object.entries(genres),angleGenre)+'</select></label><label>Chủ thể<select name="poseType">'+options(poseOptions,anglePose)+'</select></label><label>Bối cảnh (không bắt buộc)<input name="scene" maxlength="120" value="'+esc(angleScene)+'" placeholder="Ví dụ: công viên lúc hoàng hôn"></label></div><button class="planner-primary" type="submit">Cập nhật gợi ý</button></form><section class="planner-sim" aria-labelledby="planner-sim-title"><div class="planner-sim-heading"><div><h4 id="planner-sim-title">Mô phỏng: '+esc(selected.name)+'</h4><p>Điều chỉnh máy, ống kính, cảm biến và chủ thể; thông số áp dụng cho cả khung hình 2D/3D.</p></div><div class="planner-sim-modes" role="group" aria-label="Chế độ mô phỏng"><button type="button" data-sim-mode="2d" aria-pressed="'+(simMode==='2d')+'">2D</button><button type="button" data-sim-mode="3d" aria-pressed="'+(simMode==='3d')+'">3D</button></div></div><div class="planner-sim-controls"><label>Độ cao máy ảnh <span><output>'+simHeight+'</output> cm</span><input type="range" min="60" max="220" step="5" value="'+simHeight+'" data-sim-height aria-label="Độ cao máy ảnh tính bằng centimet"></label><label>Khoảng cách máy ảnh <span><output>'+simDistance+'</output> m</span><input type="range" min="2" max="10" step="1" value="'+simDistance+'" data-sim-distance aria-label="Khoảng cách máy ảnh tính bằng mét"></label><label>Tiêu cự thực <span><output>'+simFocal+'</output> mm</span><input type="range" min="14" max="200" step="1" value="'+simFocal+'" data-sim-focal aria-label="Tiêu cự vật lý tính bằng milimet"></label><label>Chiều cao chủ thể <span><output>'+simSubjectHeight+'</output> cm</span><input type="range" min="140" max="200" step="1" value="'+simSubjectHeight+'" data-sim-subject-height aria-label="Chiều cao chủ thể tính bằng centimet"></label><label>Định dạng cảm biến<select data-sim-sensor>'+options(sensorOptions,simSensor)+'</select>'+customFields+'</label><div class="planner-sim-orientation"><span>Hướng khung ảnh</span><div role="group" aria-label="Hướng khung ảnh"><button type="button" data-sim-orientation="portrait" aria-pressed="'+(simOrientation==='portrait')+'">Dọc</button><button type="button" data-sim-orientation="landscape" aria-pressed="'+(simOrientation==='landscape')+'">Ngang</button></div></div></div><div class="planner-sim-layout">'+stage+frame+'</div>'+(simFallbackMessage?'<p class="planner-sim-notice" role="status">'+esc(simFallbackMessage)+'</p>':'')+(simMode==='3d'?'<div class="planner-sim-orbit" role="group" aria-label="Điều khiển góc nhìn"><span>Xoay cảnh:</span><button type="button" data-orbit-step="left" aria-label="Xoay sang trái">←</button><button type="button" data-orbit-step="right" aria-label="Xoay sang phải">→</button><button type="button" data-orbit-step="up" aria-label="Nâng góc nhìn">↑</button><button type="button" data-orbit-step="down" aria-label="Hạ góc nhìn">↓</button><span class="planner-muted">Kéo cảnh hoặc dùng phím mũi tên.</span></div>':'')+'<p class="planner-sim-note">FOV được tính từ tiêu cự và kích thước cảm biến đã chọn. Máy ảnh, mannequins, ánh sáng và phông nền là mô hình 3D minh họa; ảnh thực tế còn phụ thuộc ống kính, crop, lấy nét, méo quang học, ánh sáng và tư thế.</p></section><div class="planner-angle-grid">'+cards+'</div>';
}
function outfitView(){const current=forecast?.current||{};const bg=json('photolens_bg_color','#56736f');const list=outfitOptions({temp:current.temperature_2m,rain:current.precipitation,wind:current.wind_speed_10m,background:bg,style:json('photolens_outfit_style','Tự nhiên')});return '<div class="planner-head"><div><h3>Trang phục lên ảnh</h3><p>Không suy đoán ngoại hình, vóc dáng, màu da, giới tính hay tuổi.</p></div></div><div class="planner-card planner-row"><label>Phong cách<select data-style>'+options([['Tự nhiên','Tự nhiên'],['Tối giản','Tối giản'],['Điện ảnh','Điện ảnh'],['Năng động','Năng động'],['Cổ điển','Cổ điển']],json('photolens_outfit_style','Tự nhiên'))+'</select></label><label>Màu nền dự kiến<input type="color" data-bg value="'+esc(bg)+'"></label><span>'+ (current.temperature_2m==null?'Chưa có dữ liệu thời tiết':current.temperature_2m+'°C · mưa '+(current.precipitation??'—')+' mm · gió '+(current.wind_speed_10m??'—')+' km/h')+'</span></div><div class="planner-outfit-grid">'+list.map(x=>'<article><h4>'+esc(x.name)+'</h4><p>Màu: '+x.colors.map(c=>'<span class="planner-swatch">'+esc(c)+'</span>').join(' ')+'</p><p>'+esc(x.clothes)+'</p><p>'+esc(x.reason)+'</p><p>Lưu ý: '+esc(x.caution)+'</p></article>').join('')+'</div>';}
function aiPanel(route){
 if(aiRoute!==route)return '';
 if(aiMessage)return '<div class="planner-card planner-status" role="status">'+esc(aiMessage)+'</div>';
 if(!aiResult)return '';
 const render=(title,text)=>'<article><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p></article>';
 let items=[];

 if(route==='/spots/rank')items=(aiResult.ranked||[]).map(x=>{const spot=spots.concat(spotsSeed).find(s=>String(s.id)===x.id);return render(spot?.name||spot?.tags?.name||x.id,x.score+'/100 · '+x.reason);});
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
  if(action!=='ai-spots')return;
  const route='/spots/rank';
  aiRoute=route;aiResult=null;aiMessage='Đang gửi dữ liệu đã chọn tới Worker…';render();
  try{
    const deepAnalysis=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_deep_analysis'})).value:localStorage.getItem('photolens_deep_analysis'))==='true';
    const candidates=spots.concat(spotsSeed.map(s=>({...s,curated:true}))).slice(0,35);
    const body={deepAnalysis,genre,candidates:candidates.map((s,i)=>({id:String(s.id||(s.type?s.type+'-'+s.id:'spot-'+i)),name:s.name||s.tags?.name||'Địa điểm',category:String(s.tags?.tourism||s.tags?.leisure||s.tags?.historic||s.genres?.join(', ')||'Chưa có dữ liệu'),distanceKm:null,conditionScore:null,knownNotes:s.note||null}))};
    aiResult=await callPhotographyAI(route,body);aiMessage='';status='AI đã trả kết quả dựa trên dữ liệu hiện có.';
  }catch(error){aiMessage=error.message||'Không gọi được AI.';}
  render();
}
function planView(){const plans=repo.list();const edit=plans.find(p=>p.id===editingPlan)||{};return '<div class="planner-head"><div><h3>Kế hoạch buổi chụp</h3><p>Lưu cục bộ trên thiết bị này.</p></div></div><form class="planner-card planner-form" data-form="plan"><input type="hidden" name="id" value="'+esc(edit.id||'')+'"><label>Tên kế hoạch<input name="title" required value="'+esc(edit.title||'')+'" placeholder="Ví dụ: Chân dung chiều Hồ Tây"></label><div class="planner-row"><label>Ngày<input type="date" name="date" value="'+esc(edit.date||'')+'"></label><label>Thể loại<select name="genre">'+options(Object.entries(genres),edit.genre||genre)+'</select></label><label>Địa điểm<input name="location" value="'+esc(edit.location||pickedSpot?.name||place?.label||'')+'"></label></div><label>Đồ mang theo<input name="gear" value="'+esc(edit.gear||'')+'" placeholder="Ví dụ: pin dự phòng, thẻ nhớ, áo mưa"></label><label>Ghi chú<textarea name="notes">'+esc(edit.notes||'')+'</textarea></label><button class="planner-primary">'+(edit.id?'Cập nhật':'Lưu kế hoạch')+'</button><div class="planner-export-actions"><button type="button" class="planner-btn" data-action="export-plans">JSON</button><button type="button" class="planner-btn" data-action="export-pdf">PDF</button><button type="button" class="planner-btn" data-action="export-png">PNG</button></div></form><div class="planner-plan-list">'+(plans.length?plans.map(p=>'<article><div><h4>'+esc(p.title)+'</h4><p>'+esc([p.date,genres[p.genre],p.location].filter(Boolean).join(' · '))+'</p><p>'+esc(p.notes||'')+'</p></div><button class="planner-link" data-edit-plan="'+esc(p.id)+'">Sửa</button><button class="planner-link danger" data-delete-plan="'+esc(p.id)+'">Xóa</button></article>').join(''):'<div class="planner-empty">Chưa lưu kế hoạch.</div>')+'</div>';}
let mapLibrePromise=null,plannerMapInstance=null,mapRenderVersion=0;
function loadMapLibre(){
  if(mapLibrePromise)return mapLibrePromise;
  const cssId='photolens-maplibre-css';
  const cssReady=new Promise((resolve,reject)=>{
    let link=document.getElementById(cssId);
    if(link?.dataset.loaded==='true'){resolve();return;}
    if(!link){
      link=document.createElement('link');
      link.id=cssId;
      link.rel='stylesheet';
      link.href='https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.css';
      document.head.append(link);
    }
    link.addEventListener('load',()=>{link.dataset.loaded='true';resolve();},{once:true});
    link.addEventListener('error',()=>reject(new Error('Không tải được giao diện bản đồ.')),{once:true});
    if(link.sheet){link.dataset.loaded='true';resolve();}
  });
  const library=import(/* @vite-ignore */ 'https://unpkg.com/maplibre-gl@6.19.0/dist/maplibre-gl.mjs');
  mapLibrePromise=Promise.all([library,cssReady]).then(([module])=>module);
  return mapLibrePromise;
}
function renderSpotsMap(version){
  const element=$('#plannerMap',panel),message=$('#plannerMapMessage',panel),mapPoint=myPosition||place;
  if(!element||!Number.isFinite(mapPoint?.latitude)||!Number.isFinite(mapPoint?.longitude))return;
  loadMapLibre().then(maplibregl=>{
    if(version!==mapRenderVersion||tab!=='spots'||!$('#plannerMap',panel))return;
    const center=[mapPoint.longitude,mapPoint.latitude],statusNode=$('#plannerMapMessage',panel);
    const map=new maplibregl.Map({
      container:element,
      style:'https://tiles.openfreemap.org/styles/bright',
      center,
      zoom:myPosition?16:13,
      maxZoom:20,
      scrollZoom:false,
      cooperativeGestures:true,
      attributionControl:true
    });
    plannerMapInstance=map;
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
    let mapErrors=0;
    map.on('load',()=>{
      if(version===mapRenderVersion&&statusNode)statusNode.textContent='Đang tải đường phố và nhãn…';
    });
    map.on('error',()=>{
      mapErrors++;
      if(mapErrors>=2&&version===mapRenderVersion&&statusNode)statusNode.textContent='Một số chi tiết bản đồ chưa tải được. Kiểm tra kết nối mạng hoặc mở OpenStreetMap bên cạnh.';
    });
    map.once('idle',()=>{
      if(version===mapRenderVersion&&statusNode)statusNode.textContent=mapErrors?'Bản đồ đã mở; một số chi tiết tải chưa đầy đủ.':'Bản đồ đường phố đã sẵn sàng';
    });
    const locationCoords=[];
    if(myPosition){
      const el=document.createElement('div');
      el.className='planner-my-location-icon';
      el.setAttribute('role','img');
      el.setAttribute('aria-label','Vị trí GPS của tôi');
      el.innerHTML='<span aria-hidden="true"></span>';
      new maplibregl.Marker({element:el,anchor:'center'})
        .setLngLat([myPosition.longitude,myPosition.latitude])
        .setPopup(new maplibregl.Popup({offset:18}).setHTML('<strong>Vị trí của tôi</strong><br>Độ chính xác khoảng '+Math.round(myPosition.accuracy||0)+' m'))
        .addTo(map);
      locationCoords.push([myPosition.longitude,myPosition.latitude]);
    }else if(Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)){
      const el=document.createElement('div');
      el.className='planner-search-location-dot';
      el.setAttribute('role','img');
      el.setAttribute('aria-label','Vị trí tìm kiếm');
      new maplibregl.Marker({element:el,anchor:'center'})
        .setLngLat([place.longitude,place.latitude])
        .setPopup(new maplibregl.Popup({offset:14}).setText('Vị trí tìm kiếm'))
        .addTo(map);
      locationCoords.push([place.longitude,place.latitude]);
    }
    const bounds=new maplibregl.LngLatBounds();
    for(const [lon,lat] of locationCoords)bounds.extend([lon,lat]);
    spots.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))).slice(0,35).forEach(s=>{
      const lat=Number(s.lat),lon=Number(s.lon),name=esc(s.name||s.tags?.name||'Địa điểm');
      const href='https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon;
      const marker=new maplibregl.Marker({color:'#2484c6'})
        .setLngLat([lon,lat])
        .setPopup(new maplibregl.Popup({offset:24}).setHTML('<strong>'+name+'</strong><br><a href="'+href+'" target="_blank" rel="noopener">Mở địa điểm trên OpenStreetMap ↗</a>'))
        .addTo(map);
      bounds.extend([lon,lat]);
    });
    if(myPosition)map.setCenter(center);
    else if(!bounds.isEmpty())map.fitBounds(bounds,{padding:48,maxZoom:15});
    const readyTimer=window.setTimeout(()=>{
      if(version===mapRenderVersion&&statusNode&&mapErrors)statusNode.textContent='Không tải được đầy đủ bản đồ đường phố. Hãy kiểm tra mạng hoặc mở OpenStreetMap bên cạnh.';
    },12000);
    map.once('idle',()=>window.clearTimeout(readyTimer));
    window.setTimeout(()=>{if(version===mapRenderVersion)map.resize();},150);
  }).catch(error=>{
    if(version===mapRenderVersion&&message)message.textContent=(error.message||'Không tải được bản đồ.')+' Hãy mở OpenStreetMap bằng liên kết bên cạnh.';
  });
}
function render(){
  if(!panel)return;
  if(angle3DInstance){angle3DInstance.dispose();angle3DInstance=null;}
  if(plannerMapInstance){try{plannerMapInstance.remove();}catch{}plannerMapInstance=null;}
  const version=++mapRenderVersion;
  const content=({weather:weatherView,spots:spotsView,angles:anglesView,outfit:outfitView,plans:planView}[tab]||weatherView)();
  panel.innerHTML='<div class="planner-backdrop"><section class="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-title"><header><div><small>PHOTOLENS · LÊN KẾ HOẠCH CHỤP</small><h2 id="planner-title">Công cụ chụp ảnh</h2></div><button class="planner-close" data-action="close" aria-label="Đóng">×</button></header><nav role="tablist">'+makeTabs()+'</nav><main>'+content+'</main><footer>Dự báo và gợi ý mang tính tham khảo · Tự kiểm tra quy định chụp và an toàn tại chỗ.</footer></section></div>';
  panel.querySelector('[data-action="close"]').onclick=close;
  panel.querySelector('.planner-backdrop').onclick=e=>{if(e.target.classList.contains('planner-backdrop'))close();};
  if(tab==='angles'&&simMode==='3d')mountAngle3DSimulation();
  if(tab==='spots')renderSpotsMap(version);
}
function close(){if(angle3DInstance){angle3DInstance.dispose();angle3DInstance=null;}if(panel)panel.hidden=true;$('#photoPlannerButton')?.setAttribute('aria-expanded','false');}
export async function openPhotographyHub(){if(!panel){panel=document.createElement('div');panel.id='photoPlannerHost';document.body.append(panel);panel.addEventListener('click',click);panel.addEventListener('submit',submit);panel.addEventListener('input',updateRange);panel.addEventListener('change',change);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden)close();});}showEstimatedCost=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_show_cost'})).value:localStorage.getItem('photolens_show_cost'))==='true';panel.hidden=false;$('#photoPlannerButton')?.setAttribute('aria-expanded','true');render();panel.querySelector('.planner-close')?.focus();}
async function jsonFetch(url,opt={},timeout=12000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const res=await fetch(url,{...opt,signal:ctl.signal});const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.reason||'HTTP '+res.status);return data;}finally{clearTimeout(timer);}}
async function loadForecast(p){const key='photolens_weather_'+p.latitude.toFixed(2)+'_'+p.longitude.toFixed(2);let cache=json(key,null);if(cache&&Date.now()-cache.fetchedAt<20*60*1000){forecast=cache;status='Dữ liệu đã lưu gần đây.';render();return;}const base={latitude:p.latitude,longitude:p.longitude,timezone:'auto'};const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({...base,current:'temperature_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m',hourly:'temperature_2m,precipitation_probability,cloud_cover,visibility,wind_speed_10m,uv_index',daily:'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'7'});const aq=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');aq.search=new URLSearchParams({...base,hourly:'pm2_5',forecast_days:'5'});const pair=await Promise.all([jsonFetch(u),jsonFetch(aq).catch(()=>null)]);const air=pair[1]?.hourly,airByTime=new Map((air?.time||[]).map((time,i)=>[time,air.pm2_5?.[i]??null]));forecast={...pair[0],hourly:{...pair[0].hourly,pm2_5:(pair[0].hourly?.time||[]).map(time=>airByTime.get(time)??null)},pm25:air?.pm2_5?.[0]??null,fetchedAt:Date.now(),cached:false};save(key,forecast);status='';render();}
async function findWeather(name){status='Đang tìm địa điểm và dự báo…';render();try{const geo=new URL('https://geocoding-api.open-meteo.com/v1/search');geo.search=new URLSearchParams({name:name,count:'1',language:'vi',format:'json',countryCode:'VN'});const g=await jsonFetch(geo);const x=g.results?.[0];if(!x)throw new Error('Không tìm thấy địa điểm.');place={label:[x.name,x.admin1,x.country].filter(Boolean).join(', '),latitude:x.latitude,longitude:x.longitude};await loadForecast(place);}catch(e){status='Không tải được dự báo: '+e.message;const key=Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)?'photolens_weather_'+place.latitude.toFixed(2)+'_'+place.longitude.toFixed(2):'';const old=key?json(key,null):null;if(old)forecast={...old,cached:true};render();}}
function locate(){if(!navigator.geolocation){status='Thiết bị không hỗ trợ vị trí. Nhập thành phố thay thế.';render();return;}status='Đang xin quyền vị trí…';render();navigator.geolocation.getCurrentPosition(p=>{const lat=Number(p.coords.latitude.toFixed(2)),lon=Number(p.coords.longitude.toFixed(2));place={label:'Vị trí của tôi',latitude:lat,longitude:lon};loadForecast(place).catch(e=>{status='Không tải được dự báo: '+e.message;render();});},()=>{status='Không có quyền vị trí. Nhập thành phố thay thế.';render();},{timeout:10000,maximumAge:300000});}
function showMyLocation(){
 if(!navigator.geolocation){status='Trình duyệt này không hỗ trợ định vị. Bạn vẫn có thể chọn thành phố trong mục Thời tiết.';render();return;}
 if(!window.isSecureContext){status='Định vị cần trang HTTPS hoặc localhost.';render();return;}
 status='Đang xin quyền vị trí hiện tại…';
 render();
 navigator.geolocation.getCurrentPosition(position=>{
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){status='Thiết bị trả về tọa độ không hợp lệ.';render();return;}
  myPosition={latitude,longitude,accuracy:Number.isFinite(accuracy)?accuracy:null};
  status='Đã đánh dấu vị trí GPS của bạn. PhotoLens không gửi tọa độ này tới AI; bản đồ nền được tải từ OpenStreetMap.';
  render();
 },error=>{
  const messages={
   1:'Bạn chưa cấp quyền vị trí. Hãy cho phép Location trong cài đặt trình duyệt rồi thử lại.',
   2:'Không lấy được GPS. Hãy bật dịch vụ vị trí hoặc thử lại ngoài trời.',
   3:'Định vị quá lâu. Hãy thử lại hoặc chọn thành phố trong mục Thời tiết.'
  };
  status=messages[error.code]||'Không xác định được vị trí. Bạn có thể chọn thành phố trong mục Thời tiết.';
  render();
 },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
}

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
async function click(e){
 const tabButton=e.target.closest('[data-tab]');
 if(tabButton){tab=tabButton.dataset.tab;render();if(tab==='weather'&&!forecast&&place?.label==='Hà Nội')findWeather('Hà Nội');return;}
 const angleChoice=e.target.closest('[data-angle-index]');
 if(angleChoice){simFallbackMessage='';angleIndex=Number(angleChoice.dataset.angleIndex)||0;simHeight=[160,120,200][angleIndex]||160;simDistance=[4,5,4][angleIndex]||4;render();return;}
 const simButton=e.target.closest('[data-sim-mode]');
 if(simButton){simFallbackMessage='';simMode=simButton.dataset.simMode==='3d'?'3d':'2d';render();return;}
 const orientationButton=e.target.closest('[data-sim-orientation]');
 if(orientationButton){simOrientation=orientationButton.dataset.simOrientation==='landscape'?'landscape':'portrait';render();return;}
 const orbitButton=e.target.closest('[data-orbit-step]');
 if(orbitButton&&angle3DInstance){const step=orbitButton.dataset.orbitStep;if(step==='left')angle3DInstance.orbit(-8,0);if(step==='right')angle3DInstance.orbit(8,0);if(step==='up')angle3DInstance.orbit(0,-6);if(step==='down')angle3DInstance.orbit(0,6);return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='ai-spots'){await runPhotographyAI(action);return;}
 if(action==='locate')locate();
 if(action==='show-my-location')showMyLocation();
 if(action==='find-spots')findSpotsWithFallback();
 if(action==='change-city'){tab='weather';forecast=null;render();}
 if(action==='close')close();
 if(e.target.matches('[data-select-spot]')){pickedSpot=spots.find(s=>s.id===e.target.dataset.selectSpot)||spotsSeed.find(s=>s.id===e.target.dataset.selectSpot);status='Đã chọn địa điểm cho kế hoạch.';render();}
 if(e.target.matches('[data-delete-plan]')){repo.remove(e.target.dataset.deletePlan);render();}
 if(e.target.matches('[data-edit-plan]')){editingPlan=e.target.dataset.editPlan;tab='plans';render();}
 if(action==='export-plans')exportPlans();
}
async function submit(e){
  e.preventDefault();const form=e.target,fd=new FormData(form);
  if(form.dataset.form==='weather'){findWeather(String(fd.get('place')||'').trim());return;}
  if(form.dataset.form==='angles'){angleGenre=String(fd.get('genre')||'portrait');anglePose=String(fd.get('poseType')||'solo');angleScene=String(fd.get('scene')||'').trim();angleIndex=0;simFallbackMessage='';simHeight=160;simDistance=4;render();return;}
  if(form.dataset.form==='plan'){const plan=Object.fromEntries(fd);const saved=repo.save(plan);if(!saved){alert('Không lưu được kế hoạch.');return;}editingPlan='';status='Đã lưu kế hoạch trên thiết bị.';render();}
}
function mountAngle3DSimulation(){
 const canvas=panel?.querySelector('[data-sim-canvas]');
 if(!canvas)return;
 let instance;
 try{
  instance=createAngleSimulation3D(canvas,angleSimulationConfig(),error=>{
   if(angle3DInstance!==instance)return;
   angle3DInstance.dispose();angle3DInstance=null;simMode='2d';
   simFallbackMessage='WebGL không khả dụng hoặc gặp lỗi; PhotoLens đã chuyển về mô phỏng 2D.';
   render();
  },(yaw,pitch)=>{simOrbitY=yaw;simOrbitX=pitch;});
  angle3DInstance=instance;
 }catch{
  simMode='2d';simFallbackMessage='Thiết bị hoặc trình duyệt không hỗ trợ WebGL; đã chuyển về mô phỏng 2D.';
  render();
 }
}
function updateSimulation(){
 const stage=panel?.querySelector('[data-sim-stage]');
 if(!stage)return;
 const suggestions=angleOptions(angleGenre,'người trong ảnh',angleScene,anglePose),index=simClamp(angleIndex,0,suggestions.length-1),config=angleSimulationConfig();
 if(simMode==='3d'){angle3DInstance?.update(config);}
 else stage.innerHTML=simulatorSvg(suggestions[index],index,config);
 const frame=panel?.querySelector('[data-sim-frame]');
 if(frame)frame.innerHTML=renderPhotoFrameSvg(config);
 const fov=calculateCameraFov(config.focalLength,config.sensorWidth,config.sensorHeight,config.orientation);
 const readout=panel?.querySelector('[data-sim-fov]');
 if(readout)readout.textContent='FOV '+simNum(fov.horizontal)+'° ngang / '+simNum(fov.vertical)+'° dọc';
 const fit=panel?.querySelector('[data-sim-fit]'),framing=analyzeSubjectFraming(config);
 if(fit){fit.textContent=framingText(config);fit.classList.toggle('is-cropped',framing.cropped);fit.classList.toggle('is-fit',!framing.cropped);}
}
function updateRange(e){
 const target=e.target;
 if(!target.matches('[data-sim-height],[data-sim-distance],[data-sim-focal],[data-sim-subject-height],[data-sim-sensor-width],[data-sim-sensor-height]'))return;
 const value=Number(target.value);
 if(target.matches('[data-sim-height]'))simHeight=simClamp(value||160,60,220);
 else if(target.matches('[data-sim-distance]'))simDistance=simClamp(value||4,2,10);
 else if(target.matches('[data-sim-focal]'))simFocal=simClamp(value||50,14,200);
 else if(target.matches('[data-sim-subject-height]'))simSubjectHeight=simClamp(value||170,140,200);
 else if(target.matches('[data-sim-sensor-width]'))simSensorWidth=simClamp(value||36,1,60);
 else if(target.matches('[data-sim-sensor-height]'))simSensorHeight=simClamp(value||24,1,60);
 const output=target.closest('label')?.querySelector('output');
 if(output)output.textContent=String(value);
 updateSimulation();
}
function change(e){
  if(e.target.matches('[data-sim-sensor]')){simSensor=e.target.value;render();return;}
  if(e.target.matches('[data-genre]')){genre=e.target.value;render();}
  if(e.target.matches('[data-bg]')){save('photolens_bg_color',e.target.value);tab='outfit';render();}
  if(e.target.matches('[data-style]')){save('photolens_outfit_style',e.target.value);render();}
}
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
   const p=batch[i],card=document.createElement('article');
   card.style.cssText='box-sizing:border-box;width:760px;padding:40px;background:#0a1017;color:#f3f7fa;font:20px/1.55 Arial,sans-serif;border:2px solid #344656;border-radius:24px;';
   const title=document.createElement('h1');title.textContent=p.title||'Kế hoạch chụp';title.style.cssText='font-size:34px;margin:0 0 24px;color:#8cefc9';card.append(title);
   const lines=[['Ngày',p.date],['Thể loại',genres[p.genre]||'Chưa có dữ liệu'],['Địa điểm',p.location],['Đồ mang theo',p.gear],['Ghi chú',p.notes]];
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
