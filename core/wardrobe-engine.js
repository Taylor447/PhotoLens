export const DB_NAME='photolens-wardrobe', DB_VERSION=1;
export const STATE_KEY='photolens_wardrobe_studio_v1', LEGACY_ITEMS='photolens_wardrobe_v1', LEGACY_LOOKS='photolens_outfits_v1';
export const MEASURE_KEYS=['shoulders','chest','waist','hips','sleeve','inseam','neck'];
export const CATEGORIES={tops:'Áo',bottoms:'Quần',skirts:'Váy',dresses:'Váy / đầm',outerwear:'Áo khoác',shoes:'Giày dép',hats:'Mũ',bags:'Túi',eyewear:'Kính',scarves:'Khăn',jewelry:'Trang sức',hair:'Phụ kiện tóc',accessories:'Phụ kiện'};
export const STYLES={minimal:'Tối giản',vintage:'Vintage',streetwear:'Streetwear',office:'Công sở',active:'Thể thao',traditional:'Truyền thống',cosplay:'Cosplay',classic:'Cổ điển',cinematic:'Điện ảnh',casual:'Thường ngày'};
const allowedCategories=new Set(Object.keys(CATEGORIES)),allowedStyles=new Set(Object.keys(STYLES)),text=(x,n=160)=>String(x??'').trim().slice(0,n),id=()=>globalThis.crypto?.randomUUID?.()||'ws-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),colorOk=x=>/^#[0-9a-f]{6}$/i.test(String(x||''));
const cm=x=>{const n=Number(x);return Number.isFinite(n)&&n>0&&n<=300?n:null;};
export function normalizeMeasures(v){if(!v||typeof v!=='object')return null;const out={};for(const k of MEASURE_KEYS){const n=cm(v[k]);if(n!==null)out[k]=n;}return Object.keys(out).length?out:null;}
function colorFamily(color){if(!colorOk(color))return'custom';const s=color.slice(1),r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<26)return'neutral';if(r>g*1.2&&r>b*1.2)return'warm';if(b>r*1.13&&b>g*1.07)return'blue';if(g>r*1.1&&g>b*1.03)return'green';if(r>g*1.16&&b>g*1.06)return'purple';if(r>g*1.2)return'red';return'custom';}
export function normalizeGarment(v={}){
 const category=allowedCategories.has(v.category)?v.category:'',name=text(v.name,100);if(!category||!name)return null;
 const styles=Array.isArray(v.styleTags)?v.styleTags.filter(x=>allowedStyles.has(x)):allowedStyles.has(v.style)?[v.style]:[];
 const season=['all','spring','summer','autumn','winter'].includes(v.season)?v.season:'all';
 const min=Number(v.temperatureC?.min),max=Number(v.temperatureC?.max),params=v.parameters||{};
 return {id:text(v.id,120)||id(),name,category,legacyCategory:['tops','bottoms','dresses','outerwear','shoes'].includes(category)?category:'accessories',layer:['base','mid','outer','accessory'].includes(v.layer)?v.layer:category==='outerwear'?'outer':['shoes','hats','bags','eyewear','scarves','jewelry','hair','accessories'].includes(category)?'accessory':'base',layerOrder:Number.isFinite(Number(v.layerOrder))?Number(v.layerOrder):20,color:colorOk(v.color)?v.color.toLowerCase():'#647d69',colorFamily:['neutral','blue','green','warm','red','purple'].includes(v.colorFamily)?v.colorFamily:colorFamily(v.color),patternId:(({'stripes':'thin-stripe','dots':'polka-small','check':'gingham'})[text(v.patternId||v.pattern,60)]||text(v.patternId||v.pattern,60)||'solid'),legacyPatternId:text(v.legacyPatternId||(['stripes','dots','check'].includes(v.pattern)?v.pattern:''),60)||null,materialId:text(v.materialId||v.material,60),fit:['slim','regular','relaxed','oversize','layered'].includes(v.fit)?v.fit:'regular',styleTags:[...new Set(styles)],season,temperatureC:{min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null},weather:{rain:typeof v.weather?.rain==='boolean'?v.weather.rain:null,wind:typeof v.weather?.wind==='boolean'?v.weather.wind:null},weatherTags:Array.isArray(v.weather)?[...new Set(v.weather.map(x=>text(x,30)).filter(Boolean))]:Array.isArray(v.weatherTags)?[...new Set(v.weatherTags.map(x=>text(x,30)).filter(Boolean))]:[],measurementsCm:normalizeMeasures(v.measurementsCm),notes:text(v.notes||v.note,1000),favorite:Boolean(v.favorite),isTemplate:Boolean(v.isTemplate),collections:Array.isArray(v.collections)?v.collections.map(x=>text(x,40)).filter(Boolean).slice(0,12):[],parameters:{neck:['crew','v','square','high'].includes(params.neck)?params.neck:'crew',sleeve:['short','long','sleeveless','wide'].includes(params.sleeve)?params.sleeve:'short',length:['short','regular','long'].includes(params.length)?params.length:'regular',width:['slim','regular','wide'].includes(params.width)?params.width:'regular',pleats:Math.max(0,Math.min(8,Number(params.pleats)||0))},shootingNotes:v.shootingNotes&&typeof v.shootingNotes==='object'?v.shootingNotes:{},imageAssetId:text(v.imageAssetId,120)||null,vectorAssetId:text(v.vectorAssetId,120)||null,createdAt:v.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
}
function parse(storage,key,fallback){try{return JSON.parse(storage?.getItem(key)||'null')??fallback;}catch{return fallback;}}
function cleanState(s={}){const unique=new Map();for(const raw of Array.isArray(s.items)?s.items:[]){const item=normalizeGarment(raw);if(item)unique.set(item.id,{...(unique.get(item.id)||{}),...item});}const looks=new Map();for(const x of Array.isArray(s.looks)?s.looks:[])if(x?.id&&x?.name&&Array.isArray(x.itemIds))looks.set(String(x.id),{...x,itemIds:[...new Set(x.itemIds.map(String))],tags:Array.isArray(x.tags)?x.tags.map(y=>text(y,40)).filter(Boolean):[]});return{schemaVersion:1,items:[...unique.values()],looks:[...looks.values()],assets:Array.isArray(s.assets)?s.assets:[]};}
function request(r){return new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function openDb(indexedDB){return new Promise((ok,no)=>{if(!indexedDB)return no(new Error('IndexedDB unavailable'));const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state');if(!db.objectStoreNames.contains('assets'))db.createObjectStore('assets',{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
export function createWardrobeRepository(storage=globalThis.localStorage,indexedDB=globalThis.indexedDB){
 let state=cleanState(parse(storage,STATE_KEY,{})),db=null,persistence='localStorage';const marker='photolens_wardrobe_v2_migrated';
 if(storage?.getItem(marker)!=='true'){
  for(const x of parse(storage,LEGACY_ITEMS,[])){const item=normalizeGarment({...x,patternId:x.pattern,legacyPatternId:['stripes','dots','check'].includes(x.pattern)?x.pattern:null,materialId:x.material,styleTags:x.style?[x.style]:[],weatherTags:Array.isArray(x.weather)?x.weather:[]});if(item&&!state.items.some(y=>y.id===item.id))state.items.push(item);}
  for(const x of parse(storage,LEGACY_LOOKS,[]))if(x?.id&&x?.name&&!state.looks.some(y=>y.id===x.id))state.looks.push({...x,tags:[],itemIds:Array.isArray(x.itemIds)?x.itemIds:[]});
  try{storage?.setItem(marker,'true');}catch{}
 }
 const persist=()=>{state=cleanState(state);try{storage?.setItem(STATE_KEY,JSON.stringify(state));}catch{}if(db)try{db.transaction('state','readwrite').objectStore('state').put(state,'snapshot');persistence='IndexedDB';}catch{}return state;};
 const ready=(async()=>{try{db=await openDb(indexedDB);const saved=await request(db.transaction('state','readonly').objectStore('state').get('snapshot'));if(saved){const disk=cleanState(saved),map=new Map(disk.items.map(x=>[x.id,x]));for(const x of state.items)if(!map.has(x.id))map.set(x.id,x);state={schemaVersion:1,items:[...map.values()],looks:[...disk.looks,...state.looks.filter(x=>!disk.looks.some(y=>y.id===x.id))],assets:[...disk.assets,...state.assets]};}persist();persistence='IndexedDB';return persistence;}catch{persist();return persistence;}})();
 return {ready,getPersistence:()=>persistence,snapshot:()=>structuredClone(state),listItems:()=>state.items.map(x=>({...x})),listLooks:()=>state.looks.map(x=>({...x,itemIds:x.itemIds.slice(),tags:[...(x.tags||[])]})),
 saveItem(v){const item=normalizeGarment(v);if(!item)return null;const i=state.items.findIndex(x=>x.id===item.id);if(i<0)state.items.unshift(item);else state.items[i]={...state.items[i],...item,createdAt:state.items[i].createdAt};persist();return item;},
 removeItem(itemId){state.items=state.items.filter(x=>x.id!==itemId);state.looks=state.looks.map(x=>({...x,itemIds:x.itemIds.filter(y=>y!==itemId)}));persist();return true;},
 saveLook(v){const name=text(v?.name,100);if(!name)return null;const itemIds=[...new Set((v.itemIds||[]).map(String))].filter(x=>state.items.some(y=>y.id===x));if(!itemIds.length)return null;const old=state.looks.find(x=>x.id===v.id),look={id:old?.id||text(v.id,120)||id(),name,itemIds,tags:Array.isArray(v.tags)?v.tags.map(x=>text(x,40)).filter(Boolean):old?.tags||[],createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};state.looks=old?state.looks.map(x=>x.id===old.id?look:x):[look,...state.looks];persist();return look;},
 duplicateLook(itemId){const old=state.looks.find(x=>x.id===itemId);return old?this.saveLook({name:old.name+' · bản sao',itemIds:old.itemIds,tags:old.tags}):null;},
 removeLook(itemId){state.looks=state.looks.filter(x=>x.id!==itemId);persist();return true;},
 async saveAsset(blob,meta={}){if(!db)await ready;if(!db)throw new Error('IndexedDB không khả dụng; không thể lưu tệp cục bộ.');if(!blob||typeof blob.arrayBuffer!=='function')throw new TypeError('Tài sản phải là Blob hoặc File.');const asset={id:id(),blob,type:blob.type||'',name:text(meta.name||'Tệp cá nhân',100),createdAt:new Date().toISOString()};await request(db.transaction('assets','readwrite').objectStore('assets').put(asset));state.assets.push({id:asset.id,type:asset.type,name:asset.name});persist();return asset.id;},
 async getAsset(assetId){if(!db)await ready;return db?request(db.transaction('assets','readonly').objectStore('assets').get(assetId)):null;}
 };
}
export function classifyWardrobeAsset(name='',type='',size=0){
 if(!Number.isFinite(size)||size<=0||size>12*1024*1024)return null;
 const ext=String(name).toLowerCase().split('.').pop(),mime=String(type).toLowerCase().split(';')[0].trim();
 const matches=(allowed)=>!mime||allowed.includes(mime);
 if(ext==='png'&&matches(['image/png']))return'image';
 if((ext==='jpg'||ext==='jpeg')&&matches(['image/jpeg']))return'image';
 if(ext==='webp'&&matches(['image/webp']))return'image';
 if(ext==='svg'&&matches(['image/svg+xml','text/xml','application/xml','text/plain']))return'svg';
 if(ext==='glb'&&matches(['model/gltf-binary','application/octet-stream']))return'glb';
 return null;
}
export function hasSupportedImageHeader(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
 return (b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))
  ||(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)
  ||(b.length>=12&&b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80);
}
export function validGlbHeader(bytes,totalLength=bytes?.byteLength){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
 if(b.length<12||totalLength<20)return false;
 const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 return view.getUint32(0,true)===0x46546c67&&view.getUint32(4,true)===2&&view.getUint32(8,true)===totalLength&&totalLength%4===0;
}
export function filterGarments(items=[],filters={},weather={}){
 const q=text(filters.query,100).toLocaleLowerCase('vi');
 return items.filter(x=>{
  if(filters.category&&filters.category!=='all'&&x.category!==filters.category)return false;
  if(filters.style&&filters.style!=='all'&&!x.styleTags?.includes(filters.style))return false;
  if(filters.material&&filters.material!=='all'&&x.materialId!==filters.material)return false;
  if(filters.pattern&&filters.pattern!=='all'&&x.patternId!==filters.pattern)return false;
  if(filters.color&&filters.color!=='all'&&x.colorFamily!==filters.color)return false;
  if(filters.season&&filters.season!=='all'&&x.season!=='all'&&x.season!==filters.season)return false;
  if(filters.favorite==='favorites'&&!x.favorite)return false;
  if(filters.collection&&filters.collection!=='all'&&!(x.collections||[]).includes(filters.collection))return false;
  const temp=Number(weather.temp);if(filters.weather==='current'&&Number.isFinite(temp)&&x.temperatureC?.min!=null&&temp<x.temperatureC.min)return false;if(filters.weather==='current'&&Number.isFinite(temp)&&x.temperatureC?.max!=null&&temp>x.temperatureC.max)return false;
  if(filters.weather==='rainy'&&(x.weather?.rain===false||(!x.weather?.rain&&x.weatherTags?.length&&!x.weatherTags.includes('rainy')&&!x.weatherTags.includes('all'))))return false;if(filters.weather==='windy'&&(x.weather?.wind===false||(!x.weather?.wind&&x.weatherTags?.length&&!x.weatherTags.includes('windy')&&!x.weatherTags.includes('all'))))return false;
  return !q||[x.name,x.category,x.materialId,x.patternId,...(x.styleTags||[]),...(x.weatherTags||[]),...(x.collections||[]),x.notes].join(' ').toLocaleLowerCase('vi').includes(q);
 });
}
export function calculateFit(body={},garment={}){
 const b=normalizeMeasures(body),g=normalizeMeasures(garment.measurementsCm);if(!b||!g)return{available:false,details:[],message:'Chưa có đủ số đo do người dùng tự nhập.'};
 const details=MEASURE_KEYS.filter(k=>b[k]!=null&&g[k]!=null).map(key=>({key,bodyCm:b[key],garmentCm:g[key],easeCm:Number((g[key]-b[key]).toFixed(1))}));return{available:Boolean(details.length),details,message:details.length?'So sánh số đo nhập tay; không bảo đảm độ vừa thật.':'Chưa có dữ liệu đo tương ứng.'};
}
export function chooseSize(body={},table=[]){const rows=(table||[]).filter(x=>normalizeMeasures(x.measurementsCm));if(!rows.length)return{size:null,reason:'Chưa có bảng size hoặc số đo.'};const ranked=rows.map(x=>({size:x.size,score:calculateFit(body,{measurementsCm:x.measurementsCm}).details.reduce((n,y)=>n+Math.abs(y.easeCm),0)})).sort((a,b)=>a.score-b.score);return{size:ranked[0]?.size||null,reason:'Chọn theo số đo nhập tay; không bảo đảm vừa thật.'};}
export function contrastRatio(fg,bg){const lum=c=>{if(!colorOk(c))return null;const a=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];},a=lum(fg),b=lum(bg);return a===null||b===null?null:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2));}
export function colorHarmony(items=[]){
 const hues=items.map(x=>{if(!colorOk(x.color))return null;const r=parseInt(x.color.slice(1,3),16)/255,g=parseInt(x.color.slice(3,5),16)/255,b=parseInt(x.color.slice(5,7),16)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(d<.08)return null;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return((h*60)+360)%360;}).filter(x=>x!==null);
 if(hues.length<2)return{scheme:'Trung tính hoặc một màu',confidence:'low'};
 const diffs=[];for(let i=0;i<hues.length;i++)for(let j=i+1;j<hues.length;j++){const d=Math.abs(hues[i]-hues[j]);diffs.push(Math.min(d,360-d));}
 const sorted=diffs.sort((a,b)=>a-b),mean=diffs.reduce((a,b)=>a+b,0)/diffs.length;
 if(sorted.every(x=>x<18))return{scheme:'Đơn sắc',confidence:'medium'};
 if(sorted.every(x=>x<48))return{scheme:'Tương đồng',confidence:'medium'};
 if(sorted.some(x=>x>=150&&x<=210))return{scheme:'Bổ túc',confidence:'medium'};
 if(hues.length>=3&&sorted.some(x=>x>=100&&x<=140))return{scheme:'Bộ ba / đa sắc',confidence:'low'};
 return{scheme:mean>100?'Tương phản pha trộn':'Phối màu tự do',confidence:'low'};
}
export function scoreLook(items=[],context={}){
 if(!items.length)return{score:0,reasons:['Chọn ít nhất một món.'],warnings:[]};
 let score=60,reasons=[],warnings=[];
 const patterns=items.filter(x=>x.patternId&&x.patternId!=='solid'),cats=items.map(x=>x.category),harmony=colorHarmony(items);
 if(items.length>=2){score+=5;reasons.push('Có nhiều lớp hoặc món phối cùng nhau.');}
 if(new Set(cats).size<cats.length){score-=4;warnings.push('Có nhiều món cùng danh mục; kiểm tra thứ tự lớp.');}
 if(items.some(x=>x.fit==='oversize')&&items.some(x=>x.fit==='slim')){score+=6;reasons.push('Tỉ lệ rộng/ôm được cân bằng theo nhãn bạn chọn.');}
 reasons.push('Hòa sắc tham khảo: '+harmony.scheme+'; đây là quy tắc màu cơ bản, không phải đánh giá thẩm mỹ.');
 const ratio=items.map(x=>contrastRatio(x.color,context.background||'#56736f')).filter(Number.isFinite);
 if(ratio.some(x=>x>=3)){score+=8;reasons.push('Ít nhất một màu có tương phản nền từ 3:1 trở lên.');}else reasons.push('Tương phản nền dưới 3:1 hoặc chưa đủ dữ liệu; kiểm tra ảnh thật.');
 if(patterns.length>1){score-=8;warnings.push('Có nhiều họa tiết cùng lúc; cân nhắc giữ một họa tiết nổi bật.');}else reasons.push('Số họa tiết được giữ gọn.');
 if(items.some(x=>x.shootingNotes?.moireRisk)){score-=5;warnings.push('Họa tiết nhỏ có thể tạo moiré.');}
 if(items.some(x=>x.shootingNotes?.reflective===true))warnings.push('Có món phản quang theo ghi chú dữ liệu.');
 if(items.some(x=>x.shootingNotes?.highlight===true||x.shootingNotes?.highlight==='high'))warnings.push('Có thể cháy sáng theo ghi chú dữ liệu.');
 const temp=Number(context.temperatureC);
 if(Number.isFinite(temp)){
  if(temp<15&&!items.some(x=>x.layer==='outer'||x.season==='winter')){score-=6;warnings.push('Trời lạnh nhưng chưa có lớp ngoài được ghi nhận.');}
  if(items.some(x=>(x.temperatureC?.min!=null&&temp<x.temperatureC.min)||(x.temperatureC?.max!=null&&temp>x.temperatureC.max)))warnings.push('Một số món nằm ngoài khoảng nhiệt độ được ghi nhận.');
 }
 if(Number(context.precipitationMm)>0&&!items.some(x=>x.weather?.rain===true))warnings.push('Có mưa nhưng chưa có dữ liệu xác nhận khả năng chịu mưa của bộ đồ.');
 if(Number(context.windKmh)>30&&!items.some(x=>x.weather?.wind===true))warnings.push('Gió mạnh nhưng chưa có dữ liệu xác nhận khả năng cản gió.');
 return{score:Math.max(0,Math.min(100,Math.round(score))),reasons,warnings,harmony};
}
export function resolveStudioMode(mode,webgl=true){return mode==='3d'&&webgl?'3d':'2d';}
export function reconcileLook(items=[],ids=[]){const map=new Map(items.map(x=>[x.id,x]));return [...new Set(ids)].map(x=>map.get(x)).filter(Boolean).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));}
export function inspectTemplateBounds(template,preset){const keys=['heightCm','shoulderCm','chestCm','waistCm','hipCm'];const measurable=keys.every(x=>Number.isFinite(Number(preset?.[x])));const clearance=Number(template?.virtualShellClearanceCm??1.5)*Number(preset?.heightCm||170)/170;return{measurable,clearanceCm:Number(clearance.toFixed(2)),violates:measurable&&clearance<=0,method:'procedural shell margin proxy; not triangle intersection'};}
export function applyOutfitAction(items=[],seed=1){let n=(Number(seed)||1)>>>0;const rand=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);const groups=new Map();for(const x of items){if(!groups.has(x.category))groups.set(x.category,[]);groups.get(x.category).push(x);}return[...groups.values()].map(a=>a[Math.floor(rand()*a.length)]).slice(0,8);}
export function buildSvgLook(items=[],options={}){
 const bg=colorOk(options.background)?options.background:'#f2f6f4',tone=colorOk(options.mannequinTone)?options.mannequinTone:'#9ba5a2';
 const pose=options.pose==='lean'?'translate(8 0) rotate(-4 205 220)':options.pose==='step'?'skewX(-3)':options.pose==='sitting'?'translate(0 16) scale(1 .94)':'';
 const human='<g fill="'+tone+'" opacity=".68"><circle cx="205" cy="64" r="24"/><path d="M184 91Q205 80 226 91L242 230L228 250L225 340L240 390H215L199 285L190 390H164L181 340L178 250L160 230Z"/><path d="M178 117 145 215m52-98 29 98M180 250 166 326m46-76 22 76" fill="none" stroke="'+tone+'" stroke-width="14" stroke-linecap="round"/></g>';
 const defs='<defs><pattern id="ws-stripe" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0V12" stroke="#fff" stroke-opacity=".55" stroke-width="3"/></pattern><pattern id="ws-check" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0H18M0 0V18" stroke="#fff" stroke-opacity=".45" stroke-width="2"/></pattern><pattern id="ws-dot" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#fff" fill-opacity=".7"/></pattern><pattern id="ws-wave" width="24" height="14" patternUnits="userSpaceOnUse"><path d="M0 7Q6 0 12 7T24 7" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></pattern></defs>';
 const pathFor=(x)=>{switch(x.category){
  case'tops':case'outerwear':return'M165 112Q205 94 245 112L270 220L245 230L235 175L230 270L180 270L175 175L165 230L140 220Z';
  case'bottoms':return'M172 245L238 245L250 390L215 390L205 285L195 390L160 390Z';
  case'skirts':return'M170 245Q205 260 240 245L280 370Q205 390 130 370Z';
  case'dresses':return'M174 112Q205 95 236 112L245 270Q275 330 278 375Q205 394 132 375Q137 330 165 270Z';
  case'shoes':return'M150 385h44l-5 18h-66q0-14 27-18Zm28 0h44l27 18q0 14-68 0Z';
  case'hats':return'M165 74Q205 35 245 74L240 103H170Z';
  case'bags':return'M167 145h76v85h-76zM185 145q0-28 20-28t20 28';
  case'eyewear':return'M166 77h35v28h-35zM209 77h35v28h-35zM201 88h8';
  case'scarves':return'M176 110q29 2 52 0l-8 116-22-1z';
  case'jewelry':case'hair':return'M180 78q25-22 50 0v12q-25-12-50 0z';
  default:return'M180 145h50v50h-50z';
 }};
 const patternFor=(id)=>['thin-stripe','wide-stripe','pinstripe','vertical-stripe','horizontal-stripe'].includes(id)?'ws-stripe':['gingham','plaid','windowpane','check','herringbone'].includes(id)?'ws-check':['polka-small','polka-large','dots','stars','floral-small'].includes(id)?'ws-dot':['wave','zigzag','scallop'].includes(id)?'ws-wave':'';
 const sorted=items.slice().sort((x,y)=>(x.layerOrder||0)-(y.layerOrder||0));
 const shapes=sorted.map((x,i)=>{const c=colorOk(x.color)?x.color:'#647d69',d=pathFor(x),width=x.parameters?.width==='wide'?1.12:x.parameters?.width==='slim'?.9:1,length=x.parameters?.length==='long'?1.1:x.parameters?.length==='short'?.9:1;
  const tx=options.flatLay?[55,155,255,355][i%4]:205,ty=options.flatLay?(i<4?120:300):230,scale=options.flatLay?0.38:1;
  const body=x.category==='tops'||x.category==='outerwear';
  const neckline=body?'<path d="'+(x.parameters?.neck==='v'?'M188 106 205 130 222 106':x.parameters?.neck==='square'?'M188 108v14h34v-14':x.parameters?.neck==='high'?'M190 105h30v9h-30':'M190 108q15 14 30 0')+'" fill="none" stroke="#fff" stroke-opacity=".58" stroke-width="3"/>':'';
  const extras=x.category==='outerwear'?'<path d="M205 111v145m-7-112h2m-2 20h2m-2 20h2" stroke="#fff" stroke-opacity=".65" stroke-width="3"/>':'';
  const pat=patternFor(x.patternId);
  return'<g transform="translate('+tx+' '+ty+') scale('+scale*width+' '+scale*length+') translate(-205 -230)"><path data-garment="'+text(x.id,80).replace(/[^\w-]/g,'')+'" d="'+d+'" fill="'+c+'" stroke="#52625e" stroke-width="3" vector-effect="non-scaling-stroke"/> '+(pat?'<path d="'+d+'" fill="url(#'+pat+')" opacity=".9"/>':'')+neckline+extras+'</g>';
 }).join('');
 const flatHint=options.flatLay?'<text x="205" y="425" text-anchor="middle" fill="#52625e" font-size="14">Bày phẳng · bố cục minh họa</text>':'<text x="205" y="425" text-anchor="middle" fill="#52625e" font-size="14">Mô phỏng 2D · tham khảo, không phải rập may</text>';
 return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 450" role="img" aria-label="'+(options.flatLay?'Bố cục trang phục flat-lay':'Mannequin và trang phục minh họa')+'" style="width:100%;height:100%">'+defs+'<rect width="410" height="450" rx="24" fill="'+bg+'"/>'+(!options.flatLay?'<g transform="'+pose+'">'+human+'</g>':'')+'<g transform="'+pose+'">'+shapes+'</g>'+flatHint+'</svg>';
}
export function safeSvgText(s){
 if(typeof s!=='string'||s.length>2_000_000)return null;
 let v=s.replace(/<!--[\s\S]*?-->/g,'').replace(/<\?xml[^>]*>/gi,'').replace(/<!DOCTYPE[\s\S]*?>/gi,'');
 v=v.replace(/<(script|foreignObject|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<(script|foreignObject|iframe|object|embed|style)\b[^>]*\/?\s*>/gi,'');
 v=v.replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'').replace(/\s+srcset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
 v=v.replace(/\s+(?:href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,(attr,a,b,c)=>{const value=a??b??c??'';return /^#[A-Za-z_][\w:.-]*$/.test(value)?' href="'+value+'"':'';});
 v=v.replace(/\s+(?:filter|mask|clip-path|fill|stroke)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,(attr,a,b,c)=>{const value=a??b??c??'';return /url\(/i.test(value)&&!/^url\(\s*['"]?#[A-Za-z_][\w:.-]*['"]?\s*\)$/i.test(value)?attr.replace(value,'none'):attr;});
 return /<svg[\s>]/i.test(v)&&!/<\s*svg\b[^>]*\b(?:onload|onerror)\s*=/i.test(v)?v:null;
}