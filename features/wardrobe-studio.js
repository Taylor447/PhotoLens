import legacyNames from '../data/wardrobe/legacy-preview-names.json';
import {createOutfitState,resolveOutfit,outfitViewSettings} from '../core/wardrobe/outfit-state.js';
import {buildComposeRequest,resolveComposeChoice,COMPOSE_PATH} from '../core/wardrobe/compose-contract.js';
import {downloadFile,shareFile} from '../core/share-file.js';
import templatesData from '../data/wardrobe/garments.json';
import materialData from '../data/wardrobe/materials.json';
import patternData from '../data/wardrobe/patterns.json';
import {Capacitor} from '@capacitor/core';
import {Preferences} from '@capacitor/preferences';
import {renderGarmentThumbnail,renderGlbThumbnail} from './wardrobe/thumbnail.js';
import {createWardrobeRepository,filterGarments,calculateFit,scoreLook,buildSvgLook,safeSvgText,classifyWardrobeAsset,hasSupportedImageHeader,CATEGORIES,STYLES,MEASURE_KEYS,composeRuleOutfit,buildCapsuleLooks,MANNEQUIN_DEFAULTS_CM,MANNEQUIN_PRESETS,normalizeMannequin} from '../core/wardrobe-engine.js';
import {chooseSize,parseSizeRows} from '../core/fit/measurements.js';
import {inspectGarmentGlb} from './wardrobe/studio3d/glb.js';
import {mountWardrobe3D,WARDROBE_LIGHTING} from './wardrobe3d.js';

const templates=templatesData.templates||[],materials=materialData.materials||[],patterns=patternData.patterns||[],repo=createWardrobeRepository();
const outfit=createOutfitState();
let compareIds=[],section='catalog',cameraDistance=450,cameraHeight=135,focalLength=50,useAngleCamera=true,sceneLight='overcast',turntable=false,cloth=true,sceneController=null,filters={query:'',category:'all',style:'all',color:'all',material:'all',pattern:'all',season:'all',weather:'all',favorite:'all',collection:'all'},editing='',message='',flatLay=false,pose='standing',height=170,tint='#9ba5a2',bg='#f2f6f4',measures={},saveMeasures=false,includeOuter=false,queryTimer,cleanScene=null,collectionName='',lookTags='',editingLookId='',dressCode='',anchorId='',capsuleLooks=[],composeController=null,seed=21;
const previewUrls=new Set(),cutoutResults=new WeakMap();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const templatesById = new Map(templates.map(item => [item.id, item]));
const items = () => repo.listItems().map(item => {
 const key = item.id.replace(/^closet-/, '');
 const original = templatesById.get(key);
 if (!original || !item.isTemplate) return item;
 const legacy = Array.from(item.name, c => c.codePointAt(0).toString(16)).join('-');
 return {...item, assets: item.assets || original.assets, name: legacyNames[key] === legacy ? original.name : item.name};
});
const available=()=>{
 const closet=items(),ids=new Set(closet.map(item=>item.id));
 return [...closet,...templates.filter(x=>!ids.has('closet-'+x.id)).map(x=>({...x,isTemplate:true,color:'#647d69',colorFamily:'green'}))];
};
const chosen=()=>resolveOutfit(items(),outfit.value);
const isLocked=id=>outfit.value.lockedIds.includes(id);
const viewSettings=()=>outfitViewSettings({background:bg,mannequinTone:tint,pose,flatLay});
const effectiveMannequin=()=>normalizeMannequin({...MANNEQUIN_DEFAULTS_CM,...measures,heightCm:height});
const family=color=>{const s=String(color||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(s))return'custom';const r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<26)return'neutral';if(r>g*1.2&&r>b*1.2)return'warm';if(b>r*1.13&&b>g*1.07)return'blue';if(g>r*1.1&&g>b*1.03)return'green';if(r>g*1.16&&b>g*1.06)return'purple';if(r>g*1.2)return'red';return'custom';};
const opts=(data,current)=>Object.entries(data).map(([k,v])=>'<option value="'+k+'" '+(current===k?'selected':'')+'>'+esc(v)+'</option>').join('');
const colorOpts='<option value="all">Mọi màu</option>'+[['neutral','Trung tính'],['blue','Xanh dương'],['green','Xanh lá'],['warm','Tông ấm'],['red','Đỏ'],['purple','Tím'],['custom','Khác']].map(([a,b])=>'<option value="'+a+'">'+b+'</option>').join('');
function thumb(item){return renderGarmentThumbnail(item,{base:import.meta.env?.BASE_URL||'/',categoryLabel:CATEGORIES[item.category]||'trang phục'});}
function card(x){const picked=outfit.value.itemIds.includes(x.isTemplate&&!x.id.startsWith('closet-')?'closet-'+x.id:x.id);return '<article class="ws-item-card" draggable="true" data-ws-draggable="'+esc(x.id)+'">'+thumb(x)+'<b>'+esc(x.name)+'</b><small>'+esc(CATEGORIES[x.category]||x.category)+' · '+(x.isTemplate?'Mẫu tham số':'Tủ đồ cá nhân')+(x.vectorAssetId?' · Có tệp GLB cục bộ':'')+'</small><div class="ws-card-actions"><button class="planner-btn" data-ws-wear="'+esc(x.id)+'">'+(picked?'Đang mặc':'Mặc thử')+'</button><button class="planner-btn" data-ws-fav="'+esc(x.id)+'" aria-pressed="'+Boolean(x.favorite)+'">'+(x.favorite?'★':'☆')+' Yêu thích</button>'+(x.isTemplate?'':'<button class="planner-link" data-ws-edit="'+esc(x.id)+'">Sửa</button><button class="planner-link danger" data-ws-delete="'+esc(x.id)+'">Xóa</button>')+'</div></article>';}
function trackPreview(blob){const url=URL.createObjectURL(blob);previewUrls.add(url);return url;}
function clearPreviews(){for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls.clear();}
async function hydrateLocalPreviews(container){
 const nodes=[...container.querySelectorAll('[data-ws-asset-id]')];
 await Promise.all(nodes.map(async node=>{try{const asset=await repo.getAsset(node.dataset.wsAssetId);if(!asset?.blob||!node.isConnected)return;const url=trackPreview(asset.blob);if(node instanceof HTMLImageElement){node.src=url;node.hidden=false;}else{const img=document.createElement('img');img.src=url;img.alt=node.dataset.wsPreviewAlt||'Ảnh xem trước món đồ';img.loading='lazy';img.decoding='async';node.replaceChildren(img);}}catch{}}));
}
function setLocalPreview(img,blob){
 if(img.dataset.previewUrl){URL.revokeObjectURL(img.dataset.previewUrl);previewUrls.delete(img.dataset.previewUrl);}
 const url=trackPreview(blob);img.dataset.previewUrl=url;img.src=url;img.hidden=false;
}
function showUploadPreview(form,file){
 const img=form?.querySelector('[data-ws-upload-preview]');if(!img)return;
 if(!file){if(img.dataset.previewUrl){URL.revokeObjectURL(img.dataset.previewUrl);previewUrls.delete(img.dataset.previewUrl);}img.hidden=true;img.removeAttribute('src');delete img.dataset.previewUrl;return;}
 setLocalPreview(img,file);
}
function runCutoutInWorker(file,onProgress){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../workers/wardrobe-cutout.worker.js',import.meta.url));
  worker.onmessage=e=>{const d=e.data||{};if(d.type==='progress'){onProgress?.(d.stage);return;}if(d.type==='error'){worker.terminate();reject(new Error(d.message||'Không tách được nền.'));return;}if(d.type==='mask'){worker.terminate();resolve(new Uint8Array(d.mask));}};
  worker.onerror=()=>{worker.terminate();reject(new Error('Không tải được bộ xử lý cục bộ.'));};
  worker.postMessage({type:'cutout',file});
 });
}
async function buildCutoutFile(file,onProgress){
 const alpha=await runCutoutInWorker(file,onProgress),bitmap=await createImageBitmap(file);
 const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Canvas không khả dụng.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();
 const maskCanvas=document.createElement('canvas');maskCanvas.width=320;maskCanvas.height=320;
 const maskCtx=maskCanvas.getContext('2d');const pixels=maskCtx.createImageData(320,320);
 for(let i=0;i<alpha.length&&i<320*320;i++){const j=i*4;pixels.data[j]=255;pixels.data[j+1]=255;pixels.data[j+2]=255;pixels.data[j+3]=alpha[i];}
 maskCtx.putImageData(pixels,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(maskCanvas,0,0,width,height);ctx.globalCompositeOperation='source-over';
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(new Error('Không xuất được PNG.')),'image/png'));
 const cleanName=file.name.replace(/\.[^.]+$/,'')+'-tach-nen.png';return new File([blob],cleanName,{type:'image/png'});
}
function currentWeather(){return studioContext.weather||{};}
let studioContext={};
const ruleContext=()=>({background:bg,temperatureC:currentWeather().temp,precipitationMm:currentWeather().rain,windKmh:currentWeather().wind,genre:studioContext.genre,dressCode,season:filters.season});
const composerOptions=()=>({seed:seed++,weather:currentWeather(),context:ruleContext(),includeOuter,current:chosen(),lockedIds:outfit.value.lockedIds});
function catalogView(){
 const list=filterGarments(available(),filters,currentWeather()),form=items().find(x=>x.id===editing)||{},collections=[...new Set(items().flatMap(x=>x.collections||[]))].sort((a,b)=>a.localeCompare(b,'vi'));
 const collectionOptions=collections.map(x=>'<option value="'+esc(x)+'" '+(filters.collection===x?'selected':'')+'>'+esc(x)+'</option>').join('');
 return '<div class="ws-layout"><section class="ws-main"><div class="ws-toolbar"><label>Tìm kiếm<input type="search" data-ws-query value="'+esc(filters.query)+'" placeholder="Tên, loại, chất liệu, họa tiết, bộ sưu tập"></label><label>Danh mục<select data-ws-filter="category"><option value="all">Mọi danh mục</option>'+opts(CATEGORIES,filters.category)+'</select></label><label>Phong cách<select data-ws-filter="style"><option value="all">Mọi phong cách</option>'+opts(STYLES,filters.style)+'</select></label><label>Màu<select data-ws-filter="color">'+colorOpts.replace('value="'+filters.color+'"','value="'+filters.color+'" selected')+'</select></label><label>Chất liệu<select data-ws-filter="material"><option value="all">Mọi chất liệu</option>'+materials.map(x=>'<option value="'+x.id+'" '+(filters.material===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><label>Họa tiết<select data-ws-filter="pattern"><option value="all">Mọi họa tiết</option>'+patterns.map(x=>'<option value="'+x.id+'" '+(filters.pattern===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><label>Mùa<select data-ws-filter="season"><option value="all">Mọi mùa</option>'+['spring','summer','autumn','winter'].map(x=>'<option value="'+x+'" '+(filters.season===x?'selected':'')+'>'+({spring:'Xuân',summer:'Hè',autumn:'Thu',winter:'Đông'}[x])+'</option>').join('')+'</select></label><label>Thời tiết<select data-ws-filter="weather"><option value="all">Mọi thời tiết</option><option value="current">Theo dự báo hiện có</option><option value="rainy">Có mưa</option><option value="windy">Gió mạnh</option></select></label><label>Bộ sưu tập<select data-ws-filter="collection"><option value="all">Mọi bộ</option>'+collectionOptions+'</select></label><label>Yêu thích<select data-ws-filter="favorite"><option value="all" '+(filters.favorite==='all'?'selected':'')+'>Tất cả</option><option value="favorites" '+(filters.favorite==='favorites'?'selected':'')+'>Chỉ mục yêu thích</option></select></label></div><p class="planner-muted">60 mẫu tham số minh họa · 0 sản phẩm thương mại đã xác minh.</p><div class="ws-card-grid">'+(list.length?list.map(card).join(''):'<p class="planner-empty">Không tìm thấy món phù hợp.</p>')+'</div></section><aside class="ws-side"><h3>Tủ đồ của tôi</h3><p>'+items().length+' món lưu cục bộ</p><details '+(editing?'open':'')+'><summary>'+(editing?'Sửa món đồ':'Thêm món đồ')+'</summary><form class="ws-form" data-ws-form="item"><input type="hidden" name="id" value="'+esc(form.id||'')+'"><label>Tên món<input name="name" required maxlength="100" value="'+esc(form.name||'')+'"></label><label>Danh mục<select name="category">'+opts(CATEGORIES,form.category||'tops')+'</select></label><div class="ws-form-row"><label>Màu<input name="color" type="color" value="'+esc(form.color||'#647d69')+'"></label><label>Họa tiết<select name="patternId">'+patterns.map(x=>'<option value="'+x.id+'" '+(form.patternId===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label></div><label>Chất liệu<select name="materialId"><option value="">Chưa có dữ liệu</option>'+materials.map(x=>'<option value="'+x.id+'" '+(form.materialId===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><label>Phong cách<select name="style"><option value="">Chưa chọn</option>'+opts(STYLES,form.styleTags?.[0])+'</select></label><label>Bộ sưu tập<input name="collections" value="'+esc((form.collections||[]).join(', '))+'" placeholder="Ví dụ: Công sở, đi biển"></label><details><summary>Bảng size (cm)</summary><label>Nguồn số đo<input name="sizeSource" maxlength="200" value="'+esc(form.sizeTable?.[0]?.measurementSource||'')+'" placeholder="Ví dụ: bảng đo đi kèm sản phẩm"></label><label>Mỗi size một dòng, cách cột bằng dấu chấm phẩy<textarea name="sizeRows" rows="3" maxlength="2500" placeholder="M; 42; 98; 80; 102; 62; 79; 37">'+esc((form.sizeTable||[]).map(row=>[row.size,...MEASURE_KEYS.map(key=>row.measurementsCm?.[key]??'')].join('; ')).join('\n'))+'</textarea></label><p class="planner-muted">Thứ tự: size; vai; ngực; eo; hông; dài tay; ống trong; vòng cổ. Có thể để trống cột thiếu số đo.</p></details><label>Ghi chú<textarea name="notes">'+esc(form.notes||'')+'</textarea></label><details><summary>Số đo món đồ (cm, tùy chọn)</summary>'+MEASURE_KEYS.map(k=>'<label>'+esc(({shoulders:'Vai',chest:'Ngực',waist:'Eo',hips:'Hông',sleeve:'Tay áo',inseam:'Ống trong',neck:'Cổ'}[k]))+'<input type="number" name="m_'+k+'" min="1" max="300" step=".1" value="'+esc(form.measurementsCm?.[k]??'')+'" placeholder="Chưa có dữ liệu"></label>').join('')+'</details><label>Ảnh / SVG / GLB của bạn<input data-ws-asset-input type="file" name="asset" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg,.glb"></label><div class="ws-upload-tools"><img data-ws-upload-preview data-ws-asset-id="'+esc(form.imageAssetId||'')+'" '+(form.imageAssetId?'':'hidden')+' alt="Xem trước ảnh món đồ"><button type="button" class="planner-btn" data-ws-cutout disabled>Tách nền trên thiết bị</button></div><p class="planner-muted ws-cutout-status" data-ws-cutout-status>Ảnh giữ nguyên trong máy. Tách nền chạy ở worker trên thiết bị; lần đầu cần mạng để tải runtime và model 4,57 MB. Model chỉ tìm vùng nổi bật chung, bạn cần xem lại kết quả trước khi lưu.</p><button class="planner-primary">'+(editing?'Lưu chỉnh sửa':'Thêm vào tủ đồ')+'</button><button type="button" class="planner-btn" data-ws-cancel>Hủy</button></form></details><details><summary>Xưởng tạo biến thể tham số</summary><form class="ws-form" data-ws-form="builder"><label>Mẫu nền<select name="templateId">'+templates.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label><label>Tên biến thể<input name="name" required></label><label>Màu<input type="color" name="color" value="#647d69"></label><div class="ws-form-row"><label>Cổ<select name="neck"><option value="crew">Tròn</option><option value="v">V</option><option value="square">Vuông</option><option value="high">Cao</option></select></label><label>Tay<select name="sleeve"><option value="short">Ngắn</option><option value="long">Dài</option><option value="sleeveless">Không tay</option><option value="wide">Rộng</option></select></label></div><div class="ws-form-row"><label>Dài<select name="length"><option value="short">Ngắn</option><option value="regular">Vừa</option><option value="long">Dài</option></select></label><label>Rộng<select name="width"><option value="slim">Ôm</option><option value="regular">Vừa</option><option value="wide">Rộng</option></select></label></div><label>Họa tiết<select name="patternId">'+patterns.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label><button class="planner-primary">Tạo biến thể</button><p class="planner-muted">Đây là minh họa đồ họa, không phải rập may.</p></form></details><div class="ws-closet-list">'+items().slice(0,20).map(x=>'<div>'+thumb(x)+'<span>'+esc(x.name)+'</span><button class="planner-btn" data-ws-wear="'+esc(x.id)+'">Mặc</button></div>').join('')+'</div><p class="ws-privacy">Tủ đồ, ảnh và tệp ở trên thiết bị. Không suy đoán ngoại hình, vóc dáng, màu da, giới tính hay tuổi. Ảnh quần áo không gửi lên AI.</p></aside></div>';
}
function fitReadout(item){
  const chosenSize=chooseSize(measures,item.sizeTable);
  const fit=chosenSize.size?{available:true,details:chosenSize.details}:calculateFit(measures,item);
  if(!fit.available)return '<p><b>'+esc(item.name)+'</b> · Chưa có dữ liệu số đo đối chiếu.</p>';
  const label=chosenSize.size?' · size '+esc(chosenSize.size)+' theo bảng đo':'';
  const values=fit.details.map(row=>{
    const amount=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(Math.abs(row.easeCm));
    const difference=row.status==='equal'?'Chênh 0 cm':(row.status==='tight'?'Chật ':'Rộng ')+amount+' cm';
    return '<span class="ws-fit-value" data-fit-status="'+row.status+'">'+difference+' ở '+esc(row.label.toLowerCase())+'</span>';
  }).join('');
  return '<div class="ws-fit-item"><b>'+esc(item.name)+'</b>'+label+'<div>'+values+'</div></div>';
}
function cameraSettings(){
  const angle=studioContext.camera;
  return useAngleCamera&&angle?angle:{distanceCm:cameraDistance,cameraHeightCm:cameraHeight,focalLengthMm:focalLength};
}
function cameraControls(){
  const angle=studioContext.camera, active=cameraSettings(), fixed=useAngleCamera&&Boolean(angle);
  return '<label class="ws-inline-check"><input type="checkbox" data-ws-angle-camera '+(fixed?'checked':'')+(!angle?' disabled':'')+'> Dùng thông số từ Góc chụp</label>'
  +'<label>Tiêu cự tương đương 35 mm<select data-ws-focal '+(fixed?'disabled':'')+'>'+[24,35,50,70,85].map(mm=>'<option value="'+mm+'" '+(active.focalLengthMm===mm?'selected':'')+'>'+mm+' mm</option>').join('')+'</select></label>'
  +'<label>Khoảng cách máy ảnh: <output>'+active.distanceCm+' cm</output><input data-ws-distance type="range" min="140" max="1200" step="10" value="'+active.distanceCm+'" '+(fixed?'disabled':'')+'></label>'
  +'<label>Độ cao máy ảnh: <output>'+active.cameraHeightCm+' cm</output><input data-ws-camera-height type="range" min="60" max="220" step="5" value="'+active.cameraHeightCm+'" '+(fixed?'disabled':'')+'></label>'
  +'<label>Ánh sáng<select data-ws-light>'+Object.entries(WARDROBE_LIGHTING).map(([id,preset])=>'<option value="'+id+'" '+(id===sceneLight?'selected':'')+'>'+esc(preset.label)+'</option>').join('')+'</select></label>'
  +'<label class="ws-inline-check"><input type="checkbox" data-ws-cloth '+(cloth?'checked':'')+'> Chuyển động vải nhẹ</label>';
}
function studioView(is3d){
 const look=chosen(),mannequin=effectiveMannequin(),rules=scoreLook(look,ruleContext()),fit=look.map(fitReadout).join('');

 const closetItems=filterGarments(available(),filters,currentWeather()).slice(0,18);
 const closet='<aside class="ws-side ws-closet-panel"><details class="ws-mobile-closet" open><summary>Kho đồ · '+available().length+' món</summary><div class="ws-closet-content"><div class="ws-toolbar"><label>Tìm món<input type="search" data-ws-query value="'+esc(filters.query)+'" aria-label="Tìm món trong kho"></label><label>Danh mục<select data-ws-filter="category" aria-label="Lọc theo danh mục"><option value="all">Mọi danh mục</option>'+opts(CATEGORIES,filters.category)+'</select></label><label>Phong cách<select data-ws-filter="style" aria-label="Lọc theo phong cách"><option value="all">Mọi phong cách</option>'+opts(STYLES,filters.style)+'</select></label><label>Chất liệu<select data-ws-filter="material" aria-label="Lọc theo chất liệu"><option value="all">Mọi chất liệu</option>'+materials.map(x=>'<option value="'+x.id+'" '+(filters.material===x.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label></div><p class="planner-muted">Chọn hoặc kéo món vào canvas. '+outfit.value.itemIds.length+' món đang mặc.</p><div class="ws-card-grid">'+(closetItems.length?closetItems.map(card).join(''):'<p class="planner-empty">Không tìm thấy món phù hợp.</p>')+'</div></div></details></aside>';
 const selectedHtml=look.map(x=>'<div class="ws-selected-row">'+thumb(x)+'<b>'+esc(x.name)+'</b><input aria-label="Đổi màu '+esc(x.name)+'" '+(isLocked(x.id)?'disabled ':'')+'type="color" data-ws-color="'+esc(x.id)+'" value="'+esc(x.color||'#647d69')+'"><select aria-label="Họa tiết '+esc(x.name)+'" '+(isLocked(x.id)?'disabled ':'')+'data-ws-pattern="'+esc(x.id)+'">'+patterns.map(p=>'<option value="'+p.id+'" '+((x.patternId||'solid')===p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select><button class="planner-btn" data-ws-lock="'+esc(x.id)+'" aria-pressed="'+isLocked(x.id)+'">'+(isLocked(x.id)?'Đã khóa':'Khóa')+'</button><button class="planner-btn" data-ws-layer="up" data-id="'+esc(x.id)+'" aria-label="Đưa '+esc(x.name)+' lên lớp trên">↑ Lớp</button><button class="planner-btn" data-ws-layer="down" data-id="'+esc(x.id)+'" aria-label="Đưa '+esc(x.name)+' xuống lớp dưới">↓ Lớp</button><button class="planner-btn" data-ws-remove="'+esc(x.id)+'">Bỏ</button></div>').join('');
 const stage=is3d?'<div class="ws-three-host" data-ws-three><span>Đang tải Studio 3D…</span></div>':'<div class="ws-svg-host">'+buildSvgLook(look,{background:bg,flatLay,pose,mannequinTone:tint,mannequin})+'</div>';
 return '<div class="ws-layout ws-layout-studio">'+closet+'<section class="ws-main"><div class="ws-stage-toolbar"><p>Chỉnh một bộ đồ, trạng thái dùng chung giữa 2D và 3D.</p><button class="planner-btn" data-ws-flat>'+ (flatLay?'Bật mannequin':'Flat-lay')+'</button><button class="planner-btn" data-ws-pose="standing">Đứng</button><button class="planner-btn" data-ws-pose="lean">Nghiêng</button><button class="planner-btn" data-ws-pose="step">Bước</button><button class="planner-btn" data-ws-pose="sitting">Ngồi</button>'+(is3d?'<button class="planner-btn" data-ws-turntable aria-pressed="'+turntable+'">'+(turntable?'Dừng xoay':'Xoay tự động')+'</button>':'')+'<button class="planner-btn" data-ws-undo '+(!outfit.canUndo?'disabled':'')+'>Hoàn tác</button><button class="planner-btn" data-ws-redo '+(!outfit.canRedo?'disabled':'')+'>Làm lại</button></div><div class="ws-stage" data-ws-drop>'+stage+'</div><h3>Bộ đang phối</h3><div class="ws-selection">'+(selectedHtml||'<p>Chưa chọn món. Mở Kho để thêm.</p>')+'</div></section><aside class="ws-side ws-properties"><h3>Thuộc tính và điểm ăn ảnh</h3><label>Màu nền<input type="color" data-ws-bg value="'+esc(bg)+'"></label><label>Tông mannequin tự chọn<input type="color" data-ws-tone value="'+esc(tint)+'"></label><label>Chiều cao mannequin: <output>'+height+' cm</output><input data-ws-height type="range" min="140" max="210" value="'+height+'"></label>'+(is3d?cameraControls():'')+'<label>Preset tham chiếu<select data-ws-preset><option value="custom">Tùy chỉnh</option>'+MANNEQUIN_PRESETS.map(x=>'<option value="'+x.id+'">'+esc(x.label)+' · cm</option>').join('')+'</select></label><p class="planner-muted">Các giá trị tham chiếu chỉ dựng hình mặc định. Chỉ số đo bạn tự nhập hoặc preset bạn chủ động chọn mới dùng cho fit; không gửi lên AI.</p><div class="ws-measures">'+MEASURE_KEYS.map(k=>{const label=({shoulders:'Vai',chest:'Ngực',waist:'Eo',hips:'Hông',sleeve:'Dài tay',inseam:'Ống trong',neck:'Vòng cổ'}[k]),m=effectiveMannequin(),limits={shoulders:[30,60],chest:[60,150],waist:[45,140],hips:[60,160],sleeve:[40,90],inseam:[55,110],neck:[25,55]}[k];return '<div class="ws-measure-control"><label>'+label+' (cm)<input type="number" data-ws-measure="'+k+'" min="'+limits[0]+'" max="'+limits[1]+'" step=".1" value="'+esc(measures[k]??'')+'" placeholder="Chưa có dữ liệu"></label><label class="ws-measure-range">Hình học mannequin · <output data-ws-output="'+k+'">'+m[k]+' cm</output><input type="range" data-ws-body-range="'+k+'" min="'+limits[0]+'" max="'+limits[1]+'" step=".5" value="'+m[k]+'"></label></div>';}).join('')+'</div><label><input type="checkbox" data-ws-consent '+(saveMeasures?'checked':'')+'> Đồng ý lưu số đo trên thiết bị</label><p class="planner-muted">Ma-nơ-canh trừu tượng màu xám. Số đo lưu cục bộ khi bạn đồng ý; không suy đoán từ ảnh.</p><h4>Fit theo số đo</h4>'+(fit||'<p>Chưa có số đo sản phẩm và cơ thể tương ứng.</p>')+'<label>Dress code<select data-ws-dress-code>'+opts({'':'Tự do',formal:'Trang trọng',office:'Công sở',casual:'Thường ngày',sport:'Thể thao',traditional:'Truyền thống',cosplay:'Cosplay'},dressCode)+'</select></label><details><summary>Điểm ăn ảnh '+rules.score+'/100 · Vì sao điểm này?</summary><ul>'+rules.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+(rules.warnings.map(x=>'<p class="ws-warning">'+esc(x)+'</p>').join(''))+'</details><label><input type="checkbox" data-ws-include-outer '+(includeOuter?'checked':'')+'> Yêu cầu lớp ngoài khi xáo trộn</label><button class="planner-btn" data-ws-random>Ngẫu nhiên có chủ đích</button><button class="planner-btn" data-ws-variation>Biến tấu</button><label>Món chủ đạo<select data-ws-anchor-id><option value="">Chọn món trong bộ đang phối</option>'+look.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===anchorId?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label><button class="planner-btn" data-ws-anchor>Tạo bộ từ món chủ đạo</button><button class="planner-btn" data-ws-capsule>Tủ đồ capsule</button>'+(capsuleLooks.length?'<div class="ws-export">'+capsuleLooks.map((row,i)=>'<button type="button" class="planner-btn" data-ws-capsule-pick="'+i+'" title="'+esc(row.map(x=>x.name).join(', '))+'">Bộ '+(i+1)+' · '+row.length+' món</button>').join('')+'</div>':'')+'<button class="planner-btn" data-ws-ai>AI chọn trong kho</button><label>Tên look<input data-ws-look-name value="'+esc(collectionName)+'" placeholder="Ví dụ: Phố chiều"></label><label>Thẻ look<input data-ws-look-tags value="'+esc(lookTags)+'" placeholder="casual, phố"></label><button class="planner-btn" data-ws-save-look>'+(editingLookId?'Cập nhật Lookbook':'Lưu Lookbook')+'</button>'+(editingLookId?'<button type="button" class="planner-btn" data-ws-new-look>Lưu thành bộ mới</button>':'')+'<div class="ws-export"><button class="planner-btn" data-ws-export="svg">SVG</button><button class="planner-btn" data-ws-export="png">PNG</button><button class="planner-btn" data-ws-export="pdf">PDF</button></div><p class="ws-disclaimer">Mô phỏng tham khảo, không thay thử đồ thật. Fit cần số đo, rập, chất liệu và thông số trang phục.</p></aside></div>';
}
const lookItems=look=>resolveOutfit(items(),look);
const drawingOptions=look=>look?.view||viewSettings();
const lookPreview=look=>buildSvgLook(lookItems(look),drawingOptions(look));
export const listWardrobeLooks=()=>repo.listLooks();
export const wardrobeLooksReady=repo.ready;

function lookbookView(){
 const looks=listWardrobeLooks(),pair=compareIds.map(id=>looks.find(look=>look.id===id)).filter(Boolean);
 const button=(look,action,label)=>'<button type="button" class="planner-btn" data-ws-'+action+'="'+esc(look.id)+'">'+label+'</button>';
 const compare=pair.length===2?'<div class="ws-compare">'+pair.map(look=>'<article><h4>'+esc(look.name)+'</h4>'+lookPreview(look)+'</article>').join('')+'</div>':'';
 const cards=looks.map(look=>'<article class="ws-look-card">'+lookPreview(look)+'<h4>'+esc(look.name)+'</h4><p>'+lookItems(look).length+' món · '+esc((look.tags||[]).join(', '))+'</p><div class="ws-card-actions">'
 +button(look,'load','Mở / sửa')+button(look,'duplicate','Nhân bản')+button(look,'compare',compareIds.includes(look.id)?'Bỏ so sánh':'So sánh')
 +button(look,'plan-look','Gắn vào kế hoạch')+button(look,'png-look','PNG')+button(look,'pdf-look','PDF')
 +button(look,'share','Chia sẻ PNG')+button(look,'delete-look','Xóa')+'</div></article>').join('');
 return '<div class="ws-layout"><section class="ws-main"><h3>Lookbook</h3>'+compare+'<div class="ws-look-grid">'+(cards||'<p class="planner-empty">Chưa có bộ đã lưu.</p>')+'</div></section><aside class="ws-side"><h3>Riêng tư</h3><p>Lookbook, ảnh và số đo ở trên thiết bị. Ảnh và số đo không gửi đến AI phối đồ.</p></aside></div>';
}
export function disposeWardrobeStudio(){composeController?.abort();composeController=null;sceneController?.abort();sceneController=null;if(cleanScene){try{cleanScene();}catch{}cleanScene=null;}clearPreviews();}
export function renderWardrobeStudio(which='catalog',context={}){
 section=which;bg=/^#[0-9a-f]{6}$/i.test(context.background||'')?context.background:bg;
 studioContext={genre:context.genre||'portrait',weather:{temp:context.temperatureC,rain:context.precipitationMm,wind:context.windKmh},camera:context.camera,openStudio:context.openStudio,attachLook:context.attachLook};
 return '<div class="ws-app" data-ws-app data-ws-section="'+esc(section)+'"><div class="planner-status" data-ws-message role="status" aria-live="polite"></div><div data-ws-content></div></div>';
}
function renderHost(app){
 if(!app?.isConnected)return;const content=app.querySelector('[data-ws-content]');if(!content)return;disposeWardrobeStudio();
 const which=app.dataset.wsSection||section;section=which;content.innerHTML=which==='catalog'?catalogView():which==='lookbook'?lookbookView():studioView(which==='studio3d');void hydrateLocalPreviews(content);
 const note=app.querySelector('[data-ws-message]');if(note)note.textContent=message;
 if(which==='studio3d'){
  const stage=content.querySelector('[data-ws-three]'),controller=new AbortController();
  sceneController=controller;
  const stillMounted=()=>!controller.signal.aborted&&stage.isConnected;
  const fallback=text=>{
   if(!stillMounted())return;
   message=text;
   const nav=app.closest('.planner-dialog')?.querySelector('[data-wardrobe-section="studio2d"]');
   if(nav)nav.click();else{app.dataset.wsSection='studio2d';renderHost(app);}
  };
  mountWardrobe3D(stage,{
   items:chosen(),mannequin:effectiveMannequin(),flatLay,pose,mannequinTone:tint,background:bg,
   ...cameraSettings(),sceneLight,turntable,cloth,windKmh:currentWeather().wind,
   source:async id=>(await repo.getAsset(id))?.blob,
   externalSignal:controller.signal,
   onMessage:text=>{if(stillMounted()&&note)note.textContent=text;},
   onFallback:fallback
  }).then(clean=>{if(stillMounted())cleanScene=clean;else clean();})
    .catch(()=>fallback('WebGL2 hoặc bộ dựng 3D không khả dụng. Đã chuyển sang Studio 2D.'));
 }
}
function itemIdFor(item){
 if(!item.isTemplate||item.id.startsWith('closet-'))return item.id;
 const id='closet-'+item.id;
 if(!items().some(row=>row.id===id))repo.saveItem({...item,id,isTemplate:true});
 return id;
}
const applyItems=rows=>outfit.dispatch({type:'replace',itemIds:rows.map(itemIdFor)});
function wear(item,toggle){
 const id=itemIdFor(item);
 if(chosen().some(row=>row.id===id)){
  if(toggle){
   if(isLocked(id))message='Mở khóa món này trước.';
   else outfit.dispatch({type:'remove',id});
  }
  return;
 }
 const order=item.layerOrder??20;
 const at=chosen().findIndex(row=>(row.catalogLayerOrder??0)>order);
 outfit.dispatch({type:'add',id,at:at<0?undefined:at});
}
async function aiCompose(app,button){
 if(composeController)return;
 const ctl=new AbortController();
 composeController=ctl;
 button.disabled=true;
 const note=app.querySelector('[data-ws-message]');
 if(note)note.textContent='Đang tạo gợi ý…';
 const revision=outfit.revision, filterKey=JSON.stringify(filters);
 const pool=filterGarments(available(),{...filters,weather:filters.weather==='all'?'current':filters.weather},currentWeather());
 const options=composerOptions();
 const request=buildComposeRequest(pool,{genre:studioContext.genre,background:bg,weather:currentWeather()});
 const byId=new Map(pool.map(item=>[item.id,item]));
 const result=await resolveComposeChoice({
  request,
  localChoice:()=>ctl.signal.aborted?[]:composeRuleOutfit(pool,options).map(item=>item.id),
  async fetchChoice(body){
   const read=async key=>Capacitor.isNativePlatform()?(await Preferences.get({key})).value:localStorage.getItem(key);
   if(await read('photolens_ai_enabled')!=='true')throw new Error('AI đang tắt.');
   const endpoint=(String(import.meta.env.VITE_AI_ENDPOINT||'').trim()||String(await read('photolens_worker_url')||'')).replace(/\/+$/,'');
   if(!endpoint)throw new Error('Chưa cấu hình Worker.');
   const timer=setTimeout(()=>ctl.abort('timeout'),32000);
   try{
    const response=await fetch(endpoint+COMPOSE_PATH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});
    if(!response.ok)throw new Error('Worker chưa trả được gợi ý hợp lệ.');
    const payload=await response.json();
    const {usage,...choice}=payload;
    return choice;
   }catch(error){
    if(ctl.signal.reason==='timeout')throw new Error('Worker phản hồi quá lâu.');
    throw error;
   }finally{clearTimeout(timer);}
  }
 });
 if(composeController===ctl)composeController=null;
 if(ctl.signal.aborted&&ctl.signal.reason!=='timeout'||!app.isConnected)return;
 button.disabled=false;
 if(revision!==outfit.revision||filterKey!==JSON.stringify(filters))return;
 const rows=result.itemIds.map(id=>byId.get(id)).filter(Boolean);
 if(rows.length)applyItems(rows);
 else if(ctl.signal.reason==='timeout')applyItems(composeRuleOutfit(pool,options));
 message=result.source==='ai'?result.reason:pool.length?'Đã phối theo quy tắc cục bộ. '+result.reason:'Bộ lọc hiện không có món phù hợp.';
 renderHost(app);
}
async function drawLookCanvas(rows,options){
 const svg=buildSvgLook(rows,options);
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=820;canvas.height=900;
  canvas.getContext('2d').drawImage(image,0,0);
  return canvas;
 }finally{URL.revokeObjectURL(url);}
}
async function lookBlob(kind,rows,options){
 if(kind==='svg')return new Blob([buildSvgLook(rows,options)],{type:'image/svg+xml'});
 const canvas=await drawLookCanvas(rows,options);
 if(kind==='png')return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được PNG.')),'image/png'));
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF();
 pdf.addImage(canvas.toDataURL('image/png'),'PNG',20,20,170,185);
 return pdf.output('blob');
}
async function exportLook(kind,look=null,share=false){
 const rows=look?lookItems(look):chosen();
 if(!rows.length)throw new Error('Chưa có món để xuất.');
 const options=look?drawingOptions(look):{...viewSettings(),mannequin:effectiveMannequin()};
 const blob=await lookBlob(kind,rows,options),name='PhotoLens-look.'+kind;
 if(share)return shareFile(blob,name,look?.name||'Lookbook PhotoLens');
 downloadFile(blob,name);
}
function loadLook(look){
 outfit.dispatch({type:'load',outfit:look});
 editingLookId=look.id;collectionName=look.name;lookTags=(look.tags||[]).join(', ');
 if(look.view){
  const view=outfitViewSettings(look.view);
  bg=view.background;tint=view.mannequinTone;pose=view.pose;flatLay=view.flatLay;
  updateBackground(bg);
 }
}
function updateBackground(color){
 bg=color;
 try{localStorage.setItem('photolens_bg_color',JSON.stringify(color));}catch{}
 const picker=document.querySelector('#photoPlannerHost [data-bg]');
 if(picker)picker.value=color;
}
export function openSavedWardrobeLook(id){
 const look=listWardrobeLooks().find(row=>row.id===id);
 if(!look)return false;
 loadLook(look);
 return true;
}
export function mountWardrobeStudio(host){
 const app=host?.matches('[data-ws-app]')?host:host?.querySelector('[data-ws-app]');if(!app||app.dataset.wsMounted)return;app.dataset.wsMounted='true';const redraw=()=>renderHost(app);
 app.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.wsCutout!==undefined){const form=b.closest('form'),input=form?.querySelector('[data-ws-asset-input]'),file=input?.files?.[0],status=form?.querySelector('[data-ws-cutout-status]');if(!form||!file)return;const kind=classifyWardrobeAsset(file.name,file.type,file.size);if(kind!=='image'){if(status)status.textContent='Chỉ tách nền ảnh PNG, JPEG hoặc WebP hợp lệ.';return;}const header=new Uint8Array(await file.slice(0,12).arrayBuffer());if(!hasSupportedImageHeader(header)){if(status)status.textContent='Tệp không khớp định dạng ảnh khai báo.';return;}b.disabled=true;if(status)status.textContent='Đang tải runtime/model hoặc xử lý trên thiết bị…';try{const output=await buildCutoutFile(file,stage=>{if(status)status.textContent=stage==='runtime'?'Đang tải ONNX Runtime Web…':stage==='model'?'Đang tải model tách nền…':'Đang phân tích ảnh ngay trên thiết bị…';});cutoutResults.set(form,output);showUploadPreview(form,output);if(status)status.textContent='Đã tạo PNG nền trong suốt trên thiết bị. Xem trước rồi lưu món đồ.';}catch(err){if(status)status.textContent='Chưa tách được nền: '+String(err?.message||'lỗi không xác định')+'. Ảnh gốc vẫn còn trên thiết bị.';}finally{b.disabled=false;}return;}
  if(d.wsWear){const x=available().find(row=>row.id===d.wsWear);if(x)wear(x,true);redraw();return;}
  if(d.wsRemove){if(isLocked(d.wsRemove))message='Mở khóa món này trước.';else outfit.dispatch({type:'remove',id:d.wsRemove});redraw();return;}
  if(d.wsLock){outfit.dispatch({type:'lock',id:d.wsLock});redraw();return;}
  if(d.wsUndo!==undefined||d.wsRedo!==undefined){outfit.dispatch({type:d.wsUndo!==undefined?'undo':'redo'});redraw();return;}
  if(d.wsLayer){outfit.dispatch({type:'move',id:d.id,delta:d.wsLayer==='up'?1:-1});redraw();return;}
  if(d.wsFav){const x=available().find(row=>row.id===d.wsFav);if(x){const id=itemIdFor(x),item=items().find(row=>row.id===id);if(item)repo.saveItem({...item,favorite:!item.favorite});}redraw();return;}
  if(d.wsEdit){editing=d.wsEdit;app.dataset.wsSection='catalog';redraw();return;}
  if(d.wsDelete){if(isLocked(d.wsDelete))message='Mở khóa món này trước.';else{repo.removeItem(d.wsDelete);outfit.dispatch({type:'remove',id:d.wsDelete});message='Đã xóa món đồ.';}redraw();return;}
  if(d.wsCancel!==undefined){editing='';redraw();return;}
  if(d.wsFlat!==undefined){flatLay=!flatLay;redraw();return;}
  if(d.wsPose){pose=d.wsPose;redraw();return;}
  if(d.wsTurntable!==undefined){turntable=!turntable;redraw();app.querySelector('[data-ws-turntable]')?.focus();return;}
  if(['wsRandom','wsVariation','wsAnchor','wsCapsule','wsCapsulePick'].some(key=>d[key]!==undefined)){
   const pool=filterGarments(available(),{...filters,weather:filters.weather==='all'?'current':filters.weather},currentWeather());
   const options=composerOptions();
   let result;
   if(d.wsCapsule!==undefined){
    capsuleLooks=buildCapsuleLooks(pool,options);
    result=capsuleLooks[0];
   }else if(d.wsCapsulePick!==undefined)result=capsuleLooks[Number(d.wsCapsulePick)];
   else if(d.wsAnchor!==undefined){
    const anchor=chosen().find(item=>item.id===anchorId);
    if(!anchor){message='Chọn một món chủ đạo trong danh sách.';redraw();return;}
    result=composeRuleOutfit(pool,{...options,anchor});
   }else result=composeRuleOutfit(pool,{...options,mode:d.wsVariation!==undefined?'variation':'random'});
   if(result?.length)applyItems(result);
   message=result?.length?(d.wsCapsule!==undefined?'Đã tạo '+capsuleLooks.length+' bộ từ nhóm món dùng chung.':'Đã phối theo quy tắc cục bộ.'):'Chưa có món phù hợp với bộ lọc.';
   redraw();return;
  }
  if(d.wsAi!==undefined){await aiCompose(app,b);return;}
  if(d.wsSaveLook!==undefined||d.wsNewLook!==undefined){
   const name=app.querySelector('[data-ws-look-name]')?.value.trim();
   const tags=String(app.querySelector('[data-ws-look-tags]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
   const saved=repo.saveLook({id:d.wsNewLook!==undefined?undefined:editingLookId,name,tags,...outfit.value,view:viewSettings()});
   if(saved)editingLookId=saved.id;
   collectionName=name||'';lookTags=tags.join(', ');
   message=saved?'Đã lưu bộ phối trên thiết bị.':'Nhập tên và chọn món trước khi lưu.';
   redraw();return;
  }
  if(d.wsLoad){if(openSavedWardrobeLook(d.wsLoad)){if(studioContext.openStudio)studioContext.openStudio('studio2d');else{app.dataset.wsSection='studio2d';redraw();}}return;}
  if(d.wsPlanLook){const look=listWardrobeLooks().find(x=>x.id===d.wsPlanLook);if(look)studioContext.attachLook?.(look);return;}
  if(d.wsDuplicate){repo.duplicateLook(d.wsDuplicate);redraw();return;}
  if(d.wsDeleteLook){repo.removeLook(d.wsDeleteLook);if(editingLookId===d.wsDeleteLook)editingLookId='';message='Đã xóa bộ đã lưu.';redraw();return;}
  if(d.wsCompare){compareIds=compareIds.includes(d.wsCompare)?compareIds.filter(x=>x!==d.wsCompare):[...compareIds,d.wsCompare].slice(-2);message=compareIds.length===2?'Đang so sánh hai bộ.':'Chọn hai bộ để so sánh.';redraw();return;}
  if(d.wsShare||d.wsPngLook||d.wsPdfLook||d.wsExport){
   b.disabled=true;
   const look=listWardrobeLooks().find(x=>x.id===(d.wsShare||d.wsPngLook||d.wsPdfLook));
   try{
    const outcome=await exportLook(d.wsExport||(d.wsPdfLook?'pdf':'png'),look,Boolean(d.wsShare));
    if(d.wsShare&&outcome==='downloaded')app.querySelector('[data-ws-message]').textContent='Đã tải PNG để bạn chia sẻ.';
   }catch(error){app.querySelector('[data-ws-message]').textContent=error?.message||'Không xuất được tệp.';}
   finally{b.disabled=false;}
   return;
  }

 });
 app.addEventListener('input',e=>{
  if(e.target.matches('[data-ws-look-name]'))collectionName=e.target.value;
  if(e.target.matches('[data-ws-look-tags]'))lookTags=e.target.value;
  if(e.target.matches('[data-ws-query]')){filters.query=e.target.value;clearTimeout(queryTimer);const node=e.target,at=node.selectionStart;queryTimer=setTimeout(()=>{redraw();const next=app.querySelector('[data-ws-query]');next?.focus();next?.setSelectionRange(at,at);},120);}
  if(e.target.matches('[data-ws-measure]')){const n=Number(e.target.value);if(n>0&&n<=300)measures[e.target.dataset.wsMeasure]=n;else delete measures[e.target.dataset.wsMeasure];}if(e.target.matches('[data-ws-body-range]')){const k=e.target.dataset.wsBodyRange;measures[k]=Number(e.target.value);const n=app.querySelector('[data-ws-measure="'+k+'"]');if(n)n.value=String(measures[k]);const o=app.querySelector('[data-ws-output="'+k+'"]');if(o)o.textContent=measures[k]+' cm';if(saveMeasures)try{localStorage.setItem('photolens_wardrobe_measurements_v1',JSON.stringify({...measures,heightCm:height}));}catch{}}
  if(e.target.matches('[data-ws-height]')){height=Number(e.target.value)||170;const o=e.target.closest('label')?.querySelector('output');if(o)o.textContent=height+' cm';}
 });
 app.addEventListener('change',async e=>{
  if(e.target.matches('[data-ws-dress-code]')){dressCode=e.target.value;redraw();return;}
  if(e.target.matches('[data-ws-anchor-id]')){anchorId=e.target.value;return;}
  if(e.target.matches('[data-ws-include-outer]')){includeOuter=e.target.checked;return;}
  if(e.target.matches('[data-ws-asset-input]')){const form=e.target.closest('form'),file=e.target.files?.[0],button=form?.querySelector('[data-ws-cutout]'),status=form?.querySelector('[data-ws-cutout-status]');cutoutResults.delete(form);if(button)button.disabled=!file||classifyWardrobeAsset(file.name,file.type,file.size)!=='image';showUploadPreview(form,file&&classifyWardrobeAsset(file.name,file.type,file.size)&&['image','svg'].includes(classifyWardrobeAsset(file.name,file.type,file.size))?file:null);if(status)status.textContent=file?'Ảnh đang ở trên thiết bị. Tách nền là tùy chọn; model chỉ tạo mặt nạ vùng nổi bật để bạn xem lại.':'Ảnh giữ nguyên trong máy. Runtime/model chỉ tải sau khi bạn bấm tách nền; ảnh không được tải lên.';return;}
  if(e.target.matches('[data-ws-filter]')){filters[e.target.dataset.wsFilter]=e.target.value;redraw();return;}
  if(e.target.matches('[data-ws-measure]')){const k=e.target.dataset.wsMeasure,n=Number(e.target.value),limits={shoulders:[30,60],chest:[60,150],waist:[45,140],hips:[60,160],sleeve:[40,90],inseam:[55,110],neck:[25,55]}[k];if(Number.isFinite(n)&&n>=limits[0]&&n<=limits[1])measures[k]=n;else delete measures[k];if(saveMeasures)try{localStorage.setItem('photolens_wardrobe_measurements_v1',JSON.stringify({...measures,heightCm:height}));}catch{}redraw();return;}
  if(e.target.matches('[data-ws-height]')){height=Number(e.target.value)||170;if(saveMeasures)try{localStorage.setItem('photolens_wardrobe_measurements_v1',JSON.stringify({...measures,heightCm:height}));}catch{}redraw();return;}if(e.target.matches('[data-ws-preset]')){const p=MANNEQUIN_PRESETS.find(x=>x.id===e.target.value);if(p){height=p.heightCm;measures={shoulders:p.shoulders,chest:p.chest,waist:p.waist,hips:p.hips,sleeve:p.sleeve,inseam:p.inseam,neck:p.neck};if(saveMeasures)try{localStorage.setItem('photolens_wardrobe_measurements_v1',JSON.stringify({...measures,heightCm:height}));}catch{}message='Đã chọn preset tham chiếu. Có thể chỉnh từng số đo.';redraw();return;}}
  if(e.target.matches('[data-ws-body-range]')){redraw();return;}
  if(e.target.matches('[data-ws-angle-camera]')){useAngleCamera=e.target.checked;redraw();return;}
  if(e.target.matches('[data-ws-light]')){sceneLight=e.target.value;redraw();return;}
  if(e.target.matches('[data-ws-cloth]')){cloth=e.target.checked;redraw();return;}
  if(e.target.matches('[data-ws-focal]')){focalLength=Number(e.target.value)||50;redraw();return;}
  if(e.target.matches('[data-ws-distance]')){cameraDistance=Number(e.target.value)||450;redraw();return;}
  if(e.target.matches('[data-ws-camera-height]')){cameraHeight=Number(e.target.value)||135;redraw();return;}
  if(e.target.matches('[data-ws-bg]')){updateBackground(e.target.value);redraw();return;}
  if(e.target.matches('[data-ws-tone]')){tint=e.target.value;redraw();return;}
  if(e.target.matches('[data-ws-color]')){outfit.dispatch({type:'edit',id:e.target.dataset.wsColor,values:{color:e.target.value}});redraw();return;}
  if(e.target.matches('[data-ws-pattern]')){outfit.dispatch({type:'edit',id:e.target.dataset.wsPattern,values:{patternId:e.target.value}});redraw();return;}
  if(e.target.matches('[data-ws-consent]')){saveMeasures=e.target.checked;if(saveMeasures){try{localStorage.setItem('photolens_wardrobe_measurements_consent','true');localStorage.setItem('photolens_wardrobe_measurements_v1',JSON.stringify({...measures,heightCm:height}));}catch{}}else{try{localStorage.removeItem('photolens_wardrobe_measurements_consent');localStorage.removeItem('photolens_wardrobe_measurements_v1');}catch{}}message=saveMeasures?'Đã lưu số đo trên thiết bị.':'Số đo chỉ tồn tại trong phiên này.';redraw();return;}


 });
 app.addEventListener('dragstart',e=>{const x=e.target.closest('[data-ws-draggable]');if(x&&e.dataTransfer)e.dataTransfer.setData('text/plain',x.dataset.wsDraggable);});
 app.addEventListener('dragover',e=>{if(e.target.closest('[data-ws-drop]'))e.preventDefault();});
 app.addEventListener('drop',e=>{if(!e.target.closest('[data-ws-drop]'))return;e.preventDefault();const item=available().find(x=>x.id===e.dataTransfer?.getData('text/plain'));if(item){wear(item,false);redraw();}});
 app.addEventListener('submit',async e=>{
  const form=e.target.closest('[data-ws-form]');if(!form)return;e.preventDefault();const fd=new FormData(form),v=Object.fromEntries(fd);
  if(form.dataset.wsForm==='builder'){const x=templates.find(y=>y.id===v.templateId);if(!x)return;const saved=repo.saveItem({...x,id:undefined,isTemplate:false,name:v.name,color:v.color,patternId:v.patternId,parameters:{neck:v.neck,sleeve:v.sleeve,length:v.length,width:v.width}});if(saved){wear(saved,false);message='Đã tạo biến thể đồ họa tham số.';}redraw();return;}
  if(form.dataset.wsForm!=='item')return;
  const measuresCm={};for(const k of MEASURE_KEYS){const n=Number(fd.get('m_'+k));if(n>0&&n<=300)measuresCm[k]=n;}
  const existing=items().find(x=>x.id===v.id),input=form.querySelector('[name=asset]');
  let sizeTable;try{sizeTable=parseSizeRows(v.sizeRows,v.sizeSource);}catch(error){message=error.message;app.querySelector('[data-ws-message]').textContent=message;return;}
  let file=cutoutResults.get(form)||input?.files?.[0]||null,assetId=null,generatedPreviewId=null,assetKind=file?classifyWardrobeAsset(file.name,file.type,file.size):null;
  if(file&&!assetKind){message='Tệp không hợp lệ hoặc vượt quá 12 MB. Chỉ nhận PNG/JPEG/WebP, SVG hoặc GLB.';redraw();return;}
  if(file)try{
   if(assetKind==='image'&&!hasSupportedImageHeader(new Uint8Array(await file.slice(0,12).arrayBuffer())))throw new Error('Tệp không khớp định dạng PNG/JPEG/WebP.');
   if(assetKind==='svg'){const safe=safeSvgText(await file.text());if(!safe)throw new Error('SVG không hợp lệ hoặc chứa nội dung bị chặn.');file=new File([safe],file.name,{type:'image/svg+xml'});}
   if(assetKind==='glb')inspectGarmentGlb(await file.arrayBuffer());
   assetId=await repo.saveAsset(file,{name:file.name});
   if(assetKind==='glb')try{const preview=await renderGlbThumbnail(file);generatedPreviewId=await repo.saveAsset(preview,{name:file.name.replace(/\.glb$/i,'-preview.png')});}catch{generatedPreviewId=null;}
  }catch(err){message=String(err?.message||'Không lưu được tệp cục bộ.');app.querySelector('[data-ws-message]').textContent=message;return;}
  const saved=repo.saveItem({id:v.id||undefined,name:v.name,category:v.category,color:v.color,colorFamily:family(v.color),patternId:v.patternId,materialId:v.materialId,styleTags:v.style?[v.style]:[],collections:String(v.collections||'').split(',').map(x=>x.trim()).filter(Boolean),measurementsCm,sizeTable,sizeTableVersion:sizeTable.length?'user-cm-v1':null,notes:v.notes,imageAssetId:assetKind==='image'||assetKind==='svg'?assetId:assetKind==='glb'?(generatedPreviewId||existing?.imageAssetId||null):existing?.imageAssetId||null,vectorAssetId:assetKind==='glb'?assetId:existing?.vectorAssetId||null});
  if(saved){wear(saved,false);editing='';message=assetKind==='glb'&&!generatedPreviewId?'Đã lưu GLB trên thiết bị; máy hiện không dựng được thumbnail, đang dùng minh họa đúng danh mục.':'Đã lưu món đồ trên thiết bị.';}else message='Tên hoặc danh mục chưa hợp lệ.';redraw();
 });
 repo.ready.then(()=>{try{if(localStorage.getItem('photolens_wardrobe_measurements_consent')==='true'){saveMeasures=true;const saved=JSON.parse(localStorage.getItem('photolens_wardrobe_measurements_v1')||'{}');height=normalizeMannequin(saved).heightCm;measures=Object.fromEntries(MEASURE_KEYS.filter(key=>Number.isFinite(saved[key])).map(key=>[key,saved[key]]));}}catch{}renderHost(app);});renderHost(app);
}
