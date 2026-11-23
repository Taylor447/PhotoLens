import '../css/planner.css';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import builtIns from '../data/devices.json';
import spotsSeed from '../data/spots.json';
import scoreConfig from '../data/device-scoring.json';
import weatherConfig from '../data/weather-scoring.json';
import {DEVICE_FIELDS,expandDevice,compareDevices,deviceScore,recommendDevices,conditionScore,bestHours,solarWindows,outfitOptions,createPlanStore,scoreHours,esc} from '../core/photography.js';
import {describeDeviceType,getDeviceType,getDeviceTypes,normalizeDeviceText,normalizeDeviceTypeFilter,searchDeviceTypes} from '../core/device-types.js';

const $=(s,r=document)=>r.querySelector(s), genres={portrait:'Ch�n dung',landscape:'Phong c?nh',architecture:'Ki?n tr�c',street:'Du?ng ph?',night:'Du?ng ph? d�m',moon:'Ch?p trang',cosplay:'Cosplay',documentary:'Tu li?u'};
const recommendationPurposes={portrait:'Ch�n dung',travel:'Du l?ch',lowLight:'Thi?u s�ng',landscape:'Phong c?nh',architecture:'Ki?n tr�c',sports:'Th? thao / d?ng v?t',video:'Video / vlog',editing:'H?u k?'};

let panel=null,tab='devices',place={label:'H� N?i'},forecast=null,myPosition=null,spots=[],pickedSpot=null,genre='portrait',onlyDiff=false,editingPlan='',aiResult=null,aiRoute='',aiMessage='',showEstimatedCost=false;
const repo=createPlanStore();
const json=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback;}catch{return fallback;}};
let recommendationPrefs=json('photolens_device_recommendation_v1',{type:'all',purpose:'portrait',budget:'',currentDeviceId:'',priorities:[]});

const save=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const myDevices=()=>json('photolens_my_devices_v1',[]).map(expandDevice);
const devices=()=>builtIns.map(expandDevice).concat(myDevices());
const get=(o,path)=>path.split('.').reduce((a,k)=>a&&a[k],o);
const fmt=(v,u='')=>v===null||v===undefined||v===''?'Chua c� d? li?u':String(Array.isArray(v)?v.join(', '):v)+(u?' '+u:'');
const safeHttpUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:'';}catch{return '';}};
const options=(data,current)=>data.map(x=>'<option value="'+esc(x[0])+'" '+(x[0]===current?'selected':'')+'>'+esc(x[1])+'</option>').join('');
function deviceTypeDepth(type){let depth=0,parent=type?.parentId;while(parent){depth++;parent=getDeviceType(parent)?.parentId;}return Math.min(depth,4);}
function deviceTypePath(type){const path=[];let parent=type?.parentId?getDeviceType(type.parentId):null;while(parent){path.unshift(parent.nameVi);parent=parent.parentId?getDeviceType(parent.parentId):null;}return [...path,type?.nameVi||'Chua ph�n lo?i'].join(' > ');}
function deviceTypeOptionMarkup(id,label,searchText,depth,scoreable,selected){
 return '<button type="button" role="option" id="planner-rec-type-option-'+esc(id)+'" data-device-type-option="'+esc(id)+'" data-search-text="'+esc(searchText)+'" data-depth="'+depth+'" aria-selected="'+(selected?'true':'false')+'" class="planner-type-option"><span>'+esc(label)+'</span>'+(scoreable===false?'<small>Kh�ng ch?m di?m ?nh thu?ng</small>':'')+'</button>';
}
function deviceTypePickerMarkup(selected){
 const selectedId=normalizeDeviceTypeFilter(selected||'all');
 const selectedType=selectedId==='all'?null:getDeviceType(selectedId);
 const selectedLabel=selectedType?.nameVi||'T?t c? thi?t b?';
 const typeOptions=getDeviceTypes().filter(type=>type.id!=='unclassified');
 const optionsHtml=deviceTypeOptionMarkup('all','T?t c? thi?t b?','all tat ca moi loai',0,true,selectedId==='all')+
  typeOptions.map(type=>deviceTypeOptionMarkup(type.id,deviceTypePath(type),[type.id,type.nameVi,type.nameEn,...(type.aliases||[]),...(type.modelAliases||[]),...(type.brandAliases||[]),...(type.keywords||[])].join(' '),deviceTypeDepth(type),type.scoreable,selectedId===type.id)).join('')+
  (()=>{const type=getDeviceType('unclassified');return deviceTypeOptionMarkup(type.id,deviceTypePath(type),[type.id,type.nameVi,type.nameEn,...(type.aliases||[]),...(type.keywords||[])].join(' '),0,type.scoreable,selectedId===type.id);})();
 return '<div class="planner-type-picker"><label for="planner-rec-type-search">Lo?i thi?t b?</label><div class="planner-type-search-row"><input id="planner-rec-type-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="planner-rec-type-listbox" autocomplete="off" data-device-type-search placeholder="T�m t�n Vi?t/Anh ho?c alias"><button type="button" class="planner-btn planner-type-toggle" data-device-type-toggle aria-label="M? danh s�ch lo?i thi?t b?" aria-controls="planner-rec-type-listbox" aria-expanded="false">?</button></div><input type="hidden" name="type" data-device-type-value value="'+esc(selectedId)+'"><p class="planner-type-current" data-device-type-current role="status" aria-live="polite">Dang l?c theo: '+esc(selectedLabel)+(selectedType?.scoreable===false?' � kh�ng ch?m di?m ?nh thu?ng':'')+'</p><div id="planner-rec-type-listbox" class="planner-type-listbox" role="listbox" aria-label="Nh�m v� lo?i thi?t b?" hidden>'+optionsHtml+'</div><p class="planner-type-results" data-device-type-results role="status" aria-live="polite" hidden></p></div>';
}
function filterDeviceTypeOptions(query){
 const input=$('[data-device-type-search]',panel),list=$('[data-device-type-listbox]',panel),status=$('[data-device-type-results]',panel),selected=$('[data-device-type-value]',panel)?.value||'all';
 if(!input||!list)return;
 const normalized=normalizeDeviceText(query),matches=new Set(searchDeviceTypes(query).map(type=>type.id));
 let visible=0;
 for(const option of list.querySelectorAll('[data-device-type-option]')){
  const id=option.dataset.deviceTypeOption;
  const show=!normalized||(id==='all'?['all','any','tat ca','tat ca thiet bi','moi loai'].some(term=>term.includes(normalized)||normalized.includes(term)):matches.has(id));
  option.hidden=!show;option.dataset.active='false';option.setAttribute('aria-selected',String(id===selected));if(show)visible++;
 }
 list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 const toggle=$('[data-device-type-toggle]',panel);toggle?.setAttribute('aria-expanded','true');
 if(status){status.hidden=false;status.textContent=visible?visible+' lo?i ph� h?p. D�ng ph�m mui t�n r?i Enter, ho?c ch?m d? ch?n.':'Kh�ng t�m th?y lo?i ph� h?p. Ch?n "Chua ph�n lo?i" n?u chua nh?n di?n ch?c ch?n.';}
}
function hideDeviceTypeOptions(clearSearch=false){
 const input=$('[data-device-type-search]',panel),list=$('[data-device-type-listbox]',panel),status=$('[data-device-type-results]',panel),toggle=$('[data-device-type-toggle]',panel);
 if(clearSearch&&input)input.value='';
 if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
 if(list)list.hidden=true;
 if(status)status.hidden=true;
 toggle?.setAttribute('aria-expanded','false');
}
function selectDeviceType(id){
 const selectedId=normalizeDeviceTypeFilter(id||'all'),hidden=$('[data-device-type-value]',panel),current=$('[data-device-type-current]',panel);
 const type=selectedId==='all'?null:getDeviceType(selectedId);
 if(hidden)hidden.value=selectedId;
 if(current)current.textContent='Dang l?c theo: '+(type?.nameVi||'T?t c? thi?t b?')+(type?.scoreable===false?' � kh�ng ch?m di?m ?nh thu?ng':'');
 hideDeviceTypeOptions(true);
}
function handleDeviceTypeInput(e){if(e.target.matches('[data-device-type-search]'))filterDeviceTypeOptions(e.target.value);}
function handleDeviceTypeKeydown(e){
 if(!e.target.matches('[data-device-type-search]'))return;
 const input=e.target,list=$('[data-device-type-listbox]',panel);
 if(e.key==='Escape'){e.preventDefault();hideDeviceTypeOptions(true);return;}
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
  e.preventDefault();if(list.hidden)filterDeviceTypeOptions(input.value);
  const options=[...list.querySelectorAll('[data-device-type-option]:not([hidden])')];
  if(!options.length)return;
  const activeId=input.getAttribute('aria-activedescendant');
  let index=options.findIndex(option=>option.id===activeId);
  index=e.key==='ArrowDown'?Math.min(options.length-1,index+1):Math.max(0,index<0?options.length-1:index-1);
  options.forEach(option=>option.dataset.active='false');
  options[index].dataset.active='true';input.setAttribute('aria-activedescendant',options[index].id);options[index].scrollIntoView({block:'nearest'});
  return;
 }
 if(e.key==='Enter'){
  e.preventDefault();if(list.hidden)filterDeviceTypeOptions(input.value);
  const options=[...list.querySelectorAll('[data-device-type-option]:not([hidden])')];
  const active=list.querySelector('[data-active="true"]');
  if(active)selectDeviceType(active.dataset.deviceTypeOption);
  else if(options.length===1)selectDeviceType(options[0].dataset.deviceTypeOption);
 }
}

function makeTabs(){return [['devices','Thi?t b?'],['weather','Th?i ti?t'],['spots','D?a di?m'],['outfit','Trang ph?c'],['plans','K? ho?ch']].map(x=>'<button role="tab" aria-selected="'+(tab===x[0])+'" class="'+(tab===x[0]?'active':'')+'" data-tab="'+x[0]+'">'+x[1]+'</button>').join('');}
function deviceRecommendationView(all){
 const p=recommendationPrefs||{type:'all',purpose:'portrait',budget:'',currentDeviceId:'',priorities:[]};
 const result=recommendDevices(all,p,scoreConfig);
 const purposeOptions=Object.entries(recommendationPurposes);
 const priorityOptions=Object.entries(scoreConfig.recommendation.criteria||{}).map(([id,criterion])=>'<label><input form="planner-rec-form" type="checkbox" name="priority" value="'+esc(id)+'" '+(p.priorities?.includes(id)?'checked':'')+'> '+esc(criterion.label||id)+'</label>').join('');
 let html='<section class="planner-card planner-rec"><div class="planner-head"><div><h3>Thi?t b? d? xu?t</h3><p>X?p h?ng c?c b? theo d? li?u thi?t b? dang c�. Di?m tham kh?o, kh�ng ph?i di?m d�nh gi� camera.</p></div></div><form id="planner-rec-form" class="planner-rec-form" data-form="device-recommendation"><div class="planner-row">'+deviceTypePickerMarkup(p.type||'all')+'<label>M?c d�ch<select name="purpose">'+options(purposeOptions,p.purpose||'portrait')+'</select></label><label>Ng�n s�ch (VND, kh�ng b?t bu?c)<input name="budget" type="number" min="0" step="100000" inputmode="numeric" value="'+esc(p.budget||'')+'" placeholder="V� d?: 20000000"></label><label>Thi?t b? hi?n t?i<select name="currentDeviceId"><option value="">Kh�ng ch?n</option>'+all.map(device=>'<option value="'+esc(device.id)+'" '+(p.currentDeviceId===device.id?'selected':'')+'>'+esc(device.brand+' '+device.model)+'</option>').join('')+'</select></label></div></form>';
 if(result.notice)html+='<p class="planner-muted" role="status">'+esc(result.notice)+'</p>';
 if(!result.recommendations.length)html+='<p class="planner-empty" role="status">'+esc(result.message)+'</p>';
 else html+='<div class="planner-rec-grid">'+result.recommendations.map((item,index)=>{
  const device=item.device;
  const reasons=item.reasons.map(x=>esc(x.label)+' '+x.score+'/100').join(' � ')||'Chua d? ti�u ch� n?i b?t.';
  const criterionRows=item.criteria.map(x=>'<li><b>'+esc(x.label)+':</b> '+(x.score===null?'Chua c� d? li?u':x.score+'/100')+'</li>').join('');
  const facts=DEVICE_FIELDS.map(field=>{const value=get(device,field.path);if(value===null||value===undefined||value==='')return '';const shown=typeof value==='object'?JSON.stringify(value):fmt(value,field.unit);return '<li><b>'+esc(field.label)+':</b> '+esc(shown)+'</li>';}).join('');
  const source=safeHttpUrl(device.sourceUrl)?'<a href="'+esc(safeHttpUrl(device.sourceUrl))+'" target="_blank" rel="noopener">Ngu?n th�ng s?</a> � ki?m tra '+esc(device.checkedAt||'Chua c� ng�y'):'Chua c� ngu?n li�n k?t.';
  const price=item.priceVnd===null?'Chua c� d? li?u':item.priceVnd.toLocaleString('vi-VN')+' ?';
  return '<article class="planner-rec-card"><div class="planner-rec-heading"><div><small>G?i y '+(index+1)+' � '+esc(device.type||'other')+'</small><h4>'+esc(device.brand+' '+device.model)+'</h4><span class="planner-badge">'+(device.verified?'Da x�c minh':'Chua x�c minh')+'</span></div><div class="planner-rec-score"><strong>'+item.score+'/100</strong><small>D?a tr�n '+item.confidence.known+'/'+item.confidence.total+' ti�u ch�</small></div></div><p><b>Di?m kh?p cao:</b> '+reasons+'</p><p><b>Gi�:</b> '+esc(price)+'</p><ul class="planner-rec-criteria">'+criterionRows+'</ul><p><b>Gi?i h?n d? li?u:</b> '+esc(item.missingCriteria.length?item.missingCriteria.join(', '):'Kh�ng thi?u ti�u ch� trong b? x?p h?ng.')+'</p><small class="planner-rec-source">'+source+'</small><details><summary>Xem th�ng s? da c�</summary><ul>'+facts+'</ul></details><button type="button" class="planner-btn" data-compare-device="'+esc(device.id)+'">Dua v�o so s�nh</button></article>';
 }).join('')+'</div>';
 html+='<details class="planner-rec-method"><summary>C�ch t�nh di?m</summary><p>Tr?ng s? theo m?c d�ch du?c c?u h�nh trong data/device-scoring.json. Ti�u ch� b?n ch?n du?c nh�n tr?ng s? theo priorityBoost. Ti�u ch� thi?u d? li?u b? lo?i kh?i m?u s?; c?n t?i thi?u '+Number(scoreConfig.recommendation.minimumKnownCriteria||2)+' ti�u ch� c� d? li?u. Ng�n s�ch ch? l?c thi?t b? c� gi� VND du?c ghi ro. Ri�ng di?m ch?ng rung x�c nh?n d? li?u c� ghi nh?n, kh�ng do hi?u qu? th?c t?; di?m ch?t lu?ng ?nh d�ng c�c ch? s? c� s?n, kh�ng thay th? th? nghi?m.</p></details>';html+='<fieldset class="planner-rec-priorities"><legend>Y?u t? mu?n uu ti�n th�m</legend>'+priorityOptions+'</fieldset><button form="planner-rec-form" class="planner-primary" type="submit">D? xu?t thi?t b?</button></section>';
 return html;
}
function deviceView(){const all=devices();let ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']);ids=ids.filter(Boolean).slice(0,3);const picked=ids.map(id=>all.find(d=>d.id===id)).filter(Boolean);const rows=compareDevices(picked,onlyDiff);let html=deviceRecommendationView(all)+'<div class="planner-head"><div><h3>So s�nh thi?t b?</h3></div><button class="planner-btn" data-action="add-device">+ Thi?t b? c?a t�i</button></div><div class="planner-card"><div class="planner-row">';
for(let i=0;i<3;i++){html+='<label>Thi?t b? '+String.fromCharCode(65+i)+'<select data-device="'+i+'">'+(i===2?'<option value="">Kh�ng ch?n</option>':'')+all.map(d=>'<option value="'+esc(d.id)+'" '+(picked[i]&&picked[i].id===d.id?'selected':'')+'>'+esc(d.brand+' '+d.model)+'</option>').join('')+'</select></label>';}
html+='</div><label class="planner-check"><input type="checkbox" data-diff '+(onlyDiff?'checked':'')+'> Ch? hi?n th�ng s? da bi?t v� kh�c nhau</label><div class="planner-badges">'+picked.map(d=>'<span class="planner-badge">'+(d.verified?'Da x�c minh':'Chua x�c minh')+'</span>').join('')+'</div>'+picked.map(d=>safeHttpUrl(d.sourceUrl)?'<small class="planner-source">Ngu?n hang: <a href="'+esc(safeHttpUrl(d.sourceUrl))+'" target="_blank" rel="noopener">'+esc(d.brand+' '+d.model)+'</a> � ki?m tra '+esc(d.checkedAt||'Chua c� ng�y')+'</small>':'').join('')+'</div>';
html+='<div class="planner-table-wrap"><table class="planner-table"><thead><tr><th>Y?u t?</th>'+picked.map(d=>'<th>'+esc(d.brand+' '+d.model)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><th>'+esc(r.label)+'</th>'+r.values.map(v=>'<td>'+esc(fmt(v,r.unit))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
html+='<div class="planner-card"><h4>Di?m theo m?c d�ch</h4><label>M?c d�ch<select data-purpose>'+options(Object.entries({portrait:'Ch�n dung',travel:'Du l?ch',lowLight:'Thi?u s�ng',video:'Video / vlog',architecture:'Ki?n tr�c',sports:'Th? thao / d?ng v?t',editing:'H?u k?'}),'portrait')+'</select></label><div class="planner-score-grid">'+picked.map(d=>{const s=deviceScore(d,'portrait',scoreConfig);return '<article><b>'+esc(d.brand+' '+d.model)+'</b><strong>'+(s.score===null?'Chua d? d? li?u':s.score+'/100')+'</strong><small>'+s.count+' tru?ng s? c� d? li?u</small></article>';}).join('')+'</div><details><summary>C�ch t�nh di?m</summary><p>Chu?n h�a t?ng tru?ng theo min/max v� tr?ng s? trong data/device-scoring.json. Kh�ng c� �t nh?t hai tru?ng s? th� kh�ng ch?m di?m.</p></details></div>';
const custom=all.filter(d=>d.userCreated);html+='<div class="planner-card"><h4>Thi?t b? c?a t�i</h4>'+(custom.length?custom.map(d=>'<p>'+esc(d.brand+' '+d.model)+' <button class="planner-link danger" data-delete-device="'+esc(d.id)+'">X�a</button></p>').join(''):'<p>Chua c� thi?t b? t? th�m.</p>')+'<p class="planner-muted">Khi th�m, nh?p th�ng s? JSON da d?i chi?u nh� s?n xu?t; PhotoLens kh�ng t? x�c minh.</p></div><div class="planner-card"><button class="planner-primary" data-action="ai-devices">AI di?n gi?i d? li?u da nh?p</button><p class="planner-muted">Ch? d�ng th�ng s? dang c� trong b?ng; thi?u d? li?u s? kh�ng du?c t? di?n.</p></div>'+aiPanel('/devices/summary');return html;}
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
function outfitView(){const current=forecast?.current||{};const bg=json('photolens_bg_color','#56736f');const list=outfitOptions({temp:current.temperature_2m,rain:current.precipitation,wind:current.wind_speed_10m,background:bg,style:json('photolens_outfit_style','T? nhi�n')});return '<div class="planner-head"><div><h3>Trang ph?c l�n ?nh</h3><p>Kh�ng suy do�n ngo?i h�nh, v�c d�ng, m�u da, gi?i t�nh hay tu?i.</p></div></div><div class="planner-card planner-row"><label>Phong c�ch<select data-style>'+options([['T? nhi�n','T? nhi�n'],['T?i gi?n','T?i gi?n'],['Di?n ?nh','Di?n ?nh'],['Nang d?ng','Nang d?ng'],['C? di?n','C? di?n']],json('photolens_outfit_style','T? nhi�n'))+'</select></label><label>M�u n?n d? ki?n<input type="color" data-bg value="'+esc(bg)+'"></label><span>'+ (current.temperature_2m==null?'Chua c� d? li?u th?i ti?t':current.temperature_2m+'�C � mua '+(current.precipitation??'-')+' mm � gi� '+(current.wind_speed_10m??'-')+' km/h')+'</span></div><div class="planner-outfit-grid">'+list.map(x=>'<article><h4>'+esc(x.name)+'</h4><p>M�u: '+x.colors.map(c=>'<span class="planner-swatch">'+esc(c)+'</span>').join(' ')+'</p><p>'+esc(x.clothes)+'</p><p>'+esc(x.reason)+'</p><p>Luu y: '+esc(x.caution)+'</p></article>').join('')+'</div>';}
function aiPanel(route){
 if(aiRoute!==route)return '';
 if(aiMessage)return '<div class="planner-card planner-status" role="status">'+esc(aiMessage)+'</div>';
 if(!aiResult)return '';
 const render=(title,text)=>'<article><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p></article>';
 let items=[];
 if(route==='/devices/summary')items=(aiResult.summaries||[]).map(x=>render(x.id,x.summary+' � Ph� h?p: '+x.bestFor+' � Gi?i h?n: '+x.limitations));
 if(route==='/spots/rank')items=(aiResult.ranked||[]).map(x=>{const spot=spots.concat(spotsSeed).find(s=>String(s.id)===x.id);return render(spot?.name||spot?.tags?.name||x.id,x.score+'/100 � '+x.reason);});
 const usage=aiResult.usage;const usageText=showEstimatedCost&&usage?'Token v�o '+usage.inputTokens+' � token ra '+usage.outputTokens+(usage.estimatedCostUsd==null?'':' � chi ph� u?c t�nh '+Number(usage.estimatedCostUsd).toFixed(5)+' USD'):'';
 return '<div class="planner-card"><h4>Di?n gi?i t? AI � ch? d?a tr�n d? li?u da cung c?p</h4><div class="planner-ai-results">'+items.join('')+'</div>'+(usageText?'<small>'+esc(usageText)+'</small>':'')+'</div>';
}
async function callPhotographyAI(route,body){
 const enabled=Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_ai_enabled'})).value:localStorage.getItem('photolens_ai_enabled');
 if(enabled!=='true')throw new Error('AI dang t?t. Hay b?t "D�ng AI" trong C�i d?t AI tru?c.');
 let endpoint=String(import.meta.env.VITE_AI_ENDPOINT||'').trim();
 if(!endpoint){endpoint=Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_worker_url'})).value:localStorage.getItem('photolens_worker_url');}
 if(!endpoint)throw new Error('Chua c?u h�nh URL Cloudflare Worker trong C�i d?t AI.');
 endpoint=String(endpoint).trim();while(endpoint.endsWith('/'))endpoint=endpoint.slice(0,-1);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(endpoint+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.error)throw new Error(data?.error?.message||'Worker tr? HTTP '+response.status+'.');
  return data;
 }catch(error){if(error.name==='AbortError')throw new Error('Worker ph?n h?i qu� 30 gi�y.');throw error;}finally{clearTimeout(timer);}
}
async function runPhotographyAI(action){
 const routeMap={'ai-devices':'/devices/summary','ai-spots':'/spots/rank'},route=routeMap[action];
 if(!route)return;
 aiRoute=route;aiResult=null;aiMessage='Dang g?i d? li?u da ch?n t?i Worker.';render();
 try{
  const deepAnalysis=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_deep_analysis'})).value:localStorage.getItem('photolens_deep_analysis'))==='true';let body={deepAnalysis};
  if(route==='/devices/summary'){
   const ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']).filter(Boolean).slice(0,3);
   body={...body,devices:ids.map(id=>devices().find(d=>d.id===id)).filter(Boolean).map(d=>({id:d.id,brand:d.brand,model:d.model,facts:DEVICE_FIELDS.map(x=>{const value=get(d,x.path);return {label:x.label,value:value!==null&&typeof value==='object'?JSON.stringify(value):value};}).filter(x=>x.value!==null&&x.value!==undefined)}))};
  }else if(route==='/spots/rank'){
   const candidates=spots.concat(spotsSeed.map(s=>({...s,curated:true}))).slice(0,35);
   body={...body,genre,candidates:candidates.map((s,i)=>({id:String(s.id||(s.type?s.type+'-'+s.id:'spot-'+i)),name:s.name||s.tags?.name||'D?a di?m',category:String(s.tags?.tourism||s.tags?.leisure||s.tags?.historic||s.genres?.join(', ')||'Chua c� d? li?u'),distanceKm:null,conditionScore:null,knownNotes:s.note||null}))};

  }
  aiResult=await callPhotographyAI(route,body);aiMessage='';status='AI da tr? k?t qu? d?a tr�n d? li?u hi?n c�.';
 }catch(error){aiMessage=error.message||'Kh�ng g?i du?c AI.';}
 render();
}
function planView(){const plans=repo.list();const edit=plans.find(p=>p.id===editingPlan)||{};return '<div class="planner-head"><div><h3>K? ho?ch bu?i ch?p</h3><p>Luu c?c b? tr�n thi?t b? n�y.</p></div></div><form class="planner-card planner-form" data-form="plan"><input type="hidden" name="id" value="'+esc(edit.id||'')+'"><label>T�n k? ho?ch<input name="title" required value="'+esc(edit.title||'')+'" placeholder="V� d?: Ch�n dung chi?u H? T�y"></label><div class="planner-row"><label>Ng�y<input type="date" name="date" value="'+esc(edit.date||'')+'"></label><label>Th? lo?i<select name="genre">'+options(Object.entries(genres),edit.genre||genre)+'</select></label><label>D?a di?m<input name="location" value="'+esc(edit.location||pickedSpot?.name||place?.label||'')+'"></label></div><label>Thi?t b?<select name="device"><option value="">Chua ch?n</option>'+devices().map(d=>'<option value="'+esc(d.id)+'" '+(edit.device===d.id?'selected':'')+'>'+esc(d.brand+' '+d.model)+'</option>').join('')+'</select></label><label>D? mang theo<input name="gear" value="'+esc(edit.gear||'Di?n tho?i/m�y ?nh, pin, th? nh?, khan lau lens')+'"></label><label>Ghi ch�<textarea name="notes">'+esc(edit.notes||'')+'</textarea></label><button class="planner-primary">'+(edit.id?'C?p nh?t':'Luu k? ho?ch')+'</button><div class="planner-export-actions"><button type="button" class="planner-btn" data-action="export-plans">JSON</button><button type="button" class="planner-btn" data-action="export-pdf">PDF</button><button type="button" class="planner-btn" data-action="export-png">PNG</button></div></form><div class="planner-plan-list">'+(plans.length?plans.map(p=>'<article><div><h4>'+esc(p.title)+'</h4><p>'+esc([p.date,genres[p.genre],p.location].filter(Boolean).join(' � '))+'</p><p>'+esc(p.notes||'')+'</p></div><button class="planner-link" data-edit-plan="'+esc(p.id)+'">S?a</button><button class="planner-link danger" data-delete-plan="'+esc(p.id)+'">X�a</button></article>').join(''):'<div class="planner-empty">Chua luu k? ho?ch.</div>')+'</div>';}
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
    link.addEventListener('error',()=>reject(new Error('Kh�ng t?i du?c giao di?n b?n d?.')),{once:true});
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
      if(version===mapRenderVersion&&statusNode)statusNode.textContent='Dang t?i du?ng ph? v� nhan.';
    });
    map.on('error',()=>{
      mapErrors++;
      if(mapErrors>=2&&version===mapRenderVersion&&statusNode)statusNode.textContent='M?t s? chi ti?t b?n d? chua t?i du?c. Ki?m tra k?t n?i m?ng ho?c m? OpenStreetMap b�n c?nh.';
    });
    map.once('idle',()=>{
      if(version===mapRenderVersion&&statusNode)statusNode.textContent=mapErrors?'B?n d? da m?; m?t s? chi ti?t t?i chua d?y d?.':'B?n d? du?ng ph? da s?n s�ng';
    });
    const locationCoords=[];
    if(myPosition){
      const el=document.createElement('div');
      el.className='planner-my-location-icon';
      el.setAttribute('role','img');
      el.setAttribute('aria-label','V? tr� GPS c?a t�i');
      el.innerHTML='<span aria-hidden="true"></span>';
      new maplibregl.Marker({element:el,anchor:'center'})
        .setLngLat([myPosition.longitude,myPosition.latitude])
        .setPopup(new maplibregl.Popup({offset:18}).setHTML('<strong>V? tr� c?a t�i</strong><br>D? ch�nh x�c kho?ng '+Math.round(myPosition.accuracy||0)+' m'))
        .addTo(map);
      locationCoords.push([myPosition.longitude,myPosition.latitude]);
    }else if(Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)){
      const el=document.createElement('div');
      el.className='planner-search-location-dot';
      el.setAttribute('role','img');
      el.setAttribute('aria-label','V? tr� t�m ki?m');
      new maplibregl.Marker({element:el,anchor:'center'})
        .setLngLat([place.longitude,place.latitude])
        .setPopup(new maplibregl.Popup({offset:14}).setText('V? tr� t�m ki?m'))
        .addTo(map);
      locationCoords.push([place.longitude,place.latitude]);
    }
    const bounds=new maplibregl.LngLatBounds();
    for(const [lon,lat] of locationCoords)bounds.extend([lon,lat]);
    spots.filter(s=>Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))).slice(0,35).forEach(s=>{
      const lat=Number(s.lat),lon=Number(s.lon),name=esc(s.name||s.tags?.name||'D?a di?m');
      const href='https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=16/'+lat+'/'+lon;
      const marker=new maplibregl.Marker({color:'#2484c6'})
        .setLngLat([lon,lat])
        .setPopup(new maplibregl.Popup({offset:24}).setHTML('<strong>'+name+'</strong><br><a href="'+href+'" target="_blank" rel="noopener">M? d?a di?m tr�n OpenStreetMap ?</a>'))
        .addTo(map);
      bounds.extend([lon,lat]);
    });
    if(myPosition)map.setCenter(center);
    else if(!bounds.isEmpty())map.fitBounds(bounds,{padding:48,maxZoom:15});
    const readyTimer=window.setTimeout(()=>{
      if(version===mapRenderVersion&&statusNode&&mapErrors)statusNode.textContent='Kh�ng t?i du?c d?y d? b?n d? du?ng ph?. Hay ki?m tra m?ng ho?c m? OpenStreetMap b�n c?nh.';
    },12000);
    map.once('idle',()=>window.clearTimeout(readyTimer));
    window.setTimeout(()=>{if(version===mapRenderVersion)map.resize();},150);
  }).catch(error=>{
    if(version===mapRenderVersion&&message)message.textContent=(error.message||'Kh�ng t?i du?c b?n d?.')+' Hay m? OpenStreetMap b?ng li�n k?t b�n c?nh.';
  });
}
function render(){
  if(!panel)return;
  if(plannerMapInstance){try{plannerMapInstance.remove();}catch{}plannerMapInstance=null;}
  const version=++mapRenderVersion;
  const content={devices:deviceView,weather:weatherView,spots:spotsView,outfit:outfitView,plans:planView}[tab]();
  panel.innerHTML='<div class="planner-backdrop"><section class="planner-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-title"><header><div><small>PHOTOLENS � LEN K? HO?CH CH?P</small><h2 id="planner-title">Thi?t b? & k? ho?ch ch?p</h2></div><button class="planner-close" data-action="close" aria-label="D�ng">x</button></header><nav role="tablist">'+makeTabs()+'</nav><main>'+content+'</main><footer>Thi?t b? m?u chua x�c minh � T? ki?m tra t�nh tr?ng, quy d?nh ch?p v� an to�n t?i ch?.</footer></section></div>';
  panel.querySelector('[data-action="close"]').onclick=close;
  panel.querySelector('.planner-backdrop').onclick=e=>{if(e.target.classList.contains('planner-backdrop'))close();};
  if(tab==='spots')renderSpotsMap(version);
}
function close(){if(panel)panel.hidden=true;$('#photoPlannerButton')?.setAttribute('aria-expanded','false');}
export async function openPhotographyHub(){if(!panel){panel=document.createElement('div');panel.id='photoPlannerHost';document.body.append(panel);panel.addEventListener('click',click);panel.addEventListener('submit',submit);panel.addEventListener('change',change);panel.addEventListener('input',handleDeviceTypeInput);panel.addEventListener('keydown',handleDeviceTypeKeydown);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.hidden)close();});}showEstimatedCost=(Capacitor.isNativePlatform()?(await Preferences.get({key:'photolens_show_cost'})).value:localStorage.getItem('photolens_show_cost'))==='true';panel.hidden=false;$('#photoPlannerButton')?.setAttribute('aria-expanded','true');render();panel.querySelector('.planner-close')?.focus();}
async function jsonFetch(url,opt={},timeout=12000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const res=await fetch(url,{...opt,signal:ctl.signal});const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.reason||'HTTP '+res.status);return data;}finally{clearTimeout(timer);}}
async function loadForecast(p){const key='photolens_weather_'+p.latitude.toFixed(2)+'_'+p.longitude.toFixed(2);let cache=json(key,null);if(cache&&Date.now()-cache.fetchedAt<20*60*1000){forecast=cache;status='D? li?u da luu g?n d�y.';render();return;}const base={latitude:p.latitude,longitude:p.longitude,timezone:'auto'};const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({...base,current:'temperature_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m',hourly:'temperature_2m,precipitation_probability,cloud_cover,visibility,wind_speed_10m,uv_index',daily:'sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'7'});const aq=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');aq.search=new URLSearchParams({...base,hourly:'pm2_5',forecast_days:'5'});const pair=await Promise.all([jsonFetch(u),jsonFetch(aq).catch(()=>null)]);const air=pair[1]?.hourly,airByTime=new Map((air?.time||[]).map((time,i)=>[time,air.pm2_5?.[i]??null]));forecast={...pair[0],hourly:{...pair[0].hourly,pm2_5:(pair[0].hourly?.time||[]).map(time=>airByTime.get(time)??null)},pm25:air?.pm2_5?.[0]??null,fetchedAt:Date.now(),cached:false};save(key,forecast);status='';render();}
async function findWeather(name){status='Dang t�m d?a di?m v� d? b�o.';render();try{const geo=new URL('https://geocoding-api.open-meteo.com/v1/search');geo.search=new URLSearchParams({name:name,count:'1',language:'vi',format:'json',countryCode:'VN'});const g=await jsonFetch(geo);const x=g.results?.[0];if(!x)throw new Error('Kh�ng t�m th?y d?a di?m.');place={label:[x.name,x.admin1,x.country].filter(Boolean).join(', '),latitude:x.latitude,longitude:x.longitude};await loadForecast(place);}catch(e){status='Kh�ng t?i du?c d? b�o: '+e.message;const key=Number.isFinite(place?.latitude)&&Number.isFinite(place?.longitude)?'photolens_weather_'+place.latitude.toFixed(2)+'_'+place.longitude.toFixed(2):'';const old=key?json(key,null):null;if(old)forecast={...old,cached:true};render();}}
function locate(){if(!navigator.geolocation){status='Thi?t b? kh�ng h? tr? v? tr�. Nh?p th�nh ph? thay th?.';render();return;}status='Dang xin quy?n v? tr�.';render();navigator.geolocation.getCurrentPosition(p=>{const lat=Number(p.coords.latitude.toFixed(2)),lon=Number(p.coords.longitude.toFixed(2));place={label:'V? tr� c?a t�i',latitude:lat,longitude:lon};loadForecast(place).catch(e=>{status='Kh�ng t?i du?c d? b�o: '+e.message;render();});},()=>{status='Kh�ng c� quy?n v? tr�. Nh?p th�nh ph? thay th?.';render();},{timeout:10000,maximumAge:300000});}
function showMyLocation(){
 if(!navigator.geolocation){status='Tr�nh duy?t n�y kh�ng h? tr? d?nh v?. B?n v?n c� th? ch?n th�nh ph? trong m?c Th?i ti?t.';render();return;}
 if(!window.isSecureContext){status='D?nh v? c?n trang HTTPS ho?c localhost.';render();return;}
 status='Dang xin quy?n v? tr� hi?n t?i.';
 render();
 navigator.geolocation.getCurrentPosition(position=>{
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){status='Thi?t b? tr? v? t?a d? kh�ng h?p l?.';render();return;}
  myPosition={latitude,longitude,accuracy:Number.isFinite(accuracy)?accuracy:null};
  status='Da d�nh d?u v? tr� GPS c?a b?n. PhotoLens kh�ng g?i t?a d? n�y t?i AI; b?n d? n?n du?c t?i t? OpenStreetMap.';
  render();
 },error=>{
  const messages={
   1:'B?n chua c?p quy?n v? tr�. Hay cho ph�p Location trong c�i d?t tr�nh duy?t r?i th? l?i.',
   2:'Kh�ng l?y du?c GPS. Hay b?t d?ch v? v? tr� ho?c th? l?i ngo�i tr?i.',
   3:'D?nh v? qu� l�u. Hay th? l?i ho?c ch?n th�nh ph? trong m?c Th?i ti?t.'
  };
  status=messages[error.code]||'Kh�ng x�c d?nh du?c v? tr�. B?n c� th? ch?n th�nh ph? trong m?c Th?i ti?t.';
  render();
 },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
}

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
async function click(e){const typeOption=e.target.closest('[data-device-type-option]');if(typeOption){selectDeviceType(typeOption.dataset.deviceTypeOption);return;}if(e.target.closest('[data-device-type-toggle]')){const search=$('[data-device-type-search]',panel);filterDeviceTypeOptions(search?.value||'');search?.focus();return;}const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;render();if(tab==='weather'&&!forecast&&place?.label==='H� N?i')findWeather('H� N?i');return;}const a=e.target.closest('[data-action]')?.dataset.action;if(['ai-devices','ai-spots'].includes(a)){await runPhotographyAI(a);return;}if(a==='locate')locate();if(a==='show-my-location')showMyLocation();if(a==='find-spots')findSpotsWithFallback();if(a==='change-city'){tab='weather';forecast=null;render();}if(a==='close')close();if(e.target.matches('[data-compare-device]')){const id=e.target.dataset.compareDevice,ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']);while(ids.length<3)ids.push('');let slot=ids.findIndex(value=>!value);if(slot<0)slot=2;ids[slot]=id;save('photolens_compare_devices',ids);status='Da th�m thi?t b? v�o v? tr� '+String.fromCharCode(65+slot)+' trong m�n h�nh so s�nh.';render();return;}if(a==='add-device'){const brand=prompt('Hang thi?t b?:');if(!brand)return;const model=prompt('T�n m�y:');if(!model)return;const all=json('photolens_my_devices_v1',[]);let extra={};const raw=prompt('Th�ng s? da d?i chi?u, d?ng JSON (d? tr?ng n?u chua c�):','');if(raw){try{extra=JSON.parse(raw);if(!extra||typeof extra!=='object'||Array.isArray(extra))throw new Error();}catch{alert('JSON kh�ng h?p l?; thi?t b? chua du?c luu.');return;}}all.push({...extra,id:'mine-'+Date.now(),brand,model,type:'my-device',verified:false,userCreated:true,note:'Th�ng s? do ngu?i d�ng cung c?p; chua x�c minh.'});if(!save('photolens_my_devices_v1',all))alert('Kh�ng luu du?c thi?t b?.');render();}if(e.target.matches('[data-delete-device]')){save('photolens_my_devices_v1',myDevices().filter(d=>d.id!==e.target.dataset.deleteDevice));render();}if(e.target.matches('[data-select-spot]')){pickedSpot=spots.find(s=>s.id===e.target.dataset.selectSpot)||spotsSeed.find(s=>s.id===e.target.dataset.selectSpot);status='Da ch?n d?a di?m cho k? ho?ch.';render();}if(e.target.matches('[data-delete-plan]')){repo.remove(e.target.dataset.deletePlan);render();}if(e.target.matches('[data-edit-plan]')){editingPlan=e.target.dataset.editPlan;tab='plans';render();}if(a==='export-plans')exportPlans();}
async function submit(e){e.preventDefault();const f=e.target,fd=new FormData(f);if(f.dataset.form==='weather'){findWeather(String(fd.get('place')||'').trim());return;}if(f.dataset.form==='device-recommendation'){recommendationPrefs={type:String(fd.get('type')||'all'),purpose:String(fd.get('purpose')||'portrait'),budget:String(fd.get('budget')||''),currentDeviceId:String(fd.get('currentDeviceId')||''),priorities:fd.getAll('priority').map(String)};save('photolens_device_recommendation_v1',recommendationPrefs);render();return;}if(f.dataset.form==='plan'){const p=Object.fromEntries(fd);const saved=repo.save(p);if(!saved){alert('Kh�ng luu du?c k? ho?ch.');return;}editingPlan='';status='Da luu k? ho?ch tr�n thi?t b?.';render();}}
function change(e){if(e.target.matches('[data-device]')){let ids=json('photolens_compare_devices',['huawei-p60-pro','samsung-s21-ultra']);ids[Number(e.target.dataset.device)]=e.target.value||'';save('photolens_compare_devices',ids);render();}if(e.target.matches('[data-diff]')){onlyDiff=e.target.checked;render();}if(e.target.matches('[data-genre]')){genre=e.target.value;render();}if(e.target.matches('[data-purpose]')){const p=e.target.value;const list=devices().filter(d=>json('photolens_compare_devices',[]).includes(d.id));const grid=$('.planner-score-grid');if(grid)grid.innerHTML=list.map(d=>{const s=deviceScore(d,p,scoreConfig);return '<article><b>'+esc(d.brand+' '+d.model)+'</b><strong>'+(s.score===null?'Chua d? d? li?u':s.score+'/100')+'</strong></article>';}).join('');}if(e.target.matches('[data-bg]')){save('photolens_bg_color',e.target.value);tab='outfit';render();}if(e.target.matches('[data-style]')){save('photolens_outfit_style',e.target.value);render();}}
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
   const p=batch[i],card=document.createElement('article'),device=devices().find(d=>d.id===p.device);
   card.style.cssText='box-sizing:border-box;width:760px;padding:40px;background:#0a1017;color:#f3f7fa;font:20px/1.55 Arial,sans-serif;border:2px solid #344656;border-radius:24px;';
   const title=document.createElement('h1');title.textContent=p.title||'K? ho?ch ch?p';title.style.cssText='font-size:34px;margin:0 0 24px;color:#8cefc9';card.append(title);
   const lines=[['Ng�y',p.date],['Th? lo?i',genres[p.genre]||'Chua c� d? li?u'],['D?a di?m',p.location],['Thi?t b?',device?device.brand+' '+device.model:null],['D? mang theo',p.gear],['Ghi ch�',p.notes]];
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

