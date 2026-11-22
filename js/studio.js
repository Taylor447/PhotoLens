import '../css/studio.css';

const defaults = () => ({
  exposure:0, contrast:0, highlights:0, shadows:0, whites:0, blacks:0,
  temperature:0, tint:0, saturation:0, vibrance:0,
  hue:0, hslSaturation:0, hslLuminance:0,
  sharpen:0, denoise:0, grain:0, vignette:0,
  cropLeft:0, cropTop:0, cropRight:0, cropBottom:0, aspect:'free',
  rotate:0, straighten:0, flipX:false, flipY:false,
  lutId:'none', lutStrength:100,
  watermarkText:'', watermarkPosition:'bottom-right', watermarkOpacity:75, watermarkSize:24, watermarkRepeat:false,
  brushEnabled:false, brushSize:12, localExposure:0, strokes:[],
  curve:[[0,0],[0.5,0.5],[1,1]]
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deepCopy=x=>JSON.parse(JSON.stringify(x));
const studioIconPaths={
  aperture:'<circle cx="12" cy="12" r="9"/><path d="m14.8 3.5-2.2 5.1 4.9 2.7M20.5 14.8l-5.3-.2-2.7 5M9.2 20.5l2.2-5.1-4.9-2.7M3.5 9.2l5.3.2 2.7-5"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 0 14h-1"/>',
  redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9h-9a7 7 0 0 0 0 14h1"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  upload:'<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  download:'<path d="M12 3v12m0 0 5-5m-5 5-5-5"/><path d="M4 17v3h16v-3"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  rotateLeft:'<path d="M3 8V3m0 5h5"/><path d="M4.5 8a8 8 0 1 1-.5 7"/>',
  rotateRight:'<path d="M21 8V3m0 5h-5"/><path d="M19.5 8a8 8 0 1 0 .5 7"/>',
  flipX:'<path d="M12 3v18M4 7l4 5-4 5M20 7l-4 5 4 5"/>',
  flipY:'<path d="M3 12h18M7 4l5 4 5-4M7 20l5-4 5 4"/>',
  save:'<path d="M5 3h12l4 4v14H3V5a2 2 0 0 1 2-2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  reset:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  brush:'<path d="m14 5 5 5M4 20c4 0 6-2 6-5l8-8a2.1 2.1 0 0 0-3-3l-8 8c-3 0-5 2-5 6v2Z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  wand:'<path d="m15 4 1.5 4.5L21 10l-4.5 1.5L15 16l-1.5-4.5L9 10l4.5-1.5L15 4Z"/><path d="m5 3 .8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8L5 3Zm2 12 .9 2.1L10 18l-2.1.9L7 21l-.9-2.1L4 18l2.1-.9L7 15Z"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4"/>',
  crop:'<path d="M7 3v11a3 3 0 0 0 3 3h11M3 7h11a3 3 0 0 1 3 3v11"/><path d="M3 3h4M17 3h4v4M3 17v4h4M17 21h4v-4"/>',
  favorite:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>'
};
const studioIcon=name=>'<svg class="studio-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(studioIconPaths[name]||studioIconPaths.wand)+'</svg>';
const controlSpecs=[
  ['exposure','Phơi sáng',-4,4,.1,' EV'],['contrast','Tương phản',-100,100,1,''],
  ['highlights','Vùng sáng',-100,100,1,''],['shadows','Vùng tối',-100,100,1,''],
  ['whites','Trắng',-100,100,1,''],['blacks','Đen',-100,100,1,''],
  ['temperature','Nhiệt độ màu',-100,100,1,''],['tint','Sắc độ',-100,100,1,''],
  ['saturation','Bão hòa',-100,100,1,''],['vibrance','Độ rực',-100,100,1,''],
  ['hue','HSL · Sắc độ',-180,180,1,'°'],['hslSaturation','HSL · Bão hòa',-100,100,1,''],
  ['hslLuminance','HSL · Độ sáng',-100,100,1,''],['sharpen','Độ nét',0,100,1,'%'],
  ['denoise','Giảm nhiễu',0,100,1,'%'],['grain','Hạt phim',0,60,1,'%'],
  ['vignette','Tối viền',0,100,1,'%']
];
const lookSpecs=[
  {id:'portrait',name:'Chân dung sáng',category:'Chân dung',description:'Da ấm, tương phản mềm.'},
  {id:'golden',name:'Nắng vàng',category:'Chân dung',description:'Ánh vàng nhẹ và sắc độ dịu.'},
  {id:'landscape',name:'Phong cảnh',category:'Phong cảnh',description:'Tăng màu xanh và độ sâu.'},
  {id:'street',name:'Đường phố',category:'Đường phố',description:'Tương phản rõ, bóng hơi lạnh.'},
  {id:'film',name:'Phim hoài niệm',category:'Phim',description:'Bóng nâng nhẹ, màu ấm.'},
  {id:'cinema',name:'Điện ảnh teal-orange',category:'Điện ảnh',description:'Bóng xanh ngọc, vùng sáng ấm.'},
  {id:'mono',name:'Đen trắng',category:'Đen trắng',description:'Đơn sắc với tương phản mềm.'}
];
function makeLookLut(id,size=17){
  const data=new Float32Array(size*size*size*3);
  let p=0;
  for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++){
    let R=r/(size-1),G=g/(size-1),B=b/(size-1);
    if(id==='portrait'){R=Math.min(1,R*1.025+.008);G=Math.min(1,G*1.005);B=Math.max(0,B*.965);}
    if(id==='golden'){R=Math.min(1,R*1.06+.018);G=Math.min(1,G*1.02+.008);B=Math.max(0,B*.91);}
    if(id==='landscape'){R=Math.min(1,R*1.02);G=Math.min(1,G*1.07);B=Math.min(1,B*1.09); }
    if(id==='street'){R=(R-.5)*1.12+.5;G=(G-.5)*1.12+.5;B=Math.min(1,B*1.04+.012);}
    if(id==='film'){R=Math.min(1,R*1.045+.012);G=Math.min(1,G*1.01+.006);B=Math.min(1,B*1.01+.014);R=R*.94+.03;G=G*.96+.02;B=B*.98+.01;}
    if(id==='cinema'){const y=.2126*R+.7152*G+.0722*B;R=Math.min(1,R+(y-.5)*.05);G=Math.min(1,G+(y-.5)*.035);B=Math.max(0,B+(0.5-y)*.09);}
    if(id==='mono'){const y=.2126*R+.7152*G+.0722*B;R=G=B=(y-.5)*1.08+.5;}
    data[p++]=clamp(R,0,1);data[p++]=clamp(G,0,1);data[p++]=clamp(B,0,1);
  }
  return {size,data};
}
function parseCube(text,name){
  if(text.length>3*1024*1024)throw new Error('Tệp LUT vượt giới hạn 3 MB.');
  let size=0,min=[0,0,0],max=[1,1,1];const values=[];
  for(const raw of text.split(/\r?\n/)){
    const line=raw.replace(/#.*/,'').trim();if(!line)continue;
    const parts=line.split(/\s+/),key=parts[0].toUpperCase();
    if(key==='TITLE')continue;
    if(key==='LUT_1D_SIZE')throw new Error('LUT 1D chưa được hỗ trợ. Hãy chọn LUT_3D_SIZE.');
    if(key==='LUT_3D_SIZE'){size=Number(parts[1]);if(!Number.isInteger(size)||size<2||size>64)throw new Error('Kích thước LUT phải từ 2 đến 64.');continue;}
    if(key==='DOMAIN_MIN'||key==='DOMAIN_MAX'){
      const v=parts.slice(1).map(Number);if(v.length!==3||v.some(n=>!Number.isFinite(n)))throw new Error('Miền màu trong LUT không hợp lệ.');
      if(key==='DOMAIN_MIN')min=v;else max=v;continue;
    }
    if(parts.length>=3&&parts.slice(0,3).every(x=>Number.isFinite(Number(x)))){
      const v=parts.slice(0,3).map(Number);values.push(v);
    }
  }
  if(!size||values.length!==size*size*size)throw new Error('Số điểm màu trong tệp không khớp LUT_3D_SIZE.');
  const table=new Float32Array(values.length*3);
  for(let i=0;i<values.length;i++)for(let c=0;c<3;c++){
    const span=max[c]-min[c];table[i*3+c]=span?clamp((values[i][c]-min[c])/span,0,1):values[i][c];
  }
  return {id:'custom:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:name.replace(/\.cube$/i,''),category:'Của tôi',description:'LUT 3D được nhập từ tệp .cube.',size,data:table};
}
let dbPromise;
function openDb(){
  if(!('indexedDB'in window))return Promise.reject(new Error('Trình duyệt không hỗ trợ lưu dự án cục bộ.'));
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('photolens-studio',1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});if(!db.objectStoreNames.contains('luts'))db.createObjectStore('luts',{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Không mở được kho cục bộ.'));
  });
  return dbPromise;
}
async function dbAction(store,mode,action,value){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode),os=tx.objectStore(store);let req;
    try{req=action==='getAll'?os.getAll():action==='get'?os.get(value):action==='delete'?os.delete(value):os.put(value);}
    catch(error){reject(error);return;}
    tx.oncomplete=()=>resolve(req&&req.result);tx.onerror=()=>reject(tx.error||new Error('Không lưu được dữ liệu.'));
    tx.onabort=()=>reject(tx.error||new Error('Đã hủy thao tác lưu.'));
  });
}
function rangeControl(spec){
  const [key,label,min,max,step,suffix]=spec;
  return '<label class="studio-range"><span>'+label+'</span><output data-output="'+key+'">0'+suffix+'</output><input type="range" data-adjust="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="0" /></label>';
}
function formatValue(key,value,suffix){
  const n=Number(value);return (key==='exposure'?n.toFixed(1):String(Math.round(n)))+suffix;
}
function curveTable(points){
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]),out=new Uint8Array(256);
  for(let i=0;i<256;i++){
    const x=i/255;let a=sorted[0],b=sorted[sorted.length-1];
    for(let j=0;j<sorted.length-1;j++)if(x>=sorted[j][0]&&x<=sorted[j+1][0]){a=sorted[j];b=sorted[j+1];break;}
    const t=(x-a[0])/Math.max(.0001,b[0]-a[0]);out[i]=Math.round(clamp((a[1]+(b[1]-a[1])*t)*255,0,255));
  }
  return out;
}
export function openStudio(options={}){
  const existing=document.getElementById('photoStudio');if(existing)return;
  const cfg=options||{};
  const root=document.createElement('div');
  root.id='photoStudio';root.className='photo-studio';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','PhotoLens Studio');
  const ranges=controlSpecs.map(rangeControl).join('');
  root.innerHTML=[
    '<header class="studio-header"><div class="studio-brand"><strong>PhotoLens Studio</strong><span>Chỉnh sửa cục bộ · không tải ảnh lên</span></div>',
    '<nav class="studio-tabs" aria-label="Công cụ"><button class="active" data-studio-view="editor">Chỉnh sửa</button><button data-studio-view="luts">LUT &amp; màu</button></nav>',
    '<div class="studio-header-actions"><button class="studio-icon-btn" id="studioUndo" title="Hoàn tác" aria-label="Hoàn tác">↶</button><button class="studio-icon-btn" id="studioRedo" title="Làm lại" aria-label="Làm lại">↷</button><button class="studio-close" id="studioClose" aria-label="Đóng">×</button></div></header>',
    '<main class="studio-content">',
    '<section class="studio-page studio-editor-page" data-studio-page="editor"><div class="studio-editor-layout">',
    '<div class="studio-preview-panel"><div class="studio-stage" id="studioStage"><canvas id="studioCanvas" aria-label="Xem trước ảnh đã chỉnh sửa"></canvas><div class="studio-crop-overlay" id="studioCropOverlay" hidden><span class="studio-crop-tip" id="studioCropTip">Kéo trên ảnh để chọn vùng cắt</span><div class="studio-crop-box" id="studioCropBox" hidden><i data-edge="nw"></i><i data-edge="n"></i><i data-edge="ne"></i><i data-edge="e"></i><i data-edge="se"></i><i data-edge="s"></i><i data-edge="sw"></i><i data-edge="w"></i></div></div><div class="studio-empty" id="studioEmpty"><div class="studio-empty-icon">✦</div><strong>Mở ảnh để bắt đầu chỉnh sửa</strong><p>Chọn JPG, PNG, WebP, AVIF hoặc HEIC/HEIF.</p><button class="studio-action" id="studioChooseFile">Chọn ảnh</button></div></div>',
    '<div class="studio-preview-toolbar"><button class="studio-action" id="studioOpenFile">Mở ảnh</button><input id="studioFile" class="studio-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif" aria-label="Chọn ảnh để chỉnh sửa" /><button class="studio-action" id="studioBefore">Giữ để xem ảnh gốc</button><span class="studio-file-name" id="studioFileName" aria-live="polite">Chưa chọn ảnh</span></div>',
    '<div class="studio-exportbar"><label>Định dạng <select id="studioFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label><label>Kích thước <select id="studioSize"><option value="0">Tối đa theo thiết bị</option><option value="4096">4096 px</option><option value="2048">2048 px</option><option value="1080">1080 px</option></select></label><label class="studio-quality-label">Chất lượng <input id="studioQuality" type="range" min="50" max="100" value="92" /><output id="studioQualityValue">92%</output></label><label class="studio-check"><input id="studioKeepMetadata" type="checkbox" /> Giữ EXIF (JPG gốc)</label><button class="studio-primary" id="studioExport">Xuất ảnh</button><button class="studio-action" id="studioApply">Dùng ảnh đã chỉnh</button><label>Chia sẻ<select id="studioShareMode"><option value="edited">Ảnh đã chỉnh</option><option value="before-after">Trước / sau</option></select></label><button class="studio-action" id="studioShare">Chia sẻ</button></div>',
    '</div>',
    '<aside class="studio-sidebar"><div class="studio-editor-hint" id="studioEditorHint"><strong>Chưa có ảnh để chỉnh sửa</strong><span>Mở ảnh trước, các công cụ sẽ bật và xem trước thay đổi tại đây.</span><button class="studio-action" id="studioHintOpen" type="button">Chọn ảnh</button></div>',
    '<div class="studio-side-tools"><button class="studio-action" id="studioSaveProject">Lưu dự án</button><button class="studio-action" id="studioOpenProject">Dự án đã lưu</button><button class="studio-action" id="studioReset">Đặt lại</button></div>',
    '<details class="studio-section" open><summary>Cắt, xoay &amp; cân chỉnh</summary><div class="studio-section-body">',
    '<button class="studio-action studio-crop-gesture" id="studioCropGesture" type="button" title="Bật rồi kéo trực tiếp trên ảnh để cắt">Vuốt để cắt trên ảnh</button><p class="studio-help">Bấm nút, kéo để chọn vùng; thả tay để áp dụng. Có thể hoàn tác.</p>',
    '<label class="studio-select-row">Tỉ lệ khung hình<select id="studioAspect"><option value="free">Tự do</option><option value="1:1">1:1 · Vuông</option><option value="4:3">4:3</option><option value="3:2">3:2</option><option value="16:9">16:9</option><option value="9:16">9:16 · Dọc</option></select></label>',
    '<div class="studio-transform-row"><button class="studio-action" id="studioRotateLeft" title="Xoay trái 90°">↶ Xoay trái</button><button class="studio-action" id="studioRotateRight" title="Xoay phải 90°">↷ Xoay phải</button><button class="studio-action" id="studioFlipX">Lật ngang</button><button class="studio-action" id="studioFlipY">Lật dọc</button></div>',
    '<label class="studio-range"><span>Cắt trái</span><output data-output="cropLeft">0%</output><input type="range" data-adjust="cropLeft" min="0" max="90" value="0" /></label>',
    '<label class="studio-range"><span>Cắt trên</span><output data-output="cropTop">0%</output><input type="range" data-adjust="cropTop" min="0" max="90" value="0" /></label>',
    '<label class="studio-range"><span>Cắt phải</span><output data-output="cropRight">0%</output><input type="range" data-adjust="cropRight" min="0" max="90" value="0" /></label>',
    '<label class="studio-range"><span>Cắt dưới</span><output data-output="cropBottom">0%</output><input type="range" data-adjust="cropBottom" min="0" max="90" value="0" /></label>',
    '<label class="studio-range"><span>Cân thẳng</span><output data-output="straighten">0°</output><input type="range" data-adjust="straighten" min="-15" max="15" step="0.1" value="0" /></label>',
    '</div></details>',
    '<details class="studio-section" open><summary>Ánh sáng &amp; màu</summary><div class="studio-section-body">'+ranges+'</div></details>',
    '<details class="studio-section"><summary>Đường cong tông màu</summary><div class="studio-section-body"><p class="studio-help">Kéo điểm trên đường cong để tinh chỉnh sáng và tương phản.</p><canvas id="studioCurve" width="256" height="150" aria-label="Đường cong tông màu"></canvas><button class="studio-action" id="studioResetCurve">Đặt lại đường cong</button></div></details>',
    '<details class="studio-section"><summary>Chỉnh sửa cục bộ</summary><div class="studio-section-body"><button class="studio-action" id="studioBrush">Cọ vùng sáng</button><p class="studio-help">Bật cọ rồi tô lên ảnh để áp dụng chỉnh sáng cục bộ.</p><label class="studio-range"><span>Kích thước cọ</span><output data-output="brushSize">12%</output><input type="range" data-adjust="brushSize" min="2" max="40" value="12" /></label><label class="studio-range"><span>Phơi sáng vùng tô</span><output data-output="localExposure">0</output><input type="range" data-adjust="localExposure" min="-100" max="100" value="0" /></label><button class="studio-action" id="studioClearBrush">Xóa vùng tô</button></div></details>',
    '<details class="studio-section"><summary>Dấu chìm</summary><div class="studio-section-body">'+
    '<label class="studio-select-row">Chữ dấu chìm<input id="studioWatermarkText" type="text" maxlength="60" placeholder="Tên hoặc thương hiệu" /></label>'+
    '<div class="studio-watermark-logo"><button class="studio-action" id="studioWatermarkLogoBtn" type="button">Thêm logo PNG</button><input id="studioWatermarkLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden /><span id="studioWatermarkLogoName">Chưa chọn logo</span><button class="studio-action" id="studioWatermarkLogoRemove" type="button" hidden>Xóa logo</button></div>'+
    '<label class="studio-select-row">Vị trí<select id="studioWatermarkPosition"><option value="top-left">Trên trái</option><option value="top-center">Trên giữa</option><option value="top-right">Trên phải</option><option value="middle-left">Giữa trái</option><option value="center">Chính giữa</option><option value="middle-right">Giữa phải</option><option value="bottom-left">Dưới trái</option><option value="bottom-center">Dưới giữa</option><option value="bottom-right">Dưới phải</option></select></label>'+
    '<label class="studio-range"><span>Độ mờ</span><output id="studioWatermarkOpacityValue">75%</output><input id="studioWatermarkOpacity" type="range" min="5" max="100" value="75" /></label>'+
    '<label class="studio-range"><span>Kích thước</span><output id="studioWatermarkSizeValue">24</output><input id="studioWatermarkSize" type="range" min="10" max="40" value="24" /></label>'+
    '<label class="studio-check"><input id="studioWatermarkRepeat" type="checkbox" /> Lặp dấu chìm khắp ảnh</label>'+
    '<button class="studio-action" id="studioDetectWatermark" type="button">Nhận diện dấu chìm hãng bằng AI</button><div class="studio-watermark-results" id="studioWatermarkResults" role="status" aria-live="polite"></div>'+
    '<p class="studio-help">Tạo dấu chìm và xuất ảnh ngay trên thiết bị. Nhận diện AI chỉ gửi JPEG tối đa 1024 px sau khi bạn xác nhận.</p></div></details>',
    '</aside>',
    '<div class="studio-lut-drawer" id="studioLutDrawer" role="dialog" aria-label="Kho LUT màu" hidden><div class="studio-lut-drawer-head"><div><h2>Kho LUT màu</h2><p>Chọn màu, chỉnh cường độ hoặc nhập LUT 3D .cube.</p></div><button class="studio-icon-btn" id="studioLutClose" type="button" aria-label="Đóng kho LUT">×</button></div><div class="studio-lut-tools"><input type="search" id="studioLutSearch" placeholder="Tìm LUT…" aria-label="Tìm LUT" /><select id="studioLutCategory" aria-label="Lọc theo danh mục"><option value="">Tất cả nhóm</option><option>Chân dung</option><option>Phong cảnh</option><option>Đường phố</option><option>Phim</option><option>Điện ảnh</option><option>Đen trắng</option><option>Của tôi</option></select><button class="studio-action" id="studioImportLut">Nhập .cube</button><input type="file" id="studioLutFile" accept=".cube,text/plain" hidden /></div><label class="studio-range studio-lut-strength"><span>Cường độ LUT</span><output id="studioLutStrengthValue">100%</output><input type="range" id="studioLutStrength" min="0" max="100" value="100" /></label><div class="studio-lut-grid" id="studioLutGrid"></div></div></div></section>',
    '<section class="studio-page studio-camera-page" data-studio-page="camera" hidden><div class="studio-camera-layout"><div class="studio-camera-main"><div class="studio-camera-stage" id="studioCameraStage"><video id="studioVideo" autoplay muted playsinline></video><div class="studio-camera-grid" id="studioCameraGrid" hidden><i></i><i></i></div><button class="studio-focus-target" id="studioFocusTarget" aria-label="Lấy nét tại điểm chạm" hidden></button><div class="studio-camera-empty" id="studioCameraEmpty"><strong>Camera chưa bật</strong><p>Quyền camera chỉ được yêu cầu khi bạn mở chế độ chụp.</p><button class="studio-primary" id="studioStartCamera">Bật camera</button><button class="studio-action" id="studioCameraChoose">Chọn ảnh thay thế</button></div></div><div class="studio-camera-actions"><label>Hẹn giờ<select id="studioTimer"><option value="0">Tắt</option><option value="3">3 giây</option><option value="10">10 giây</option></select></label><label>Tỉ lệ<select id="studioCameraAspect"><option value="4:3">4:3</option><option value="16:9">16:9</option><option value="1:1">1:1</option></select></label><button class="studio-primary" id="studioCapture" disabled>Chụp ảnh</button></div></div><aside class="studio-camera-sidebar"><h2>Camera</h2><label class="studio-select-row">Thiết bị<select id="studioCameraDevice"><option value="">Mặc định</option></select></label><label class="studio-select-row">Độ phân giải<select id="studioCameraResolution"><option value="1920x1080">Cao · 1080p</option><option value="1280x720">Vừa · 720p</option><option value="640x480">Nhẹ · 480p</option></select></label><label class="studio-check"><input type="checkbox" id="studioGridToggle" /> Lưới 1/3</label><div id="studioCameraAdvanced" class="studio-camera-advanced"></div><p id="studioCameraStatus" class="studio-help" role="status">Các điều khiển thủ công chỉ xuất hiện nếu camera và trình duyệt hỗ trợ.</p><button class="studio-action" id="studioNativeCapture" hidden>Mở camera thiết bị</button></aside></div></section>',
    '</main><div class="studio-modal-layer" id="studioModalLayer" hidden></div><div class="studio-toast" id="studioToast" role="status" aria-live="polite"></div></div>'
  ].join('');
  document.body.append(root);
  const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const q=s=>root.querySelector(s),qa=s=>Array.from(root.querySelectorAll(s));
  const setIconButton=(button,name,label='')=>{if(!button)return;button.innerHTML=studioIcon(name)+(label?'<span class="studio-button-label">'+label+'</span>':'');};
  const setStudioButtonLabel=(button,label)=>{const node=button?.querySelector('.studio-button-label');if(node)node.textContent=label;else if(button)button.textContent=label;};
  const iconBindings=[
    ['#studioUndo','undo'],['#studioRedo','redo'],['#studioClose','close'],['#studioCropGesture','crop','Vuốt để cắt trên ảnh'],['#studioLutClose','close'],
    ['#studioChooseFile','upload','Chọn ảnh'],['#studioOpenFile','folder','Mở ảnh'],
    ['#studioBefore','eye','Giữ để xem ảnh gốc'],['#studioExport','download','Xuất ảnh'],
    ['#studioApply','check','Dùng ảnh đã chỉnh'],['#studioShare','share','Chia sẻ'],
    ['#studioSaveProject','save','Lưu dự án'],['#studioOpenProject','folder','Dự án đã lưu'],
    ['#studioReset','reset','Đặt lại'],['#studioRotateLeft','rotateLeft','Xoay trái'],
    ['#studioRotateRight','rotateRight','Xoay phải'],['#studioFlipX','flipX','Lật ngang'],
    ['#studioFlipY','flipY','Lật dọc'],['#studioBrush','brush','Cọ vùng sáng'],
    ['#studioClearBrush','trash','Xóa vùng tô'],['#studioResetCurve','reset','Đặt lại đường cong'],['#studioWatermarkLogoBtn','upload','Thêm logo PNG'],
    ['#studioWatermarkLogoRemove','trash','Xóa logo'],['#studioDetectWatermark','wand','Nhận diện dấu chìm'],
    ['#studioImportLut','upload','Nhập .cube']
  ];
  const brandMark=document.createElement('span');brandMark.className='studio-brand-mark';brandMark.innerHTML=studioIcon('aperture');q('.studio-brand').prepend(brandMark);
  iconBindings.forEach(([selector,name,label])=>setIconButton(q(selector),name,label));
  const emptyIcon=q('.studio-empty-icon');if(emptyIcon)emptyIcon.innerHTML=studioIcon('image');
  qa('.studio-section summary').forEach((summary,index)=>summary.insertAdjacentHTML('afterbegin',studioIcon(['image','wand','share','brush','aperture'][index]||'wand')));


  let file=null,image=null,imageUrl='',activeLut=null,customLuts=[],worker=null,mediaStream=null,track=null,watermarkLogoBlob=null,watermarkLogoImage=null,watermarkLogoUrl='';
  let state=defaults(),undoStack=[],redoStack=[],lastCommitted='',renderTicket=0,renderTimer=0,showOriginal=false,stageImageRect=null,brushStroke=null,curvePoint=-1,cropMode=false,cropSelection=null,cropGesture=null;
  const pending=new Map();let requestId=0,closed=false,activeView='editor',previewTimer=0,dbReady=null;
  const lutMap=new Map(lookSpecs.map(s=>[s.id,{...s,...makeLookLut(s.id)}]));
  try{worker=new Worker(new URL('./studio.worker.js',import.meta.url),{type:'module'});worker.onmessage=e=>{const item=pending.get(e.data.id);if(!item)return;pending.delete(e.data.id);e.data.error?item.reject(new Error(e.data.error)):item.resolve(new Uint8ClampedArray(e.data.buffer));};worker.onerror=e=>{e.preventDefault();worker.terminate();worker=null;for(const p of pending.values())p.reject(new Error('Bộ xử lý nền không khả dụng.'));pending.clear();};}catch{worker=null;}
  const outputCap=maxOutputSide();
  q('#studioSize').options[0].textContent='Tối đa theo thiết bị ('+outputCap+' px)';
  Array.from(q('#studioSize').options).forEach(option=>{if(Number(option.value)>outputCap&&option.value!=='0')option.disabled=true;});
  const toast=message=>{const node=q('#studioToast');node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),3200);};
  q('#studioHintOpen').addEventListener('click',openPhotoPicker);
  if(!worker)setTimeout(()=>toast('Ảnh sẽ được xử lý trực tiếp ở chế độ tương thích; kích thước xuất được giới hạn để giữ giao diện phản hồi.'),0);
  function snapshot(){return JSON.stringify(state);}
  function commit(){
    const next=snapshot();if(lastCommitted&&next!==lastCommitted){undoStack.push(lastCommitted);if(undoStack.length>60)undoStack.shift();redoStack=[];}
    lastCommitted=next;updateHistoryButtons();saveDraft().catch(()=>{});
  }
  function updateHistoryButtons(){q('#studioUndo').disabled=!undoStack.length;q('#studioRedo').disabled=!redoStack.length;}
  function syncImageAvailability(){
    const ready=Boolean(image);
    ['studioBefore','studioExport','studioApply','studioShare','studioSaveProject','studioReset','studioBrush','studioClearBrush','studioCropGesture','studioDetectWatermark','studioRotateLeft','studioRotateRight','studioFlipX','studioFlipY','studioAspect','studioResetCurve','studioWatermarkText','studioWatermarkPosition','studioWatermarkOpacity','studioWatermarkSize','studioWatermarkRepeat','studioWatermarkLogoBtn','studioWatermarkLogoRemove','studioFormat','studioSize','studioQuality','studioKeepMetadata','studioShareMode','studioLutStrength'].forEach(id=>{const node=q('#'+id);if(node)node.disabled=!ready;});
    qa('[data-adjust]').forEach(node=>{node.disabled=!ready;});
    const curve=q('#studioCurve');if(curve){curve.setAttribute('aria-disabled',String(!ready));curve.classList.toggle('is-disabled',!ready);}
    const hint=q('#studioEditorHint');if(hint)hint.hidden=ready;
  }
  async function restoreSnapshot(value){if(cropMode)setCropMode(false);state=JSON.parse(value);lastCommitted=snapshot();syncControls();drawCurve();updateHistoryButtons();await loadActiveLut(state.lutId);await renderPreview();}
  function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restoreSnapshot(undoStack.pop());}
  function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restoreSnapshot(redoStack.pop());}
  function syncExportControls(){
    const mime=q('#studioFormat').value,quality=q('#studioQuality'),metadata=q('#studioKeepMetadata');
    quality.disabled=mime==='image/png';metadata.disabled=mime!=='image/jpeg'||!file||file.type!=='image/jpeg';
  }
  function syncControls(){
    qa('[data-adjust]').forEach(input=>{const key=input.dataset.adjust;input.value=state[key]??0;const out=q('[data-output="'+key+'"]');if(out)out.textContent=key==='exposure'?Number(state[key]).toFixed(1)+' EV':Math.round(Number(state[key])||0)+(key==='straighten'?'°':key==='brushSize'||key==='grain'||key==='vignette'||key==='sharpen'||key==='denoise'||key==='cropLeft'||key==='cropTop'||key==='cropRight'||key==='cropBottom'?'%':'');});
    q('#studioAspect').value=state.aspect;q('#studioWatermarkText').value=state.watermarkText||'';q('#studioWatermarkPosition').value=state.watermarkPosition||'bottom-right';q('#studioWatermarkOpacity').value=state.watermarkOpacity??75;q('#studioWatermarkOpacityValue').textContent=(state.watermarkOpacity??75)+'%';q('#studioWatermarkSize').value=state.watermarkSize??24;q('#studioWatermarkSizeValue').textContent=state.watermarkSize??24;q('#studioWatermarkRepeat').checked=Boolean(state.watermarkRepeat);
    q('#studioWatermarkLogoName').textContent=watermarkLogoBlob?.name||'Chưa chọn logo';q('#studioWatermarkLogoRemove').hidden=!watermarkLogoBlob;
    q('#studioBrush').classList.toggle('active',state.brushEnabled);q('#studioLutStrength').value=state.lutStrength;q('#studioLutStrengthValue').textContent=state.lutStrength+'%';
  }
  function computeCrop(){
    if(!image)return{x:0,y:0,w:0,h:0};
    let l=clamp(Number(state.cropLeft)||0,0,90)/100,t=clamp(Number(state.cropTop)||0,0,90)/100,r=clamp(Number(state.cropRight)||0,0,90)/100,b=clamp(Number(state.cropBottom)||0,0,90)/100;
    if(l+r>.9){const sum=l+r;l=l*.9/sum;r=.9-l;}if(t+b>.9){const sum=t+b;t=t*.9/sum;b=.9-t;}
    let x=image.naturalWidth*l,y=image.naturalHeight*t,w=image.naturalWidth*(1-l-r),h=image.naturalHeight*(1-t-b);
    const ratios={'1:1':1,'4:3':4/3,'3:2':1.5,'16:9':16/9,'9:16':9/16};const ratio=ratios[state.aspect];
    if(ratio){const current=w/h;if(current>ratio){const nw=h*ratio;x+=(w-nw)/2;w=nw;}else{const nh=w/ratio;y+=(h-nh)/2;h=nh;}}
    return{x,y,w:Math.max(1,w),h:Math.max(1,h)};
  }
  function makeCurve(){return curveTable(state.curve||[[0,0],[.5,.5],[1,1]]);}
  function fallbackProcess(data,w,h,s,lutInfo){
    const clampByte=v=>Math.max(0,Math.min(255,v)),out=new Uint8ClampedArray(data),base=new Uint8ClampedArray(data);
    let blurred=null;
    if(s.denoise>0||s.sharpen>0){
      blurred=new Uint8ClampedArray(data.length);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){let sum=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h){sum+=base[(yy*w+xx)*4+c];n++;}}blurred[i+c]=sum/n;}blurred[i+3]=base[i+3];}
    }
    const toHsl=(r,g,b)=>{const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let hue=0,sat=0;if(d){sat=d/(1-Math.abs(2*l-1));if(max===r)hue=((g-b)/d)%6;else if(max===g)hue=(b-r)/d+2;else hue=(r-g)/d+4;hue=(hue*60+360)%360;}return[hue,sat,l];};
    const toRgb=(h,sat,l)=>{const c=(1-Math.abs(2*l-1))*sat,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let r=0,g=0,b=0;if(h<60)[r,g,b]=[c,x,0];else if(h<120)[r,g,b]=[x,c,0];else if(h<180)[r,g,b]=[0,c,x];else if(h<240)[r,g,b]=[0,x,c];else if(h<300)[r,g,b]=[x,0,c];else[r,g,b]=[c,0,x];return[(r+m)*255,(g+m)*255,(b+m)*255];};
    const sampleLut=(rgb,table,size)=>{if(!table||size<2)return rgb;const p=rgb.map(v=>clampByte(v*255)/255*(size-1)),lo=p.map(Math.floor),hi=p.map((v,i)=>Math.min(size-1,lo[i]+1)),t=p.map((v,i)=>v-lo[i]),read=(r,g,b,c)=>table[((b*size+g)*size+r)*3+c],res=[];for(let c=0;c<3;c++){const c00=read(lo[0],lo[1],lo[2],c)*(1-t[0])+read(hi[0],lo[1],lo[2],c)*t[0],c10=read(lo[0],hi[1],lo[2],c)*(1-t[0])+read(hi[0],hi[1],lo[2],c)*t[0],c01=read(lo[0],lo[1],hi[2],c)*(1-t[0])+read(hi[0],lo[1],hi[2],c)*t[0],c11=read(lo[0],hi[1],hi[2],c)*(1-t[0])+read(hi[0],hi[1],hi[2],c)*t[0];res[c]=(c00*(1-t[1])+c10*t[1])*(1-t[2])+(c01*(1-t[1])+c11*t[1])*t[2];}return res;};
    const exp=Math.pow(2,Number(s.exposure)||0),contrast=Number(s.contrast)||0,contrastFactor=(259*(contrast+255))/(255*(259-contrast)),temp=(Number(s.temperature)||0)*.35,tint=(Number(s.tint)||0)*.22,sat=Number(s.saturation)||0,vibrance=Number(s.vibrance)||0,hue=Number(s.hue)||0,hslSat=Number(s.hslSaturation)||0,hslLum=Number(s.hslLuminance)||0,lutMix=(Number(s.lutStrength)||0)/100,vignette=(Number(s.vignette)||0)/100,grain=Number(s.grain)||0,denoise=(Number(s.denoise)||0)/100,sharpen=(Number(s.sharpen)||0)/100,curve=curveTable(s.curve||[[0,0],[.5,.5],[1,1]]),table=lutInfo?.data,size=lutInfo?.size;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4;let r=base[i],g=base[i+1],b=base[i+2];
      if(blurred&&denoise){r=r*(1-denoise)+blurred[i]*denoise;g=g*(1-denoise)+blurred[i+1]*denoise;b=b*(1-denoise)+blurred[i+2]*denoise;}
      if(blurred&&sharpen){r+=(base[i]-blurred[i])*sharpen*1.8;g+=(base[i+1]-blurred[i+1])*sharpen*1.8;b+=(base[i+2]-blurred[i+2])*sharpen*1.8;}
      r=(r-127.5)*contrastFactor+127.5;g=(g-127.5)*contrastFactor+127.5;b=(b-127.5)*contrastFactor+127.5;r*=exp;g*=exp;b*=exp;r+=temp+tint*.35;g-=tint*.45;b-=temp+tint*.35;
      const lum=(.2126*r+.7152*g+.0722*b)/255,sw=Math.max(0,1-lum*1.8),hw=Math.max(0,(lum-.42)*1.8),lift=(Number(s.shadows)||0)/100*sw*72-(Number(s.highlights)||0)/100*hw*72,white=(Number(s.whites)||0)*.42*Math.max(0,(lum-.65)*2.7),black=(Number(s.blacks)||0)*.4*Math.max(0,(.38-lum)*2.6);
      r+=lift+white+black;g+=lift+white+black;b+=lift+white+black;
      const hs=toHsl(clampByte(r)/255,clampByte(g)/255,clampByte(b)/255);hs[0]=(hs[0]+hue+360)%360;hs[1]=Math.max(0,Math.min(1,hs[1]*(1+sat/100+hslSat/100)+vibrance/100*(1-hs[1])));hs[2]=Math.max(0,Math.min(1,hs[2]*(1+hslLum/100)));[r,g,b]=toRgb(hs[0],hs[1],hs[2]);
      if(curve&&curve.length===256){r=curve[clampByte(Math.round(r))];g=curve[clampByte(Math.round(g))];b=curve[clampByte(Math.round(b))];}
      if(table&&size>=2&&lutMix>0){const mapped=sampleLut([r/255,g/255,b/255],table,size);r=r*(1-lutMix)+mapped[0]*255*lutMix;g=g*(1-lutMix)+mapped[1]*255*lutMix;b=b*(1-lutMix)+mapped[2]*255*lutMix;}
      if(vignette>0){const nx=(x/Math.max(1,w-1)-.5)*2,ny=(y/Math.max(1,h-1)-.5)*2,f=1-vignette*.68*Math.min(1,(nx*nx+ny*ny)*.62);r*=f;g*=f;b*=f;}
      if(grain>0){let n=(i*1664525+1013904223)>>>0;n=(n^(n>>>16))*2246822519>>>0;n=(n^(n>>>13))*3266489917>>>0;n=(n^(n>>>16))>>>0;const noise=(n/4294967295-.5)*grain;r+=noise;g+=noise;b+=noise;}
      out[i]=clampByte(r);out[i+1]=clampByte(g);out[i+2]=clampByte(b);out[i+3]=base[i+3];
    }
    return out;
  }
  async function processData(data,w,h,s){
    if(worker){
      const id=++requestId;const buffer=new Uint8ClampedArray(data).buffer;
      return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});const lut=s.lutId!=='none'&&activeLut?activeLut.data:null;worker.postMessage({id,buffer,width:w,height:h,settings:s,lut:lut?new Float32Array(lut):null,lutSize:lut?activeLut.size:0,curve:makeCurve()},[buffer]);});
    }
    return fallbackProcess(data,w,h,s,activeLut);
  }
  function applyMask(outCanvas,s){
    if(!s.strokes||!s.strokes.length||!s.localExposure)return;
    const w=outCanvas.width,h=outCanvas.height,mask=document.createElement('canvas');mask.width=w;mask.height=h;const mctx=mask.getContext('2d');mctx.clearRect(0,0,w,h);mctx.strokeStyle='rgba(255,255,255,1)';mctx.fillStyle='rgba(255,255,255,1)';mctx.lineCap='round';mctx.lineJoin='round';
    for(const stroke of s.strokes){if(!stroke.points.length)continue;const size=clamp(Number(stroke.size)||.12,.02,.4)*Math.min(w,h);mctx.lineWidth=size;mctx.shadowColor='white';mctx.shadowBlur=size*(1-(stroke.hardness||.45));mctx.beginPath();mctx.moveTo(stroke.points[0][0]*w,stroke.points[0][1]*h);for(let i=1;i<stroke.points.length;i++)mctx.lineTo(stroke.points[i][0]*w,stroke.points[i][1]*h);if(stroke.points.length===1){mctx.arc(stroke.points[0][0]*w,stroke.points[0][1]*h,size/2,0,Math.PI*2);}mctx.stroke();mctx.fill();}
    const ctx=outCanvas.getContext('2d',{willReadFrequently:true}),im=ctx.getImageData(0,0,w,h),mi=mctx.getImageData(0,0,w,h).data,factor=Math.pow(2,(Number(s.localExposure)||0)/100*1.5);
    for(let i=0;i<im.data.length;i+=4){const a=mi[i+3]/255;if(!a)continue;const f=1+(factor-1)*a;im.data[i]=clamp(im.data[i]*f,0,255);im.data[i+1]=clamp(im.data[i+1]*f,0,255);im.data[i+2]=clamp(im.data[i+2]*f,0,255);}
    ctx.putImageData(im,0,0);
  }
  function maxOutputSide(){
    if(!worker)return 1800;
    const memory=Number(navigator.deviceMemory)||8,mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return mobile||memory<=4?3072:memory<=8?4096:6000;
  }
  async function renderProcessed(maxSide=1100,useOriginal=false){
    if(!image)return null;
    const crop=useOriginal?{x:0,y:0,w:image.naturalWidth,h:image.naturalHeight}:computeCrop();
    const limit=Math.min(Number(maxSide)||1100,maxOutputSide()),scale=Math.min(1,limit/Math.max(crop.w,crop.h));
    const w=Math.max(1,Math.round(crop.w*scale)),h=Math.max(1,Math.round(crop.h*scale));
    const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
    const tctx=tmp.getContext('2d',{willReadFrequently:true});tctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,0,0,w,h);
    if(useOriginal)return tmp;
    const output=await processData(tctx.getImageData(0,0,w,h).data,w,h,state);
    tctx.putImageData(new ImageData(output,w,h),0,0);
    const angle=(Number(state.rotate)+Number(state.straighten))*Math.PI/180,cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));
    const ow=Math.max(1,Math.ceil(w*cos+h*sin)),oh=Math.max(1,Math.ceil(h*cos+w*sin));
    const out=document.createElement('canvas');out.width=ow;out.height=oh;
    const ctx=out.getContext('2d');ctx.translate(ow/2,oh/2);ctx.rotate(angle);ctx.scale(state.flipX?-1:1,state.flipY?-1:1);ctx.drawImage(tmp,-w/2,-h/2);
    tmp.width=0;tmp.height=0;
    applyMask(out,state);
    const result=await decorate(out,state);if(result!==out){out.width=0;out.height=0;}
    return result;
  }
  async function decorate(source,s){
    const text=String(s.watermarkText||'').trim();
    if(!text&&!watermarkLogoImage)return source;
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
    const opacity=clamp(Number(s.watermarkOpacity)||75,5,100)/100;
    const fontSize=clamp(source.width*(Number(s.watermarkSize)||24)/800,14,180);
    const logoW=watermarkLogoImage?clamp(source.width*(Number(s.watermarkSize)||24)/160,Math.min(48,source.width*.06),source.width*.32):0;
    const logoH=watermarkLogoImage?logoW*(watermarkLogoImage.naturalHeight/watermarkLogoImage.naturalWidth):0;
    const gap=logoW&&text?fontSize*.45:0;
    const measured=(()=>{ctx.save();ctx.font='700 '+fontSize+'px system-ui,sans-serif';const w=text?ctx.measureText(text).width:0;ctx.restore();return w;})();
    const markW=logoW+gap+measured, markH=Math.max(logoH,fontSize);
    const pad=Math.max(14,Math.round(source.width*.035));
    const drawMark=(x,y)=>{
      ctx.save();ctx.globalAlpha=opacity;
      let cursor=x-markW/2;
      if(watermarkLogoImage){ctx.drawImage(watermarkLogoImage,cursor,y-logoH/2,logoW,logoH);cursor+=logoW+gap;}
      if(text){
        ctx.font='700 '+fontSize+'px system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
        ctx.lineJoin='round';ctx.lineWidth=Math.max(2,fontSize*.12);ctx.strokeStyle='rgba(0,0,0,.72)';ctx.shadowColor='rgba(0,0,0,.58)';ctx.shadowBlur=fontSize*.25;
        ctx.strokeText(text,cursor,y);ctx.fillStyle='#fff';ctx.fillText(text,cursor,y);
      }
      ctx.restore();
    };
    if(s.watermarkRepeat){
      const stepX=Math.max(markW+pad*2,source.width*.28),stepY=Math.max(markH+pad*2,source.height*.2);
      for(let y=stepY/2;y<source.height+stepY;y+=stepY)for(let x=stepX/2;x<source.width+stepX;x+=stepX)drawMark(x,y);
    }else{
      const [row,col]=String(s.watermarkPosition||'bottom-right').split('-');
      const x=col==='left'?pad+markW/2:col==='right'?source.width-pad-markW/2:source.width/2;
      const y=row==='top'?pad+markH/2:row==='bottom'?source.height-pad-markH/2:source.height/2;
      drawMark(x,y);
    }
    return canvas;
  }
  async function renderPreview(){
    if(!image){const canvas=q('#studioCanvas');canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);stageImageRect=null;q('#studioEmpty').hidden=false;syncCropOverlay();return;}
    const ticket=++renderTicket;
    try{
      const result=await renderProcessed(1100,showOriginal);if(closed||ticket!==renderTicket||!result)return;
      const canvas=q('#studioCanvas'),rect=q('#studioStage').getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#08111b';ctx.fillRect(0,0,canvas.width,canvas.height);
      const scale=Math.min(canvas.width/result.width,canvas.height/result.height),dw=result.width*scale,dh=result.height*scale,x=(canvas.width-dw)/2,y=(canvas.height-dh)/2;
      ctx.drawImage(result,x,y,dw,dh);stageImageRect={x,y,w:dw,h:dh,dpr};q('#studioEmpty').hidden=true;syncCropOverlay();
      q('#studioFileName').textContent=file?file.name:'Ảnh đã chụp';
    }catch(error){if(ticket===renderTicket)toast(error.message||'Không thể xem trước ảnh.');}
  }
  function schedulePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(()=>requestAnimationFrame(renderPreview),35);}
  function openPhotoPicker(){
    const input=q('#studioFile');if(!input)return;
    input.value='';
    try{input.click();}catch{toast('Trình duyệt không mở được bộ chọn ảnh. Hãy thử mở PhotoLens bằng Chrome hoặc Edge.');}
  }
  async function setWatermarkLogo(blob){
    if(watermarkLogoUrl)URL.revokeObjectURL(watermarkLogoUrl);watermarkLogoUrl='';watermarkLogoBlob=blob||null;watermarkLogoImage=null;
    if(blob){watermarkLogoUrl=URL.createObjectURL(blob);const img=new Image();img.src=watermarkLogoUrl;try{await img.decode();watermarkLogoImage=img;}catch{URL.revokeObjectURL(watermarkLogoUrl);watermarkLogoUrl='';watermarkLogoBlob=null;throw new Error('Không đọc được tệp logo.');}}
  }
  function imageLoadError(nextFile){
    const name=String(nextFile?.name||'').toLowerCase();
    if(/\.(heic|heif)$/.test(name)||/heic|heif/i.test(nextFile?.type||''))return new Error('Trình duyệt này không đọc được ảnh HEIC/HEIF. Hãy chuyển ảnh sang JPG hoặc PNG rồi thử lại.');
    return new Error('Không giải mã được ảnh này. Hãy thử ảnh JPG, PNG, WebP hoặc AVIF.');
  }
  async function decodeImageFile(candidate){
    const url=URL.createObjectURL(candidate),decoded=new Image();decoded.decoding='async';decoded.src=url;
    try{
      if(typeof decoded.decode==='function')await decoded.decode();
      else await new Promise((resolve,reject)=>{decoded.onload=resolve;decoded.onerror=reject;});
      if(!decoded.naturalWidth||!decoded.naturalHeight)throw new Error('Ảnh không có kích thước hợp lệ.');
      return{url,image:decoded};
    }catch(error){URL.revokeObjectURL(url);throw error;}
  }
  function isHeicFile(candidate){return /\.(heic|heif)$/i.test(candidate?.name||'')||/image\/(heic|heif)/i.test(candidate?.type||'');}
  async function convertHeicFile(candidate){
    try{
      const module=await import('heic2any'),convert=module.default||module;
      const result=await convert({blob:candidate,toType:'image/jpeg',quality:.94}),blob=Array.isArray(result)?result[0]:result;
      if(!(blob instanceof Blob)||!blob.size)throw new Error();
      const name=(candidate.name||'photo').replace(/\.(heic|heif)$/i,'')+'.jpg';
      return new File([blob],name,{type:'image/jpeg',lastModified:candidate.lastModified||Date.now()});
    }catch{throw new Error('Không chuyển được ảnh HEIC/HEIF. Hãy xuất ảnh sang JPG rồi thử lại.');}
  }
  async function setSource(nextFile,restoreState=null,restoreLogo=null){
    if(cropMode)setCropMode(false);
    if(!nextFile)throw new Error('Chưa chọn tệp ảnh.');
    let preparedFile=nextFile,decoded;
    try{decoded=await decodeImageFile(preparedFile);}
    catch(error){
      if(!isHeicFile(nextFile))throw error.message==='Ảnh không có kích thước hợp lệ.'?error:imageLoadError(nextFile);
      preparedFile=await convertHeicFile(nextFile);
      try{decoded=await decodeImageFile(preparedFile);}catch{throw imageLoadError(nextFile);}
    }
    const {url:nextUrl,image:nextImage}=decoded;
    try{await setWatermarkLogo(restoreLogo||null);}catch(error){URL.revokeObjectURL(nextUrl);throw error;}
    if(imageUrl)URL.revokeObjectURL(imageUrl);
    imageUrl=nextUrl;image=nextImage;file=preparedFile;syncExportControls();
    state=Object.assign(defaults(),restoreState||{});delete state.frame;delete state.sticker;if(!Array.isArray(state.strokes))state.strokes=[];
    undoStack=[];redoStack=[];lastCommitted=snapshot();syncControls();await loadActiveLut(state.lutId);q('#studioEmpty').hidden=true;q('#studioFileName').textContent=file.name+' · '+image.naturalWidth+' × '+image.naturalHeight;
    syncImageAvailability();await renderPreview();
  }
  function updateOutput(input){
    const key=input.dataset.adjust;state[key]=Number(input.value);
    const cropPairs={cropLeft:'cropRight',cropRight:'cropLeft',cropTop:'cropBottom',cropBottom:'cropTop'};
    const mateKey=cropPairs[key];if(mateKey&&state[key]+Number(state[mateKey]||0)>90){state[mateKey]=90-state[key];const mateInput=qa('[data-adjust]').find(node=>node.dataset.adjust===mateKey);if(mateInput){mateInput.value=state[mateKey];const mateOut=q('[data-output="'+mateKey+'"]');if(mateOut)mateOut.textContent=state[mateKey]+'%';}}
    const out=q('[data-output="'+key+'"]');
    if(out){const suffix=key==='exposure'?' EV':key==='straighten'?'°':(['brushSize','grain','vignette','sharpen','denoise','cropLeft','cropTop','cropRight','cropBottom'].includes(key)?'%':'');out.textContent=formatValue(key,input.value,suffix);}
    schedulePreview();
  }
  qa('[data-adjust]').forEach(input=>{
    input.addEventListener('pointerdown',()=>{});
    input.addEventListener('input',()=>updateOutput(input));
    input.addEventListener('change',commit);
  });
  function drawCurve(){
    const c=q('#studioCurve'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1420';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(180,200,220,.18)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(8+i*(w-16)/4,8);ctx.lineTo(8+i*(w-16)/4,h-8);ctx.stroke();ctx.beginPath();ctx.moveTo(8,8+i*(h-16)/4);ctx.lineTo(w-8,8+i*(h-16)/4);ctx.stroke();}
    const points=state.curve||[[0,0],[.5,.5],[1,1]];ctx.strokeStyle='#8cefc9';ctx.lineWidth=2;ctx.beginPath();points.slice().sort((a,b)=>a[0]-b[0]).forEach((p,i)=>{const x=8+p[0]*(w-16),y=h-8-p[1]*(h-16);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();ctx.fillStyle='#f4faf8';
    points.forEach(p=>{ctx.beginPath();ctx.arc(8+p[0]*(w-16),h-8-p[1]*(h-16),5,0,Math.PI*2);ctx.fill();});
  }
  const curve=q('#studioCurve');
  curve.addEventListener('pointerdown',e=>{const rect=curve.getBoundingClientRect(),x=clamp((e.clientX-rect.left)/rect.width,0,1),y=1-clamp((e.clientY-rect.top)/rect.height,0,1);let best=-1,dist=.08;
    state.curve.forEach((p,i)=>{const d=Math.hypot(p[0]-x,p[1]-y);if(d<dist){dist=d;best=i;}});
    if(best<0&&state.curve.length<8){state.curve.push([x,y]);state.curve.sort((a,b)=>a[0]-b[0]);best=state.curve.findIndex(p=>p[0]===x&&p[1]===y);}
    curvePoint=best;curve.setPointerCapture(e.pointerId);drawCurve();
  });
  curve.addEventListener('pointermove',e=>{if(curvePoint<0)return;const rect=curve.getBoundingClientRect(),x=clamp((e.clientX-rect.left)/rect.width,.01,.99),y=1-clamp((e.clientY-rect.top)/rect.height,.01,.99);const left=curvePoint===0?0:state.curve[curvePoint-1][0]+.015,right=curvePoint===state.curve.length-1?1:state.curve[curvePoint+1][0]-.015;if(curvePoint!==0&&curvePoint!==state.curve.length-1)state.curve[curvePoint][0]=clamp(x,left,right);state.curve[curvePoint][1]=y;drawCurve();schedulePreview();});
  curve.addEventListener('pointerup',()=>{if(curvePoint>=0){curvePoint=-1;commit();}});
  curve.addEventListener('dblclick',e=>{if(state.curve.length<=3)return;const rect=curve.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width,y=1-(e.clientY-rect.top)/rect.height;let best=-1,d=.06;state.curve.forEach((p,i)=>{const n=Math.hypot(p[0]-x,p[1]-y);if(n<d){d=n;best=i;}});if(best>0&&best<state.curve.length-1){state.curve.splice(best,1);drawCurve();commit();schedulePreview();}});
  q('#studioResetCurve').addEventListener('click',()=>{state.curve=[[0,0],[.5,.5],[1,1]];drawCurve();commit();schedulePreview();});
  q('#studioAspect').addEventListener('change',e=>{state.aspect=e.target.value;commit();schedulePreview();});
  q('#studioCropGesture').addEventListener('click',()=>setCropMode(!cropMode));
  q('#studioWatermarkText').addEventListener('input',e=>{state.watermarkText=e.target.value;schedulePreview();});
  q('#studioWatermarkText').addEventListener('change',commit);
  q('#studioWatermarkPosition').addEventListener('change',e=>{state.watermarkPosition=e.target.value;commit();schedulePreview();});
  q('#studioWatermarkOpacity').addEventListener('input',e=>{state.watermarkOpacity=Number(e.target.value);q('#studioWatermarkOpacityValue').textContent=e.target.value+'%';schedulePreview();});
  q('#studioWatermarkOpacity').addEventListener('change',commit);
  q('#studioWatermarkSize').addEventListener('input',e=>{state.watermarkSize=Number(e.target.value);q('#studioWatermarkSizeValue').textContent=e.target.value;schedulePreview();});
  q('#studioWatermarkSize').addEventListener('change',commit);
  q('#studioWatermarkRepeat').addEventListener('change',e=>{state.watermarkRepeat=e.target.checked;commit();schedulePreview();});
  q('#studioWatermarkLogoBtn').addEventListener('click',()=>q('#studioWatermarkLogoFile').click());
  q('#studioWatermarkLogoFile').addEventListener('change',async e=>{const logo=e.target.files?.[0];e.target.value='';if(!logo)return;if(logo.size>1_500_000){toast('Logo phải nhỏ hơn 1,5 MB.');return;}try{await setWatermarkLogo(logo);q('#studioWatermarkLogoName').textContent=logo.name;q('#studioWatermarkLogoRemove').hidden=false;commit();schedulePreview();}catch(error){toast(error.message);}});
  q('#studioWatermarkLogoRemove').addEventListener('click',async()=>{await setWatermarkLogo(null);q('#studioWatermarkLogoName').textContent='Chưa chọn logo';q('#studioWatermarkLogoRemove').hidden=true;commit();schedulePreview();});
  q('#studioDetectWatermark').addEventListener('click',detectWatermarks);
  q('#studioRotateLeft').addEventListener('click',()=>{state.rotate=(state.rotate-90+360)%360;commit();schedulePreview();});
  q('#studioRotateRight').addEventListener('click',()=>{state.rotate=(state.rotate+90)%360;commit();schedulePreview();});
  q('#studioFlipX').addEventListener('click',()=>{state.flipX=!state.flipX;commit();schedulePreview();});
  q('#studioFlipY').addEventListener('click',()=>{state.flipY=!state.flipY;commit();schedulePreview();});
  q('#studioBrush').addEventListener('click',()=>{state.brushEnabled=!state.brushEnabled;q('#studioBrush').classList.toggle('active',state.brushEnabled);q('#studioStage').classList.toggle('is-brushing',state.brushEnabled);});
  q('#studioClearBrush').addEventListener('click',()=>{state.strokes=[];commit();schedulePreview();});
  const stage=q('#studioCanvas'),dropStage=q('#studioStage');
  dropStage.addEventListener('dragover',e=>{e.preventDefault();dropStage.classList.add('is-dragging');});
  ['dragleave','dragend'].forEach(type=>dropStage.addEventListener(type,()=>dropStage.classList.remove('is-dragging')));
  dropStage.addEventListener('drop',async e=>{
    e.preventDefault();dropStage.classList.remove('is-dragging');
    const dropped=Array.from(e.dataTransfer?.files||[]).find(f=>f.type.startsWith('image/')||/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(f.name));
    if(!dropped){toast('Hãy thả một tệp ảnh JPG, PNG, WebP, AVIF hoặc HEIC.');return;}
    q('#studioFileName').textContent='Đang mở '+dropped.name+'…';
    try{await setSource(dropped);toast('Đã mở ảnh thành công.');}
    catch(error){q('#studioFileName').textContent=file?file.name+' · '+image.naturalWidth+' × '+image.naturalHeight:'Không mở được ảnh';toast(error.message||'Không thể mở ảnh.');}
  });
  function syncCropOverlay(){
    const overlay=q('#studioCropOverlay'),box=q('#studioCropBox'),tip=q('#studioCropTip');
    if(!cropMode||!image||!stageImageRect){overlay.hidden=true;return;}
    const r=stageImageRect,dpr=r.dpr||1;overlay.hidden=false;
    overlay.style.left=(r.x/dpr)+'px';overlay.style.top=(r.y/dpr)+'px';overlay.style.width=(r.w/dpr)+'px';overlay.style.height=(r.h/dpr)+'px';
    tip.hidden=Boolean(cropSelection);
    if(!cropSelection){box.hidden=true;return;}
    box.hidden=false;box.style.left=(cropSelection.x*100)+'%';box.style.top=(cropSelection.y*100)+'%';box.style.width=(cropSelection.w*100)+'%';box.style.height=(cropSelection.h*100)+'%';
  }
  function setCropMode(enabled){
    cropMode=Boolean(enabled&&image);cropGesture=null;cropSelection=null;
    if(cropMode&&state.brushEnabled){state.brushEnabled=false;q('#studioBrush').classList.remove('active');dropStage.classList.remove('is-brushing');}
    dropStage.classList.toggle('is-cropping',cropMode);q('#studioCropOverlay').hidden=!cropMode;
    const button=q('#studioCropGesture');button?.classList.toggle('active',cropMode);setStudioButtonLabel(button,cropMode?'Đang cắt · kéo trên ảnh':'Vuốt để cắt trên ảnh');
    if(cropMode)toast('Kéo trên ảnh để chọn vùng cắt; thả tay để áp dụng.');
    syncCropOverlay();
  }
  function cropPointFromEvent(e,allowOutside=false){
    if(!stageImageRect)return null;
    const rect=stage.getBoundingClientRect(),dpr=stageImageRect.dpr||1;
    const px=(e.clientX-rect.left)*dpr,py=(e.clientY-rect.top)*dpr,frame=stageImageRect;
    if(!allowOutside&&(px<frame.x||px>frame.x+frame.w||py<frame.y||py>frame.y+frame.h))return null;
    return{u:clamp((px-frame.x)/frame.w,0,1),v:clamp((py-frame.y)/frame.h,0,1)};
  }
  function beginCropGesture(e){
    const point=cropPointFromEvent(e);if(!point)return false;
    let mode='draw',edges='';
    if(cropSelection){
      const frame=stageImageRect,dpr=frame.dpr||1,tolX=clamp(14/(frame.w/dpr),.012,.065),tolY=clamp(14/(frame.h/dpr),.012,.065);
      const x1=cropSelection.x,x2=x1+cropSelection.w,y1=cropSelection.y,y2=y1+cropSelection.h;
      const inside=point.u>=x1&&point.u<=x2&&point.v>=y1&&point.v<=y2;
      if(inside){
        if(Math.abs(point.u-x1)<=tolX)edges+='w';else if(Math.abs(point.u-x2)<=tolX)edges+='e';
        if(Math.abs(point.v-y1)<=tolY)edges+='n';else if(Math.abs(point.v-y2)<=tolY)edges+='s';
        mode=edges?'resize':'move';
      }
    }
    const origin=mode==='draw'?null:{...cropSelection};
    if(mode==='draw')cropSelection={x:point.u,y:point.v,w:0,h:0};
    cropGesture={mode,edges,start:point,origin};stage.setPointerCapture(e.pointerId);e.preventDefault();syncCropOverlay();return true;
  }
  function updateCropGesture(e){
    if(!cropGesture)return;const point=cropPointFromEvent(e,true);if(!point)return;
    const g=cropGesture;
    if(g.mode==='draw'){cropSelection={x:Math.min(g.start.u,point.u),y:Math.min(g.start.v,point.v),w:Math.abs(point.u-g.start.u),h:Math.abs(point.v-g.start.v)};}
    else if(g.mode==='move'){const o=g.origin;cropSelection={...o,x:clamp(o.x+point.u-g.start.u,0,1-o.w),y:clamp(o.y+point.v-g.start.v,0,1-o.h)};}
    else{
      const o=g.origin;let x1=o.x,x2=o.x+o.w,y1=o.y,y2=o.y+o.h;
      if(g.edges.includes('w'))x1=clamp(point.u,0,x2-.04);if(g.edges.includes('e'))x2=clamp(point.u,x1+.04,1);
      if(g.edges.includes('n'))y1=clamp(point.v,0,y2-.04);if(g.edges.includes('s'))y2=clamp(point.v,y1+.04,1);
      cropSelection={x:x1,y:y1,w:x2-x1,h:y2-y1};
    }
    syncCropOverlay();
  }
  function applyGestureCrop(selection){
    const crop=computeCrop(),scale=Math.min(1,1100/Math.max(crop.w,crop.h));
    const w=Math.max(1,Math.round(crop.w*scale)),h=Math.max(1,Math.round(crop.h*scale));
    const angle=(Number(state.rotate)+Number(state.straighten))*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    const outW=Math.max(1,Math.ceil(w*Math.abs(cos)+h*Math.abs(sin))),outH=Math.max(1,Math.ceil(h*Math.abs(cos)+w*Math.abs(sin)));
    const corners=[{u:selection.x,v:selection.y},{u:selection.x+selection.w,v:selection.y},{u:selection.x+selection.w,v:selection.y+selection.h},{u:selection.x,v:selection.y+selection.h}];
    const points=corners.map(p=>{
      const dx=p.u*outW-outW/2,dy=p.v*outH-outH/2;
      const localX=(cos*dx+sin*dy)*(state.flipX?-1:1),localY=(-sin*dx+cos*dy)*(state.flipY?-1:1);
      return{u:clamp((localX+w/2)/w,0,1),v:clamp((localY+h/2)/h,0,1)};
    });
    const minU=Math.min(...points.map(p=>p.u)),maxU=Math.max(...points.map(p=>p.u)),minV=Math.min(...points.map(p=>p.v)),maxV=Math.max(...points.map(p=>p.v));
    const imageW=image.naturalWidth,imageH=image.naturalHeight,minW=imageW*.1,minH=imageH*.1;
    let x1=clamp(crop.x+minU*crop.w,0,imageW-minW),x2=clamp(crop.x+maxU*crop.w,x1+minW,imageW);
    let y1=clamp(crop.y+minV*crop.h,0,imageH-minH),y2=clamp(crop.y+maxV*crop.h,y1+minH,imageH);
    state.cropLeft=Math.round(x1/imageW*100);state.cropRight=Math.round((imageW-x2)/imageW*100);
    state.cropTop=Math.round(y1/imageH*100);state.cropBottom=Math.round((imageH-y2)/imageH*100);state.aspect='free';
    syncControls();setCropMode(false);commit();schedulePreview();toast('Đã áp dụng vùng cắt. Có thể hoàn tác bằng nút mũi tên.');
  }
  function finishCropGesture(cancel=false){
    if(!cropGesture)return;cropGesture=null;
    if(cancel){cropSelection=null;syncCropOverlay();return;}
    if(cropSelection&&cropSelection.w>=.05&&cropSelection.h>=.05){const selected={...cropSelection};applyGestureCrop(selected);}
    else{cropSelection=null;syncCropOverlay();toast('Vùng chọn hơi nhỏ. Kéo rộng hơn để cắt ảnh.');}
  }
  stage.addEventListener('pointerdown',e=>{
    if(cropMode){if(beginCropGesture(e))return;}
    if(!state.brushEnabled||!stageImageRect||!image)return;
    const r=stage.getBoundingClientRect(),dpr=stageImageRect.dpr,x=(e.clientX-r.left)*dpr,y=(e.clientY-r.top)*dpr,rect=stageImageRect;
    if(x<rect.x||x>rect.x+rect.w||y<rect.y||y>rect.y+rect.h)return;
    brushStroke={points:[[(x-rect.x)/rect.w,(y-rect.y)/rect.h]],size:state.brushSize/100,hardness:.48};state.strokes.push(brushStroke);stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove',e=>{
    if(cropGesture){updateCropGesture(e);return;}
    if(!brushStroke||!stageImageRect)return;
    const r=stage.getBoundingClientRect(),dpr=stageImageRect.dpr,rect=stageImageRect,x=clamp((e.clientX-r.left)*dpr,rect.x,rect.x+rect.w),y=clamp((e.clientY-r.top)*dpr,rect.y,rect.y+rect.h);
    brushStroke.points.push([(x-rect.x)/rect.w,(y-rect.y)/rect.h]);
  });
  const endBrush=()=>{if(cropGesture){finishCropGesture(false);return;}if(brushStroke){brushStroke=null;commit();schedulePreview();}};
  const cancelGesture=()=>{if(cropGesture){finishCropGesture(true);return;}if(brushStroke){brushStroke=null;commit();schedulePreview();}};
  stage.addEventListener('pointerup',endBrush);stage.addEventListener('pointercancel',cancelGesture);
  
  q('#studioUndo').addEventListener('click',undo);q('#studioRedo').addEventListener('click',redo);
  q('#studioReset').addEventListener('click',async()=>{if(!image)return;if(cropMode)setCropMode(false);await setWatermarkLogo(null);state=defaults();lastCommitted=snapshot();undoStack=[];redoStack=[];syncControls();drawCurve();loadActiveLut('none');updateHistoryButtons();renderPreview();});
  q('#studioBefore').addEventListener('pointerdown',()=>{showOriginal=true;renderPreview();});['pointerup','pointerleave','pointercancel'].forEach(t=>q('#studioBefore').addEventListener(t,()=>{showOriginal=false;renderPreview();}));
  q('#studioOpenFile').addEventListener('click',openPhotoPicker);q('#studioChooseFile').addEventListener('click',openPhotoPicker);
  q('#studioFile').addEventListener('cancel',()=>{if(!file)q('#studioFileName').textContent='Chưa chọn ảnh';});
  q('#studioFile').addEventListener('change',async e=>{
    const input=e.currentTarget,selected=input.files&&input.files[0];if(!selected)return;
    const previousLabel=file?file.name+' · '+image.naturalWidth+' × '+image.naturalHeight:'Chưa chọn ảnh';
    q('#studioFileName').textContent='Đang mở '+selected.name+'…';
    try{await setSource(selected);toast('Đã mở ảnh thành công.');}
    catch(error){q('#studioFileName').textContent=file?previousLabel:'Không mở được ảnh';toast(error.message||'Không thể mở ảnh.');}
    finally{input.value='';}
  });
  q('#studioQuality').addEventListener('input',e=>q('#studioQualityValue').textContent=e.target.value+'%');
  q('#studioFormat').addEventListener('change',syncExportControls);
  q('#studioExport').addEventListener('click',exportImage);q('#studioApply').addEventListener('click',applyToPhotoLens);q('#studioShare').addEventListener('click',shareImage);
  q('#studioSaveProject').addEventListener('click',saveProject);q('#studioOpenProject').addEventListener('click',showProjects);
  q('#studioLutClose').addEventListener('click',()=>setView('editor'));
  q('#studioLutStrength').addEventListener('input',e=>{state.lutStrength=Number(e.target.value);q('#studioLutStrengthValue').textContent=e.target.value+'%';schedulePreview();});
  q('#studioLutStrength').addEventListener('change',commit);
  q('#studioImportLut').addEventListener('click',()=>q('#studioLutFile').click());
  q('#studioLutFile').addEventListener('change',importLut);
  q('#studioLutSearch').addEventListener('input',drawLutCards);q('#studioLutCategory').addEventListener('change',drawLutCards);
  q('#studioCameraResolution').addEventListener('change',()=>{if(mediaStream)startCamera(q('#studioCameraDevice').value);});
  q('#studioCameraDevice').addEventListener('change',()=>startCamera(q('#studioCameraDevice').value));
  q('#studioGridToggle').addEventListener('change',e=>q('#studioCameraGrid').hidden=!e.target.checked);
  q('#studioStartCamera').addEventListener('click',()=>startCamera());
  q('#studioCameraChoose').addEventListener('click',()=>{void setView('editor');openPhotoPicker();});
  q('#studioCapture').addEventListener('click',captureCamera);
  q('#studioNativeCapture').addEventListener('click',async()=>{if(!cfg.nativeCapture){toast('Camera thiết bị không khả dụng.');return;}try{const f=await cfg.nativeCapture();if(f){if(cfg.onCapture)await cfg.onCapture(f);close();}}catch(error){toast(error.message||'Không mở được camera thiết bị.');}});
  q('#studioCameraStage').addEventListener('click',focusAtPoint);
  q('#studioClose').addEventListener('click',close);
  qa('[data-studio-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.studioView)));
  document.addEventListener('keydown',onKeydown);
  const resizeObserver=new ResizeObserver(()=>{if(activeView==='editor')schedulePreview();});
  resizeObserver.observe(q('#studioStage'));
  async function setView(view){
    activeView=view;qa('[data-studio-view]').forEach(b=>b.classList.toggle('active',b.dataset.studioView===view));
    if(view!=='editor'&&cropMode)setCropMode(false);
    const pageView=view==='luts'?'editor':view;qa('[data-studio-page]').forEach(p=>p.hidden=p.dataset.studioPage!==pageView);q('#studioLutDrawer').hidden=view!=='luts';q('#photoStudio').classList.toggle('is-lut-open',view==='luts');
    if(view==='camera'){if(!mediaStream)await startCamera();}else stopCamera();
    if(view==='editor')schedulePreview();if(view==='luts')drawLutCards();
  }
  function onKeydown(e){if(e.target.matches?.('input,textarea,select,[contenteditable=true]')&&e.key!=='Escape')return;if(e.key==='Escape'){if(activeView==='luts'){e.preventDefault();setView('editor');return;}close();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}}
  function close(){
    if(closed)return;closed=true;stopCamera();worker?.terminate();for(const p of pending.values())p.reject(new Error('Đã đóng phòng chỉnh sửa.'));pending.clear();document.removeEventListener('keydown',onKeydown);resizeObserver.disconnect();if(imageUrl)URL.revokeObjectURL(imageUrl);if(watermarkLogoUrl)URL.revokeObjectURL(watermarkLogoUrl);root.remove();document.body.style.overflow=previousOverflow;
  }
  async function detectWatermarks(){
    const result=q('#studioWatermarkResults');
    if(!file){result.textContent='Mở ảnh trước để nhận diện dấu chìm.';return;}
    let config;
    try{config=await cfg.getAiStatus?.();}catch{}
    if(!config?.enabled||!config?.endpoint){
      result.innerHTML='<p>Hãy bật AI và cấu hình Worker trong Cài đặt AI trước khi nhận diện.</p><button type="button" class="studio-action" id="studioWatermarkSettings">Mở Cài đặt AI</button>';
      q('#studioWatermarkSettings').addEventListener('click',()=>{close();setTimeout(()=>cfg.openAiSettings?.(),0);});
      return;
    }
    const layer=q('#studioModalLayer');layer.hidden=false;
    layer.innerHTML='<div class="studio-modal" role="dialog" aria-modal="true"><h2>Gửi ảnh để nhận diện?</h2><p>PhotoLens sẽ gửi bản JPEG đã thu nhỏ tối đa 1024 px, bỏ siêu dữ liệu EXIF/GPS, tới Worker và Gemini. Ảnh gốc vẫn ở trên thiết bị. Chỉ tiếp tục nếu bạn đồng ý.</p><div class="studio-modal-actions"><button class="studio-action" id="studioWatermarkCancel">Hủy</button><button class="studio-primary" id="studioWatermarkConfirm">Đồng ý và nhận diện</button></div></div>';
    q('#studioWatermarkCancel').addEventListener('click',()=>{layer.hidden=true;layer.innerHTML='';});
    q('#studioWatermarkConfirm').addEventListener('click',async()=>{
      const button=q('#studioWatermarkConfirm');button.disabled=true;button.textContent='Đang nhận diện…';result.textContent='Đang gửi ảnh đã thu nhỏ tới Worker…';
      layer.hidden=true;layer.innerHTML='';
      try{
        const marks=await cfg.detectWatermarks(file);
        if(!Array.isArray(marks)||!marks.length){result.textContent='Không nhận diện được dấu chìm hãng rõ ràng trong ảnh.';return;}
        result.innerHTML='<strong>Kết quả ước lượng từ AI</strong>'+marks.map(mark=>'<article class="studio-watermark-result"><b>'+esc(mark.brand)+'</b><span>'+esc(mark.mark_type)+' · '+esc(mark.location)+' · '+Math.round(Number(mark.confidence)*100)+'%</span><small>'+esc(mark.evidence)+'</small></article>').join('')+'<small>AI có thể nhầm logo, chữ hoặc vật thể; hãy kiểm tra bằng mắt.</small>';
      }catch(error){result.textContent=error.message||'Không nhận diện được dấu chìm. Hãy kiểm tra cài đặt AI và thử lại.';}
    });
  }

  function cropAndRotateNoop(){return null;}

  async function applyToPhotoLens(){
    if(!image||!cfg.onCapture){toast('Mở ảnh trước để áp dụng kết quả.');return;}
    const btn=q('#studioApply');btn.disabled=true;setStudioButtonLabel(btn,'Đang áp dụng…');
    try{
      let max=Number(q('#studioSize').value);if(!max)max=6000;
      const result=await renderProcessed(max,false),mime=q('#studioFormat').value,quality=Number(q('#studioQuality').value)/100;
      let blob=await new Promise(resolve=>result.toBlob(resolve,mime,quality));if(!blob)throw new Error('Không thể tạo ảnh đã chỉnh sửa.');
      if(q('#studioKeepMetadata').checked&&mime==='image/jpeg'&&file.type==='image/jpeg')blob=await preserveExif(file,blob);
      const ext=mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp',name=(file.name.replace(/\.[^.]+$/,'')||'photolens')+'-edited.'+ext;
      await cfg.onCapture(new File([blob],name,{type:mime,lastModified:Date.now()}));toast('Ảnh đã chỉnh sửa được đưa vào PhotoLens.');close();
    }catch(error){toast(error.message||'Không thể áp dụng ảnh.');}finally{if(!closed){btn.disabled=false;setStudioButtonLabel(btn,'Dùng ảnh đã chỉnh');}}
  }

  async function exportImage(){
    if(!image){toast('Hãy mở ảnh trước khi xuất.');return;}
    const btn=q('#studioExport');btn.disabled=true;setStudioButtonLabel(btn,'Đang xuất…');
    try{
      let max=Number(q('#studioSize').value);if(!max)max=6000;
      const result=await renderProcessed(max,false);const mime=q('#studioFormat').value,quality=Number(q('#studioQuality').value)/100;
      const blob=await new Promise(resolve=>result.toBlob(resolve,mime,quality));if(!blob)throw new Error('Không thể tạo tệp ảnh.');
      const keep=q('#studioKeepMetadata').checked&&mime==='image/jpeg'&&file.type==='image/jpeg';const finalBlob=keep?await preserveExif(file,blob):blob;
      const filename=(file.name.replace(/\.[^.]+$/,'')||'photolens')+'-edited.'+(mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp');
      await deliver(finalBlob,filename);toast('Ảnh đã xuất thành công.');
    }catch(error){toast(error.message||'Xuất ảnh thất bại.');}finally{btn.disabled=false;setStudioButtonLabel(btn,'Xuất ảnh');}
  }
  async function deliver(blob,filename){
    if(window.photolens&&window.photolens.saveFile){const data=await toBase64(blob);const r=await window.photolens.saveFile({filename,data});if(r&&r.canceled)throw new Error('Đã hủy lưu ảnh.');if(r&&r.error)throw new Error(r.error);return;}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function toBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});}
  async function makeBeforeAfterShare(){
    const max=1400,before=document.createElement('canvas'),scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
    before.width=Math.max(1,Math.round(image.naturalWidth*scale));before.height=Math.max(1,Math.round(image.naturalHeight*scale));
    before.getContext('2d').drawImage(image,0,0,before.width,before.height);
    const after=await renderProcessed(max,false),panelW=Math.max(before.width,after.width),panelH=Math.max(before.height,after.height),gap=20,labelH=54;
    const card=document.createElement('canvas');card.width=panelW*2+gap*3;card.height=panelH+labelH+gap*2;
    const ctx=card.getContext('2d');ctx.fillStyle='#101a24';ctx.fillRect(0,0,card.width,card.height);
    ctx.font='600 24px system-ui, sans-serif';ctx.fillStyle='#eaf3f5';ctx.textBaseline='middle';
    ctx.fillText('TRƯỚC',gap, gap+labelH/2);ctx.fillText('SAU',gap*2+panelW,gap+labelH/2);
    const contain=(src,x)=>{const k=Math.min(panelW/src.width,panelH/src.height),w=src.width*k,h=src.height*k;ctx.drawImage(src,x+(panelW-w)/2,gap+labelH+(panelH-h)/2,w,h);};
    contain(before,gap);contain(after,gap*2+panelW);
    ctx.fillStyle='#8cefc9';ctx.font='600 16px system-ui, sans-serif';ctx.fillText('PhotoLens · Analysis & Editor',gap,card.height-gap/2);
    return new Promise(resolve=>card.toBlob(resolve,'image/jpeg',.92));
  }
  async function shareImage(){
    if(!image){toast('Hãy mở ảnh trước khi chia sẻ.');return;}
    try{
      const beforeAfter=q('#studioShareMode').value==='before-after';
      const blob=beforeAfter?await makeBeforeAfterShare():await new Promise(resolve=>renderProcessed(3000,false).then(result=>result.toBlob(resolve,'image/jpeg',.92)));
      if(!blob)throw new Error('Không thể tạo ảnh chia sẻ.');
      const name=beforeAfter?'PhotoLens-truoc-sau.jpg':'PhotoLens-share.jpg',f=new File([blob],name,{type:'image/jpeg'});
      if(cfg.nativeShare&&await cfg.nativeShare(blob,name))return;
      if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:'PhotoLens'});
      else await deliver(blob,name);
    }catch(error){if(error.name!=='AbortError')toast(error.message||'Không thể chia sẻ ảnh.');}
  }
  async function preserveExif(original,output){
    const a=new Uint8Array(await original.arrayBuffer()),b=new Uint8Array(await output.arrayBuffer());if(a[0]!==255||a[1]!==216||b[0]!==255||b[1]!==216)throw new Error('Chỉ có thể giữ EXIF từ ảnh JPG.');
    let offset=2,segment=null;
    while(offset+4<a.length&&a[offset]===255){const marker=a[offset+1],len=(a[offset+2]<<8)|a[offset+3];if(marker===0xda)break;if(len<2||offset+2+len>a.length)break;if(marker===0xe1&&a[offset+4]===69&&a[offset+5]===120&&a[offset+6]===105&&a[offset+7]===102){segment=a.slice(offset,offset+2+len);break;}offset+=2+len;}
    if(!segment)throw new Error('Ảnh gốc không có EXIF để giữ.');const merged=new Uint8Array(b.length+segment.length);merged.set(b.slice(0,2),0);merged.set(segment,2);merged.set(b.slice(2),2+segment.length);return new Blob([merged],{type:'image/jpeg'});
  }
  async function saveProject(){
    if(!file||!image){toast('Mở ảnh trước rồi mới lưu dự án.');return;}
    try{const id=[file.name,file.size,file.lastModified].join('|');await dbAction('projects','readwrite','put',{id,name:file.name,blob:file,settings:deepCopy(state),watermarkLogo:watermarkLogoBlob,updatedAt:Date.now()});toast('Dự án đã lưu trên thiết bị này.');}
    catch(error){toast(error.message||'Không lưu được dự án cục bộ.');}
  }
  async function saveDraft(){if(!file||!state)return;try{const id=[file.name,file.size,file.lastModified].join('|');await dbAction('projects','readwrite','put',{id,name:file.name,blob:file,settings:deepCopy(state),watermarkLogo:watermarkLogoBlob,updatedAt:Date.now()});}catch{}}
  async function showProjects(){
    const layer=q('#studioModalLayer');layer.hidden=false;layer.innerHTML='<div class="studio-modal"><h2>Dự án lưu trên thiết bị này</h2><div id="studioProjectList" class="studio-project-list">Đang tải…</div><div class="studio-modal-actions"><button class="studio-action" id="studioProjectClose">Đóng</button></div></div>';
    q('#studioProjectClose').addEventListener('click',()=>{layer.hidden=true;layer.innerHTML='';});
    try{const all=await dbAction('projects','readonly','getAll');const list=q('#studioProjectList');list.innerHTML=all.length?all.sort((a,b)=>b.updatedAt-a.updatedAt).map(p=>'<button class="studio-project-item" data-project="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><span>'+new Date(p.updatedAt).toLocaleString()+'</span></button>').join(''):'<p>Chưa có dự án nào.</p>';
      list.querySelectorAll('[data-project]').forEach(b=>b.addEventListener('click',async()=>{const p=all.find(x=>x.id===b.dataset.project);if(p){try{await setSource(new File([p.blob],p.name,{type:p.blob.type||'image/jpeg'}),p.settings,p.watermarkLogo||null);layer.hidden=true;layer.innerHTML='';setView('editor');}catch(error){toast(error.message||'Không mở được dự án.');}}}));
    }catch(error){q('#studioProjectList').textContent=error.message;}
  }
  async function loadActiveLut(id){
    state.lutId=id||'none';if(state.lutId==='none'){activeLut=null;return;}
    if(lutMap.has(state.lutId)){activeLut=lutMap.get(state.lutId);return;}
    try{const lut=await dbAction('luts','readonly','get',state.lutId);if(lut){lut.data=lut.data instanceof Float32Array?lut.data:new Float32Array(lut.data);activeLut=lut;}else{activeLut=null;state.lutId='none';}}
    catch{activeLut=null;state.lutId='none';}
  }
  function favoriteSet(){try{return new Set(JSON.parse(localStorage.getItem('photolens_lut_favorites')||'[]'));}catch{return new Set();}}
  async function drawLutCards(){
    const grid=q('#studioLutGrid'),search=(q('#studioLutSearch').value||'').toLowerCase(),category=q('#studioLutCategory').value,favs=favoriteSet();
    try{customLuts=await dbAction('luts','readonly','getAll');}catch{customLuts=[];}
    const all=[...lookSpecs,...customLuts];const list=all.filter(x=>(!category||x.category===category)&&(x.name.toLowerCase().includes(search)||x.description.toLowerCase().includes(search)));
    grid.innerHTML=list.map(l=>'<article class="studio-lut-card '+(state.lutId===l.id?'selected':'')+'"><button class="studio-lut-apply" data-lut="'+esc(l.id)+'" '+(image?'':'disabled')+'><span class="studio-lut-swatch swatch-'+esc(l.id.replace(/[^a-z0-9]/gi,''))+'"></span><strong>'+esc(l.name)+'</strong><small>'+esc(l.category)+' · '+esc(l.description)+'</small></button><button class="studio-lut-favorite '+(favs.has(l.id)?'is-favorite':'')+'" data-favorite="'+esc(l.id)+'" aria-label="Yêu thích '+esc(l.name)+'">'+studioIcon('favorite')+'</button></article>').join('');
    grid.querySelectorAll('[data-lut]').forEach(b=>b.addEventListener('click',async()=>{if(!image){toast('Mở ảnh trước để xem trước LUT.');return;}state.lutId=b.dataset.lut;await loadActiveLut(state.lutId);commit();q('#studioLutStrength').value=state.lutStrength;drawLutCards();schedulePreview();}));
    grid.querySelectorAll('[data-favorite]').forEach(b=>b.addEventListener('click',()=>{const set=favoriteSet(),id=b.dataset.favorite;set.has(id)?set.delete(id):set.add(id);try{localStorage.setItem('photolens_lut_favorites',JSON.stringify([...set]));}catch{}drawLutCards();}));
  }
  async function importLut(e){
    const input=q('#studioLutFile'),f=input.files&&input.files[0];if(!f)return;
    try{const lut=parseCube(await f.text(),f.name);await dbAction('luts','readwrite','put',{id:lut.id,name:lut.name,category:lut.category,description:lut.description,size:lut.size,data:lut.data});customLuts.push(lut);state.lutId=lut.id;activeLut=lut;commit();drawLutCards();schedulePreview();toast('Đã nhập LUT '+lut.name+'.');}
    catch(error){toast(error.message||'Không nhập được LUT.');}finally{input.value='';}
  }
  function cameraStatus(text){q('#studioCameraStatus').textContent=text;}
  async function stopCamera(){if(mediaStream){mediaStream.getTracks().forEach(t=>t.stop());mediaStream=null;track=null;}const video=q('#studioVideo');if(video)video.srcObject=null;q('#studioCapture').disabled=true;}
  async function startCamera(deviceId=''){
    await stopCamera();q('#studioCameraEmpty').hidden=false;q('#studioNativeCapture').hidden=true;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){cameraStatus('Trình duyệt này không có API camera trực tiếp.');q('#studioNativeCapture').hidden=!cfg.nativeCapture;return;}
    try{
      const parts=q('#studioCameraResolution').value.split('x').map(Number),video={width:{ideal:parts[0]},height:{ideal:parts[1]}};
      if(deviceId)video.deviceId={exact:deviceId};else video.facingMode={ideal:'environment'};
      mediaStream=await navigator.mediaDevices.getUserMedia({video,audio:false});const v=q('#studioVideo');v.srcObject=mediaStream;await v.play();track=mediaStream.getVideoTracks()[0];q('#studioCameraEmpty').hidden=true;q('#studioCapture').disabled=false;
      const devices=await navigator.mediaDevices.enumerateDevices(),cameras=devices.filter(d=>d.kind==='videoinput'),select=q('#studioCameraDevice'),selected=track.getSettings().deviceId;
      select.innerHTML=cameras.map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||('Camera '+(i+1)))+'</option>').join('');if(selected)select.value=selected;
      renderCameraCapabilities();const settings=track.getSettings();cameraStatus('Camera hoạt động · '+(settings.width||'?')+'×'+(settings.height||'?')+' px. Điều khiển thủ công chỉ hiện khi được hỗ trợ.');
    }catch(error){await stopCamera();q('#studioCameraEmpty').hidden=false;const message=error&&error.name==='NotAllowedError'?'Bạn chưa cấp quyền camera. Hãy cho phép camera trong cài đặt trình duyệt rồi thử lại.':error&&error.name==='NotFoundError'?'Không tìm thấy camera trên thiết bị này.':'Không mở được camera. Hãy kiểm tra quyền truy cập và thử lại.';cameraStatus(message);q('#studioNativeCapture').hidden=!cfg.nativeCapture;}
  }
  function renderCameraCapabilities(){
    const host=q('#studioCameraAdvanced');host.innerHTML='';if(!track||!track.getCapabilities){cameraStatus('Camera hoạt động; trình duyệt không cung cấp điều khiển thủ công.');return;}
    let caps={};try{caps=track.getCapabilities()||{};}catch{}
    const addRange=(key,label,step)=>{const cap=caps[key];if(!cap||!Number.isFinite(cap.min)||!Number.isFinite(cap.max)||cap.min===cap.max)return;const input=document.createElement('input');input.type='range';input.min=cap.min;input.max=cap.max;input.step=step||((cap.max-cap.min)/100)||.01;input.value=(cap.min+cap.max)/2;const row=document.createElement('label');row.className='studio-range';row.innerHTML='<span>'+label+'</span><output>'+Number(input.value).toFixed(2)+'</output>';row.append(input);input.addEventListener('input',async()=>{row.querySelector('output').textContent=Number(input.value).toFixed(2);try{await track.applyConstraints({advanced:[{[key]:Number(input.value)}]});}catch{cameraStatus('Camera từ chối thông số này; hãy thử giá trị khác.');}});host.append(row);};
    addRange('zoom','Zoom',.05);addRange('exposureCompensation','Bù phơi sáng',.1);addRange('focusDistance','Khoảng lấy nét',.01);
    if(caps.torch===true || (Array.isArray(caps.torch)&&caps.torch.includes(true))){const l=document.createElement('label');l.className='studio-check';l.innerHTML='<input type="checkbox" id="studioTorch" /> Đèn flash';host.append(l);l.querySelector('input').addEventListener('change',e=>track.applyConstraints({advanced:[{torch:e.target.checked}]}).catch(()=>cameraStatus('Camera không bật được đèn flash.')));}
    const modes=caps.focusMode;if(Array.isArray(modes)&&modes.includes('single-shot'))cameraStatus('Camera hỗ trợ chạm để lấy nét.');else cameraStatus('Điều khiển khả dụng: '+([caps.zoom?'zoom':'',caps.exposureCompensation?'bù sáng':'',caps.focusDistance?'lấy nét':''].filter(Boolean).join(', ')||'tự động; không có điều khiển thủ công')+'.');
  }
  async function focusAtPoint(e){
    if(!track)return;const caps=track.getCapabilities&&track.getCapabilities();if(!caps||!Array.isArray(caps.focusMode)||!caps.focusMode.includes('single-shot'))return;
    const target=q('#studioFocusTarget'),rect=q('#studioCameraStage').getBoundingClientRect();target.hidden=false;target.style.left=(e.clientX-rect.left)+'px';target.style.top=(e.clientY-rect.top)+'px';setTimeout(()=>target.hidden=true,850);
    try{await track.applyConstraints({advanced:[{focusMode:'single-shot'}]});}catch{cameraStatus('Camera không áp dụng được lấy nét chạm.');}
  }
  async function captureCamera(){
    if(!track||!q('#studioVideo').videoWidth){toast('Camera chưa sẵn sàng.');return;}
    const timer=Number(q('#studioTimer').value);if(timer){q('#studioCapture').disabled=true;for(let i=timer;i>0;i--){q('#studioCapture').textContent='Chụp sau '+i+'…';await new Promise(r=>setTimeout(r,1000));}}
    const v=q('#studioVideo'),ratioParts=q('#studioCameraAspect').value.split(':').map(Number),ratio=ratioParts[0]/ratioParts[1];let sw=v.videoWidth,sh=v.videoHeight,sx=0,sy=0;
    if(sw/sh>ratio){const nw=sh*ratio;sx=(sw-nw)/2;sw=nw;}else{const nh=sw/ratio;sy=(sh-nh)/2;sh=nh;}
    const c=document.createElement('canvas');c.width=Math.round(sw);c.height=Math.round(sh);c.getContext('2d').drawImage(v,sx,sy,sw,sh,0,0,c.width,c.height);
    const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.94));q('#studioCapture').textContent='Chụp ảnh';q('#studioCapture').disabled=false;
    if(!blob){toast('Không thể chụp ảnh từ camera.');return;}const captured=new File([blob],'PhotoLens-'+Date.now()+'.jpg',{type:'image/jpeg'});
    if(cfg.onCapture)await cfg.onCapture(captured);close();
  }
  

  if(cfg.file){q('#studioFileName').textContent='Đang mở '+cfg.file.name+'…';void setSource(cfg.file).catch(error=>{q('#studioFileName').textContent='Không mở được ảnh';toast(error.message||'Không thể mở ảnh.');});}
  else{q('#studioEmpty').hidden=false;lastCommitted=snapshot();syncControls();}
  syncImageAvailability();
  syncExportControls();
  void loadActiveLut(state.lutId);
  void drawLutCards();
  drawCurve();
  updateHistoryButtons();
  if(cfg.startView==='camera')void setView('camera');

}
