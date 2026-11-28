Warning: truncated output (original token count: 19242)
Total output lines: 611

import {makePlanLookReference,getPlanLookReference} from '../core/wardrobe/outfit-state.js';
import '../css/planner.css';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import spotsSeed from '../data/spots.json';
import weatherConfig from '../data/weather-scoring.json';
import {conditionScore,bestHours,solarWindows,angleOptions,outfitOptions,createPlanStore,scoreHours,esc} from '../core/photography.js';
import {createWardrobeStore,WARDROBE_CATEGORIES,WARDROBE_STYLES,WARDROBE_COLORS,WARDROBE_PATTERNS,WARDROBE_WEATHER,WARDROBE_SAMPLES,filterWardrobeItems,prepareWardrobeTryOn,resolveTryOnMode} from '../core/wardrobe.js';
import {renderWardrobeStudio,mountWardrobeStudio,disposeWardrobeStudio,listWardrobeLooks,wardrobeLooksReady,openSavedWardrobeLook} from './wardrobe-studio.js';

const $=(s,r=document)=>r.querySelector(s), genres={portrait:'Ch�n dung',landscape:'Phong c?nh',architecture:'Ki?n tr�c',street:'Du?ng ph?',night:'Du?ng ph? d�m',moon:'Ch?p trang',cosplay:'Cosplay',documentary:'Tu li?u'};

let paletteSources=[],manualWeather={temp:null,rain:null,wind:null},pendingPlanLook=null;
let panel=null,tab='weather',place={label:'H� N?i'},forecast=null,myPosition=null,spots=[],pickedSpot=null,genre='portrait',angleGenre='portrait',anglePose='solo',angleScene='',angleIndex=0,simMode='2d',simFallbackMessage='',simHeight=160,simDistance=4,simFocalLength=50,simOrbitX=-8,simOrbitY=12,simDrag=null,wardrobeSection='suggestions',wardrobeMode='2d',wardrobeSelection=[],wardrobeFilters={query:'',category:'all',color:'all',style:'all',weather:'all'},wardrobeEditingId='',wardrobeNotice='',wardrobeStatus='',wardrobeYaw=0,wardrobePitch=10,wardrobeDrag=null,wardrobeRepo=null,editingPlan='',aiResult=null,aiRoute='',aiMessage='',showEstimatedCost=false;
const repo=createPlanStore();
const json=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};

const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const fmt=(v,u='')=>v===null||v===undefined||v===''?'Chua c� d? li?u':String(Array.isArray(v)?v.join(', '):v)+(u?' '+u:'');
const options=(data,current)=>data.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===current?'selected':'')+'>'+esc(x[1])+'</option>').join('');
function makeTabs(){return [['weather','Th?i ti?t'],['spots','D?a di?m'],['angles','G�c ch?p'],['outfit','Trang ph?c'],['plans','K? ho?ch']].map(x=>'<button role="tab" aria-selected="'+(tab===x[0])+'" class="'+(tab===x[0]?'active':'')+'" data-tab="'+x[0]+'">'+x[1]+'</button>').join('');}
function weatherView(){if(!forecast)return '<div class="planner-head"><div><h3>Th?i ti?t & khung gi? ch?p</h3><p>M?c d?nh kh�ng xin v? tr� t? d?ng.</p></div></div><form class="planner-card" data-form="weather"><label>Th�nh ph? / d?a di?m<input name="place" value="'+esc(place?.label||'')+'" placeholder="V� d?: H� D�ng, H� N?i" required></label><div class="planner-row"><button class="planner-primary">T�m d? b�o</button><button type="button" class="planner-btn" data-action="locate">D�ng v? tr� hi?n t?i</button></div></form><p class="planner-status">'+esc(status||'Nh?p d?a di?m d? t?i d? b�o Open-Meteo.')+'</p>';
const c=forecast.current||{},d=forecast.daily||{},h=forecast.hourly||{},ranked=bestHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),timeline=scoreHours(h,genre,forecast.utc_offset_seconds||0,weatherConfig),solar=d.sunrise?.[0]?solarWindows(d.sunrise[0],d.sunset?.[0]):null;
let html='<div class="planner-head"><div><h3>Th?i ti?t & khung gi? ch?p</h3><p>'+esc(place.label)+' � ngu?n Open-Meteo</p></div><button class="planner-btn" data-action="change-city">D?i d?a di?m</button></div><div class="planner-weather-grid"><article><small>Hi?n t?i</small><strong>'+fmt(c.temperature_2m)+'�C</strong><span>C?m gi�c '+fmt(c.apparent_temperature)+'� � m�y '+fmt(c.cloud_cover)+'% � gi� '+fmt(c.wind_speed_10m)+' km/h</span></article><article><small>PM2.5</small><strong>'+fmt(forecast.pm25,'�g/m3')+'</strong><span>C?p nh?t '+new Date(forecast.fetchedAt).toLocaleString('vi-VN')+(forecast.cached?' � b?n luu':'')+'</span></article></div><div class="planner-card"><div class="planner-row"><label>Th? lo?i<select data-genre>'+options(Object.entries(genres).filter(x=>['portrait','landscape','architecture','street','night','moon'].includes(x[0])),genre)+'</select></label><div class="planner-callout">Khung d?p nh?t: <b>'+esc(ranked[0]?.time?.replace('T',' ')||'Chua c� d? li?u')+'</b> � '+(ranked[0]?.score??'-')+'/100</div></div><p class="planner-muted">Di?m l� th? h?ng tham kh?o theo mua, m�y, gi�, t?m nh�n, UV, PM2.5; kh�ng b?o d?m �nh s�ng t?i ch?.</p><div class="planner-hours">'+ranked.slice(0,8).map(x=>'<div><b>'+esc(x.time.slice(11,16))+'</b><span>'+fmt(x.temp)+'�</span><strong>'+(x.score??'-')+'</strong></div>').join('')+'</div><h4>48 gi? t?i</h4><div class="planner-hour-strip">'+timeline.map(x=>'<div title="'+esc(x.time.replace('T',' '))+' � '+(x.score??'Chua d? d? li?u')+'/100"><b>'+esc(x.time.slice(5,16).replace('T',' '))+'</b><span>'+fmt(x.temp)+'�</span><strong>'+(x.score??'-')+'</strong></div>').join('')+'</div></div><div class="planner-card"><h4>D? b�o 7 ng�y</h4><div class="planner-hours">'+(d.time||[]).slice(0,7).map((x,i)=>'<div><b>'+esc(x.slice(5))+'</b><span>'+(d.temperature_2m_max?.[i]??'-')+'�/'+(d.temperature_2m_min?.[i]??'-')+'�</span><strong>Mua '+(d.precipitation_probability_max?.[i]??'-')+'%</strong></div>').join('')+'</div></div>';
if(solar)html+='<div class="planner-card"><h4>B�nh minh / ho�ng h�n & gi? v�ng u?c t�nh</h4><p>B�nh minh '+solar.rise+' � Gi? v�ng s�ng '+solar.goldAM+' � Gi? v�ng chi?u '+solar.goldPM+' � Ho�ng h�n '+solar.set+'</p><p class="planner-muted">Gi? v�ng l� kho?ng u?c t�nh theo d? l?ch th?i gian, kh�ng ph?i do �nh s�ng t?i d?a di?m.</p></div>';
return html+'<p class="planner-attribution">Ngu?n th?i ti?t: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>; d? li?u kh�ng kh� CAMS ENSEMBLE.</p>';}
let status='';
function spotsView(){
 const items=spots.concat(spotsSeed.map(s=>({...s,curated:true})));
 let html='<div class="planner-head"><div><h3>D?a di?m ch?p</h3><p>'+esc(place?.label||'Ch?n v? tr� t? m?c Th?i ti?t d? t�m quanh d�')+'</p></div><div class="planner-map-actions"><button class="planner-primary" data-action="find-spots">T�m quanh v? tr�</button><button class="planner-btn" data-action="show-my-location">Hi?n th? v? tr� c?a t�i</button></div></div>';
 const mapPoint=myPosition||place;
 if(Number.isFinite(mapPoint?.latitude)&&Number.isFinite(mapPoint?.longitude)){
  const fullMapUrl='https://www.openstreetmap.org/?mlat='+mapPoint.latitude+'&mlon='+mapPoint.longitude+'#map='+(myPosition?'16':'14')+'/'+mapPoint.latitude+'/'+mapPoint.longitude;
  const coordinateText=myPosition?'V? tr� GPS: '+myPosition.latitude.toFixed(5)+', '+myPosition.longitude.toFixed(5)+(myPosition.accuracy?' � d? ch�nh x�c kho?ng '+Math.round(myPosition.accuracy)+' m':''):'';
  html+='<div class="planner-map"><div id="plannerMap" class="planner-map-canvas" role="application" aria-label="B?n d? OpenStreetMap c�c d?a di?m ch?p"></div><div class="planner-map-link"><span id="plannerMapMessage" role="status" aria-live="polite">Dang t?i b?n d?.</span><a href="'+esc(fullMapUrl)+'" target="_blank" rel="noopener">M? OpenStreetMap ?</a><small>c OpenFreeMap � c OpenMapTiles � OpenStreetMap</small>'+(coordinateText?'<small>'+esc(coordinateText)+'</small>':'')+'</div></div>';
 }
 html+='<p class="planner-status">'+esc(status)+'</p><div class="planner-spot-grid">';
 html+=items.slice(0,30).map(s=>{const name=s.name||s.tags?.name||'D?a di?m';const lat=s.lat??s.latitude,lon=s.lon??s.longitude;const url=Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))?'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon:(s.source||'https://www.openstreetmap.org/search?query='+encodeURIComponent(s.search||name));return '<article><h4>'+esc(name)+'</h4><small>'+(s.curated?'G?i y t�n � chua c� t?a d?':'OpenStreetMap')+'</small><p>'+esc(s.note||'Gi? m? c?a/quy?n ch?p: Chua c� d? li?u; hay t? x�c minh.')+'</p><a class="planner-btn" href="'+esc(url)+'" target="_blank" rel="noopener">M? b?n d? ?</a><button class="planner-link" data-select-spot="'+esc(s.id||name)+'">Ch?n</button></article>';}).join('');
 html+='<div class="planner-card"><button class="planner-primary" data-action="ai-spots">AI x?p h?ng danh s�ch n�y</button><p class="planner-muted">AI ch? du?c ch?n c�c d?a di?m dang hi?n th?; kh�ng t? t?o t�n d?a di?m.</p></div>'+aiPanel('/spots/rank')+'</div><p class="planner-attribution">D? li?u b?n d? c <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors (ODbL)</a>. T? ki?m tra quy?n v�o/ch?p, quy d?nh drone v� an to�n t?i ch?.</p>';
 return html;
}
const simClamp=(n,min,max)=>Math.min(max,Math.max(min,n));
function simPerson(x,y,scale=1,color='#0b7a5a'){
 return '<g transform="translate('+x+' '+y+') scale('+scale+')" stroke="'+color+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="0" cy="-56" r="10" fill="'+color+'" stroke="none"/><path d="M0 -44 L0 -16 M-15 -35 L0 -42 L15 -35 M-15 -35 L-22 -13 M15 -35 L22 -13 M0 -16 L-12 0 M0 -16 L12 0 M-12 0 L-16 17 M12 0 L16 17"/></g>';
}
function simPeople(centerX,groundY,scale=1){
 const positions=anglePose==='solo'?[0]:anglePose==='couple'?[-20,20]:[-42,-21,0,21,42];
 return positions.map((offset,i)=>simPerson(centerX+offset,groundY,scale,i%2?'#476e83':'#0b7a5a')).join('');
}
function orbitSvgTransform(){const yaw=simOrbitY*Math.PI/180,sx=(.68+.32*Math.cos(yaw)).toFixed(3),shift=Math.round(Math.sin(yaw)*16);return 'translate('+shift+' 0) translate(340 186) scale('+sx+' 1) translate(-340 -186) skewX('+Math.round(simOrbitX*.2)+')';}
function cameraSymbol(x,y){
 return '<g transform="translate('+x+' '+y+')" stroke="#183c3c" stroke-width="3" stroke-linejoin="round"><path d="M-19 -9h11l5 -7h18l5 7h7v25h-46z" fill="#ffffff"/><circle cx="3" cy="3" r="9" fill="#d8eee6"/><circle cx="3" cy="3" r="4" fill="#0b7a5a"/><path d="M-11 16l-8 18M10 16l8 18M-11 16l-15 18M10 16l15 18" fill="none" stroke-linecap="round"/></g>';
}
function framePreview(cx,cy,w,h,offset){
 const lines='<path d="M'+(cx+w/3)+' '+cy+'v'+h+'M'+(cx+2*w/3)+' '+cy+'v'+h+'M'+cx+' '+(cy+h/3)+'h'+w+'M'+cx+' '+(cy+2*h/3)+'h'+w+'" stroke="#6e8a89" stroke-width="1" stroke-dasharray="4 4"/>';
 const previewPositions=anglePose==='solo'?[offset]:anglePose==='couple'?[offset-12,offset+12]:[-24,-12,0,12,24].map(x=>x+offset);
 const people=previewPositions.map((x,i)=>'<g transform="translate('+(cx+w/2+x)+' '+(cy+h-18)+') scale(.38)" stroke="'+(i%2?'#476e83':'#0b7a5a')+'" stroke-width="7" stroke-linecap="round" fill="none"><circle cy="-56" r="10" fill="'+(i%2?'#476e83':'#0b7a5a')+'" stroke="none"/><path d="M0 -44v28m-15 -19l15 -9 15 9m-15 19l-12 22m12 -22l12 22"/></g>').join('');
 return '<rect x="'+cx+'" y="'+cy+'" width="'+w+'" height="'+h+'" rx="8" fill="#f7fbf9" stroke="#76928d" stroke-width="2"/>'+lines+people;
}
function simulatorSvg(item,index,mode){
 const high=index===2,low=index===1;
 const subjectX=simClamp(300+(simDistance-2)*14,300,450),ground=285;
 const camY=simClamp(ground-(simHeight-45)*.58,120,245);
 const aimY=high?ground-142:low?ground-187:ground-164;
 const frameOffset=index===0?-22:index===1?0:22;
 const markers=Array.from({length:5},(_,i)=>'<path d="M'+(i*100)+' 0v340" stroke="#dfe8e5" stroke-width="1"/>').join('');
 const floorLines=Array.from({length:6},(_,i)=>'<path d="M'+(24+i*86)+' 270L'+(65+i*65)+' 315" stroke="#bed1ca" stroke-width="1"/>').join('');
 const people=simPeople(subjectX,ground,1);
 const camera=cameraSymbol(100,camY);
 const viewCone='<path d="M125 '+(camY-7)+'L'+(subjectX-18)+' '+(aimY-66)+'L'+(subjectX-18)+' '+(ground+8)+'Z" fill="rgba(11,122,90,.12)" stroke="#0b7a5a" stroke-width="2" stroke-dasharray="7 5"/>';
 const distance='<path d="M100 326H'+subjectX+'" stroke="#536e78" stroke-width="1.5" stroke-dasharray="5 5"/><path d="M100 321v10M'+subjectX+' 321v10" stroke="#536e78" stroke-width="1.5"/><text x="'+((100+subjectX)/2)+'" y="322" text-anchor="middle" fill="#344b56" font-size="13">'+simDistance+' m � kho?ng c�ch</text>';
 let diagram;
 if(mode==='2d'){
  const heightMark='<path d="M54 '+camY+'V'+ground+'" stroke="#536e78" stroke-width="1.5" stroke-dasharray="4 4"/><path d="M49 '+camY+'h10M49 '+ground+'h10" stroke="#536e78" stroke-width="1.5"/><text x="38" y="'+((camY+ground)/2)+'" transform="rotate(-90 38 '+((camY+ground)/2)+')" text-anchor="middle" fill="#344b56" font-size="12">'+simHeight+' cm</text>';
  diagram='<svg viewBox="0 0 760 350" role="img" aria-label="So d? 2D: m�y ?nh, hu?ng nh�n, kho?ng c�ch, d? cao v� khung ?nh d? ki?n"><title>So d? 2D g�c ch?p '+esc(item.name)+'</title><rect width="760" height="350" rx="14" fill="#f4f8f6"/><path d="M20 '+ground+'H505" stroke="#81958f" stroke-width="3"/>'+markers+floorLines+viewCone+camera+people+'<text x="100" y="'+(camY-30)+'" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">M�y ?nh</text><text x="'+subjectX+'" y="302" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Ch? th?</text><text x="248" y="'+(aimY-75)+'" text-anchor="middle" fill="#0b7a5a" font-size="12">V�ng nh�n / hu?ng m�y</text>'+heightMark+distance+'<text x="620" y="32" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Khung ?nh d? ki?n � lu?i 1/3</text>'+framePreview(540,48,160,235,frameOffset)+'</svg>';
 } else {
  const rot=orbitSvgTransform();
  const floor='<polygon points="35,264 270,205 520,265 280,335" fill="#e2eee8" stroke="#9cb3aa" stroke-width="2"/>'+Array.from({length:5},(_,i)=>'<path d="M'+(70+i*48)+' '+(255-i*12)+'L'+(280+i*2)+' 327" stroke="#bdd0c7" stroke-width="1"/>').join('')+'<path d="M42 270L515 270M95 251L465 287M145 238L414 302" stroke="#c7d8d0" stroke-width="1"/>';
  const frustum='<path d="M122 '+(camY-5)+'L540 72L540 282Z" fill="rgba(11,122,90,.10)" stroke="#0b7a5a" stroke-width="2" stroke-dasharray="7 5"/>';
  diagram='<svg viewBox="0 0 760 370" role="img" aria-label="M� ph?ng ph?i c?nh 3D g?m m�y ?nh, mannequin, m?t s�n v� v�ng nh�n"><title>Ph?i c?nh 3D minh h?a g�c ch?p '+esc(item.name)+'</title><rect width="760" height="370" rx="14" fill="#f4f8f6"/><g data-orbit-world transform="'+rot+'">'+floor+frustum+camera+people+'<text x="103" y="'+(camY-30)+'" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">M�y ?nh</text><text x="'+subjectX+'" y="310" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Mannequin'+(anglePose==='solo'?'':' x '+(anglePose==='couple'?2:5))+'</text><text x="335" y="102" text-anchor="middle" fill="#0b7a5a" font-size="12">V�ng nh�n</text><text x="100" y="354" fill="#344b56" font-size="12">S�n / ph?i c?nh minh h?a</text></g><text x="635" y="33" text-anchor="middle" fill="#183c3c" font-size="13" font-weight="700">Khung ?nh � lu?i 1/3</text>'+framePreview(550,48,165,235,frameOffset)+'<text x="630" y="306" text-anchor="middle" fill="#344b56" font-size="12">'+simDistance+' m</text></svg>';
 }
 return diagram;
}
function anglesView(){
 const suggestions=angleOptions(angleGenre,'ngu?i trong ?nh',angleScene,anglePose);
 const safeIndex=simClamp(angleIndex,0,suggestions.length-1);
 const selected=suggestions[safeIndex];
 let fallbackMessage=simFallbackMessage;
 let shownMode=simMode;
 if(shownMode==='3d'&&typeof document.createElementNS!=='function'){shownMode='2d';simMode='2d';fallbackMessage='Thi?t b? kh�ng h? tr? SVG c?n thi?t; da chuy?n v? m� ph?ng 2D.';simFallbackMessage=fallbackMessage;}
 let drawing='';
 try{drawing=simulatorSvg(selected,safeIndex,shownMode);}catch{shownMode='2d';simMode='2d';drawing=simulatorSvg(selected,safeIndex,'2d');fallbackMessage='Kh�ng t?i du?c m� ph?ng 3D; da t? chuy?n v? 2D.';simFallbackMessage=fallbackMessage;}
 const poseOptions=[['solo','M?t ngu?i'],['couple','C?p d�i'],['group','Nh�m b?n']];
 const cards=suggestions.map((item,index)=>'<button type="button" class="planner-angle-choice'+(index===safeIndex?' active':'')+'" data-angle-index="'+index+'" aria-pressed="'+(index===safeIndex)+'"><small>G?i y '+(index+1)+(index===safeIndex?' � Dang m� ph?ng':'')+'</small><h4>'+esc(item.name)+'</h4><p><b>D?t m�y:</b> '+esc(item.height)+'. '+esc(item.distance)+'.</p><p><b>B? c?c:</b> '+esc(item.composition)+'</p><p class="planner-pose-tip"><b>T?o d�ng:</b> '+esc(item.poseTip)+'</p><p><b>M?o:</b> '+esc(item.tips)+'</p><p><b>N�n tr�nh:</b> '+esc(item.avoid)+'</p></button>').join('');
 return '<div class="planner-head"><div><h3>G�c ch?p & t?o d�ng</h3><p>Ch?n th? lo?i v� s? ngu?i d? nh?n g?i y g�c m�y c�ng c�ch t?o d�ng t? nhi�n.</p></div></div><form class="planner-card planner-form" data-form="angles"><div class="planner-row"><label>Th? lo?i ?nh<select name="genre">'+options(Object.entries(genres),angleGenre)+'</select></label><label>Ch? th?<select name="poseType">'+options(poseOptions,anglePose)+'</select></label><label>B?i c?nh (kh�ng b?t bu?c)<input name="scene" maxlength="120" value="'+esc(angleScene)+'" placeholder="V� d?: c�ng vi�n l�c ho�ng h�n"></label></div><button class="planner-primary" type="submit">C?p nh?t g?i y</button></form><section class="planner-sim" aria-labelledby="planner-sim-title"><div class="planner-sim-heading"><div><h4 id="planner-sim-title">M� ph?ng: '+esc(selected.name)+'</h4><p>Ch?n 2D ho?c 3D. K�o v�ng minh h?a 3D d? xoay g�c nh�n.</p></div><div class="planner-sim-modes" role="group" aria-label="Ch? d? m� ph?ng"><button type="button" data-sim-mode="2d" aria-pressed="'+(shownMode==='2d')+'">2D</button><button typ…10242 tokens truncated…

async function findSpots(){
  if(!place||!Number.isFinite(place.latitude)||!Number.isFinite(place.longitude)){
    status='Ch?n v? tr� trong m?c Th?i ti?t tru?c.';
    render();
    return;
  }
  status='Dang t�m OpenStreetMap quanh v? tr�.';
  render();
  const ql='[out:json][timeout:10];(nwr(around:5000,'+place.latitude+','+place.longitude+')[leisure~"park|garden|nature_reserve"];nwr(around:5000,'+place.latitude+','+place.longitude+')[tourism~"attraction|museum|viewpoint|artwork"];nwr(around:5000,'+place.latitude+','+place.longitude+')[historic];);out center tags 35;';
  let worker=String(import.meta.env.VITE_AI_ENDPOINT||localStorage.getItem('photolens_worker_url')||'');
  while(worker.endsWith('/'))worker=worker.slice(0,-1);
  const endpoints=[
    ['https://overpass-api.de/api/interpreter','m�y ch? Overpass ch�nh'],
    ['https://overpass.private.coffee/api/interpreter','m�y ch? Overpass d? ph�ng'],
    ['https://ovp.dresel.systems/api-as/interpreter','m�y ch? Overpass khu v?c ch�u A']
  ];
  let data=null,source='',workerError='';
  if(worker){
    try{
      data=await jsonFetch(worker+'/spots/nearby?lat='+place.latitude.toFixed(2)+'&lon='+place.longitude.toFixed(2)+'&radius=5000');
      if(!Array.isArray(data?.elements))throw new Error('Worker tr? d? li?u kh�ng d�ng d?nh d?ng.');
      source='PhotoLens Worker';
    }catch(error){workerError=error.message||'kh�ng k?t n?i du?c';}
  }
  if(!data){
    const errors=[];
    for(const [endpoint,label] of endpoints){
      try{
        const result=await jsonFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:'data='+encodeURIComponent(ql)},10000);
        if(!Array.isArray(result?.elements))throw new Error('M�y ch? tr? d? li?u kh�ng d�ng d?nh d?ng.');
        data=result;
        source=label;
        break;
      }catch(error){errors.push(error.message||'l?i k?t n?i');}
    }
    if(!data)throw new Error(errors.join(' � ')||'Kh�ng k?t n?i du?c c�c m�y ch? Overpass.');
  }
  spots=(data.elements||[]).map(e=>({id:'osm-'+e.type+'-'+e.id,name:e.tags?.['name:vi']||e.tags?.name,lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,tags:e.tags,source:'https://www.openstreetmap.org/'+e.type+'/'+e.id,note:'Gi? m? c?a/quy?n ch?p: Chua c� d? li?u; hay t? x�c minh.'})).filter(s=>s.name&&Number.isFinite(Number(s.lat)));
  status=spots.length?'Da nh?n '+spots.length+' k?t qu? t? OpenStreetMap.':'Kh�ng c� d?a di?m ph� h?p trong v�ng t�m.';
  if(workerError)status+=' Worker l?i ('+workerError+'); da t? chuy?n sang '+source+'.';
  else if(!worker)status+=' Ngu?n: '+source+'.';
  render();
}
async function findSpotsWithFallback(){try{await findSpots();}catch(error){status='Kh�ng t?i du?c Overpass: '+(error.message||'l?i k?t n?i')+'. Danh s�ch d?a di?m tuy?n ch?n v?n d�ng du?c.';render();}}
function orbitTransform(){
 const world=panel?.querySelector('[data-orbit-world]');
 if(world)world.setAttribute('transform',orbitSvgTransform());
}
function orbitStart(e){
 const stage=e.target.closest('[data-sim-stage][data-mode="3d"]');
 if(!stage||e.target.closest('button,input'))return;
 simDrag={x:e.clientX,y:e.clientY,startX:simOrbitX,startY:simOrbitY};
 try{stage.setPointerCapture(e.pointerId);}catch{}
}
function orbitMove(e){
 if(!simDrag)return;
 simOrbitY=simClamp(simDrag.startY+(e.clientX-simDrag.x)*.35,-55,55);
 simOrbitX=simClamp(simDrag.startX+(e.clientY-simDrag.y)*.25,-28,24);
 orbitTransform();
}
function orbitEnd(){simDrag=null;}
function updateWardrobeAvatarTransform(){
 const avatar=panel?.querySelector('[data-tryon-avatar]');
 if(avatar){avatar.style.setProperty('--wardrobe-yaw',wardrobeYaw+'deg');avatar.style.setProperty('--wardrobe-pitch',wardrobePitch+'deg');}
}
function wardrobeOrbit(direction){
 if(direction==='left')wardrobeYaw-=12;
 if(direction==='right')wardrobeYaw+=12;
 if(direction==='up')wardrobePitch=Math.max(-24,wardrobePitch-8);
 if(direction==='down')wardrobePitch=Math.min(24,wardrobePitch+8);
 updateWardrobeAvatarTransform();
}
function wardrobeOrbitStart(e){
 const stage=e.target.closest('[data-tryon-stage][data-mode="3d"]');
 if(!stage||e.target.closest('button,input'))return;
 wardrobeDrag={x:e.clientX,y:e.clientY,yaw:wardrobeYaw,pitch:wardrobePitch};
 try{stage.setPointerCapture(e.pointerId);}catch{}
}
function wardrobeOrbitMove(e){
 if(!wardrobeDrag)return;
 wardrobeYaw=wardrobeDrag.yaw+(e.clientX-wardrobeDrag.x)*.55;
 wardrobePitch=Math.max(-24,Math.min(24,wardrobeDrag.pitch+(e.clientY-wardrobeDrag.y)*.35));
 updateWardrobeAvatarTransform();
}
function wardrobeOrbitEnd(){wardrobeDrag=null;}
function wardrobeKeydown(e){
 if(!e.target.matches('[data-tryon-avatar]')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();
 wardrobeOrbit(({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'})[e.key]);
}
function wardrobeSearchInput(e){
 if(!e.target.matches('[data-wardrobe-search]'))return;
 wardrobeFilters.query=e.target.value;
 const current=forecast?.current||{},list=panel?.querySelector('[data-wardrobe-list]');
 if(list)list.innerHTML=wardrobeItemCards(filterWardrobeItems(wardrobeStore().listItems(),wardrobeFilters,{temp:current.temperature_2m,rain:current.precipitation,wind:current.wind_speed_10m}));
}
async function click(e){
  const tabButton=e.target.closest('[data-tab]');
  if(tabButton){tab=tabButton.dataset.tab;render();if(tab==='weather'&&!forecast&&place?.label==='H� N?i')findWeather('H� N?i');return;}
  const angleChoice=e.target.closest('[data-angle-index]');
  if(angleChoice){simFallbackMessage='';angleIndex=Number(angleChoice.dataset.angleIndex)||0;simHeight=[160,120,200][angleIndex]||160;simDistance=[4,5,4][angleIndex]||4;render();return;}
  const simButton=e.target.closest('[data-sim-mode]');
  if(simButton){simFallbackMessage='';simMode=simButton.dataset.simMode==='3d'?'3d':'2d';render();return;}
  const orbitButton=e.target.closest('[data-orbit-step]');
  if(orbitButton){const step=orbitButton.dataset.orbitStep;if(step==='left')simOrbitY=simClamp(simOrbitY-8,-55,55);if(step==='right')simOrbitY=simClamp(simOrbitY+8,-55,55);if(step==='up')simOrbitX=simClamp(simOrbitX-6,-28,24);if(step==='down')simOrbitX=simClamp(simOrbitX+6,-28,24);orbitTransform();return;}
  const swatch=e.target.closest('[data-palette-bg]');
  if(swatch){save('photolens_bg_color',swatch.dataset.paletteBg);render();return;}
  const openLook=e.target.closest('[data-plan-open-look]');
  if(openLook){if(openSavedWardrobeLook(openLook.dataset.planOpenLook))openWardrobeSection('studio2d');return;}
  const wardrobeTab=e.target.closest('[data-wardrobe-section]');
  if(wardrobeTab){wardrobeSection=wardrobeTab.dataset.wardrobeSection;render();return;}
  const wardrobeModeButton=e.target.closest('[data-wardrobe-mode]');
  if(wardrobeModeButton){wardrobeMode=wardrobeModeButton.dataset.wardrobeMode==='3d'?'3d':'2d';wardrobeNotice='';render();return;}
  const sampleButton=e.target.closest('[data-wardrobe-sample]');
  if(sampleButton){const sample=WARDROBE_SAMPLES.find(x=>x.id===sampleButton.dataset.wardrobeSample);if(sample&&wardrobeStore().saveItem(sample)){wardrobeStatus='Da th�m m�n minh h?a v�o t? d? tr�n thi?t b? n�y.';}else wardrobeStatus='Kh�ng luu du?c m�n d? v�o b? nh? thi?t b?.';render();return;}
  const selectButton=e.target.closest('[data-wardrobe-select]');
  if(selectButton){const item=wardrobeStore().listItems().find(x=>x.id===selectButton.dataset.wardrobeSelect);if(item){const same=wardrobeStore().listItems().filter(x=>wardrobeSelection.includes(x.id)&&x.category===item.category).map(x=>x.id);wardrobeSelection=wardrobeSelection.filter(id=>!same.includes(id));if(!same.includes(item.id))wardrobeSelection.push(item.id);}wardrobeSection='tryon';render();return;}
  const removeChip=e.target.closest('[data-wardrobe-remove]');
  if(removeChip){wardrobeSelection=wardrobeSelection.filter(id=>id!==removeChip.dataset.wardrobeRemove);render();return;}
  const layerButton=e.target.closest('[data-wardrobe-layer]');
  if(layerButton){const from=wardrobeSelection.indexOf(layerButton.dataset.wardrobeId),to=from+(layerButton.dataset.wardrobeLayer==='up'?1:-1);if(from>=0&&to>=0&&to<wardrobeSelection.length){[wardrobeSelection[from],wardrobeSelection[to]]=[wardrobeSelection[to],wardrobeSelection[from]];render();}return;}
  const editButton=e.target.closest('[data-wardrobe-edit]');
  if(editButton){wardrobeEditingId=editButton.dataset.wardrobeEdit;wardrobeSection='wardrobe';render();return;}
  if(e.target.closest('[data-wardrobe-cancel-edit]')){wardrobeEditingId='';render();return;}
  const deleteItem=e.target.closest('[data-wardrobe-delete]');
  if(deleteItem){const id=deleteItem.dataset.wardrobeDelete;if(wardrobeStore().removeItem(id)){wardrobeSelection=wardrobeSelection.filter(x=>x!==id);if(wardrobeEditingId===id)wardrobeEditingId='';wardrobeStatus='Da x�a m�n d?.';}else wardrobeStatus='Kh�ng x�a du?c m�n d? kh?i b? nh?.';render();return;}
  const loadOutfit=e.target.closest('[data-wardrobe-load]');
  if(loadOutfit){const outfit=wardrobeStore().listOutfits().find(x=>x.id===loadOutfit.dataset.wardrobeLoad);if(outfit){wardrobeSelection=outfit.itemIds.slice();wardrobeSection='tryon';}render();return;}
  const duplicateOutfit=e.target.closest('[data-wardrobe-duplicate]');
  if(duplicateOutfit){const copy=wardrobeStore().duplicateOutfit(duplicateOutfit.dataset.wardrobeDuplicate);wardrobeStatus=copy?'Da nh�n b?n b? ph?i.':'Kh�ng th? nh�n b?n b? ph?i.';render();return;}
  const deleteOutfit=e.target.closest('[data-wardrobe-delete-outfit]');
  if(deleteOutfit){wardrobeStore().removeOutfit(deleteOutfit.dataset.wardrobeDeleteOutfit);wardrobeStatus='Da x�a b? ph?i.';render();return;}
  const orbitWardrobe=e.target.closest('[data-wardrobe-orbit]');
  if(orbitWardrobe){wardrobeOrbit(orbitWardrobe.dataset.wardrobeOrbit);return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='ai-spots'){await runPhotographyAI(action);return;}
  if(action==='locate')locate();
  if(action==='show-my-location')showMyLocation();
  if(action==='find-spots')findSpotsWithFallback();
  if(action==='change-city'){tab='weather';forecast=null;render();}
  if(action==='close')close();
  if(e.target.matches('[data-select-spot]')){pickedSpot=spots.find(s=>s.id===e.target.dataset.selectSpot)||spotsSeed.find(s=>s.id===e.target.dataset.selectSpot);status='Da ch?n d?a di?m cho k? ho?ch.';render();}
  if(e.target.matches('[data-delete-plan]')){repo.remove(e.target.dataset.deletePlan);render();}
  if(e.target.matches('[data-edit-plan]')){editingPlan=e.target.dataset.editPlan;tab='plans';render();}
  if(action==='export-plans')exportPlans();
}
async function submit(e){
  e.preventDefault();const form=e.target,fd=new FormData(form);
  if(form.dataset.form==='weather'){findWeather(String(fd.get('place')||'').trim());return;}
  if(form.dataset.form==='angles'){angleGenre=String(fd.get('genre')||'portrait');anglePose=String(fd.get('poseType')||'solo');angleScene=String(fd.get('scene')||'').trim();angleIndex=0;simFallbackMessage='';simHeight=160;simDistance=4;render();return;}
  if(form.dataset.form==='wardrobe-item'){
   const input=Object.fromEntries(fd),selectedWeather=fd.getAll('weather').map(String);
   input.weather=!selectedWeather.length||selectedWeather.includes('all')?['all']:selectedWeather;
   if(input.id==='')delete input.id;
   const saved=wardrobeStore().saveItem(input);
   if(!saved){wardrobeStatus='Hay nh?p t�n m�n d? h?p l?; d? li?u luu tr�n thi?t b? kh�ng d?i.';render();return;}
   wardrobeEditingId='';wardrobeStatus=input.id?'Da c?p nh?t m�n d? tr�n thi?t b?.':'Da th�m m�n d? v�o t? d? tr�n thi?t b?.';render();return;
  }
  if(form.dataset.form==='wardrobe-outfit'){
   const saved=wardrobeStore().saveOutfit({name:fd.get('name'),itemIds:wardrobeSelection});
   wardrobeStatus=saved?'Da luu b? ph?i tr�n thi?t b?.':'Ch?n �t nh?t m?t m�n tru?c khi luu b? ph?i.';render();return;
  }
  if(form.dataset.form==='wardrobe-rename'){
   const renamed=wardrobeStore().renameOutfit(String(fd.get('id')||''),String(fd.get('name')||''));
   wardrobeStatus=renamed?'Da d?i t�n b? ph?i.':'Kh�ng d?i du?c t�n b? ph?i.';render();return;
  }
  if(form.dataset.form==='plan'){
   const plan=Object.fromEntries(fd),existing=repo.list().find(row=>row.id===plan.id);
   plan.wardrobeLook=getPlanLookReference(plan.wardrobeLookId,existing?.wardrobeLook,listWardrobeLooks());
   delete plan.wardrobeLookId;
   const saved=repo.save(plan);if(!saved){alert('Kh�ng luu du?c k? ho?ch.');return;}editingPlan='';pendingPlanLook=null;status='Da luu k? ho?ch tr�n thi?t b?.';render();}
}
function updateSimulation(){
 const stage=panel?.querySelector('[data-sim-stage]');
 if(!stage)return;
 const suggestions=angleOptions(angleGenre,'ngu?i trong ?nh',angleScene,anglePose),index=simClamp(angleIndex,0,suggestions.length-1);
 try{stage.innerHTML=simulatorSvg(suggestions[index],index,simMode);stage.dataset.mode=simMode;}
 catch{simMode='2d';simFallbackMessage='Kh�ng t?i du?c m� ph?ng 3D; da t? chuy?n v? 2D.';render();}
}
function updateRange(e){
 if(e.target.matches('[data-wardrobe-search]')){wardrobeSearchInput(e);return;}
 if(!e.target.matches('[data-sim-height],[data-sim-distance]'))return;
 const value=Number(e.target.value);
 if(e.target.matches('[data-sim-height]'))simHeight=value||160;
 else simDistance=value||4;
 const output=e.target.closest('label')?.querySelector('output');
 if(output)output.textContent=String(value);
 updateSimulation();
}
function change(e){
  const key=e.target.dataset.outfitWeather;
  if(['temp','rain','wind'].includes(key)){
   const raw=e.target.value;
   manualWeather[key]=raw===''||raw==='auto'||!e.target.validity.valid?null:Number(raw);
   render();return;
  }
  if(e.target.matches('[data-sim-focal]')){simFocalLength=Number(e.target.value)||50;return;}
  if(e.target.matches('[data-wardrobe-filter]')){wardrobeFilters[e.target.dataset.wardrobeFilter]=e.target.value;render();return;}
  if(e.target.matches('[data-genre]')){genre=e.target.value;render();}
  if(e.target.matches('[data-bg]')){save('photolens_bg_color',e.target.value);tab='outfit';render();}
  if(e.target.matches('[data-style]')){save('photolens_outfit_style',e.target.value);render();}
}
async function exportPlans(format='json'){
 const plans=repo.list();if(!plans.length){status='Chua c� k? ho?ch d? xu?t.';render();return;}
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
   const title=document.createElement('h1');title.textContent=p.title||'K? ho?ch ch?p';title.style.cssText='font-size:34px;margin:0 0 24px;color:#8cefc9';card.append(title);
   const lines=[['Ng�y',p.date],['Th? lo?i',genres[p.genre]||'Chua c� d? li?u'],['D?a di?m',p.location],['D? mang theo',p.gear],['B? ph?i',listWardrobeLooks().find(look=>look.id===p.wardrobeLook?.id)?.name||p.wardrobeLook?.name],['Ghi ch�',p.notes]];
   for(const pair of lines){const row=document.createElement('p'),strong=document.createElement('strong');strong.textContent=pair[0]+': ';row.append(strong,document.createTextNode(pair[1]||'Chua c� d? li?u'));row.style.margin='0 0 14px';card.append(row);}
   host.replaceChildren(card);
   const canvas=await html2canvas(card,{backgroundColor:'#0a1017',scale:2,useCORS:false});
   if(format==='pdf'){if(i)pdf.addPage();const pageW=210,pageH=297,margin=14,scale=Math.min((pageW-margin*2)*96/25.4/canvas.width,(pageH-margin*2)*96/25.4/canvas.height),w=canvas.width*scale*25.4/96,h=canvas.height*scale*25.4/96;pdf.addImage(canvas.toDataURL('image/png'),'PNG',(pageW-w)/2,margin,w,h);}
   else{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Kh�ng t?o du?c ?nh PNG.');await deliverBlob(blob,'PhotoLens-ke-hoach-chup.png');}
  }
  if(format==='pdf'){const blob=pdf.output('blob');await deliverBlob(blob,'PhotoLens-ke-hoach-chup.pdf');}
 }catch(error){status='Kh�ng xu?t du?c t?p: '+(error.message||'l?i kh�ng x�c d?nh');render();}
 finally{host.remove();}
}
async function deliverBlob(blob,name){
 const file=new File([blob],name,{type:blob.type});
 if(Capacitor.isNativePlatform()){
  try{const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});const saved=await Filesystem.writeFile({path:name,data,directory:Directory.Cache});await Share.share({title:'K? ho?ch PhotoLens',files:[saved.uri],dialogTitle:'Chia s? k? ho?ch'});return;}catch{}
 }
 try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:'K? ho?ch PhotoLens',files:[file]});return;}}catch(error){if(error?.name==='AbortError')return;}
 download(blob,name);
}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
