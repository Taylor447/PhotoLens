export const DB_NAME='photolens-wardrobe', DB_VERSION=1;
export const STATE_KEY='photolens_wardrobe_studio_v1', LEGACY_ITEMS='photolens_wardrobe_v1', LEGACY_LOOKS='photolens_outfits_v1';
import {MEASURE_KEYS,normalizeMeasures,normalizeSizeTable,calculateFit,chooseSize} from './fit/measurements.js';
export {MEASURE_KEYS,normalizeMeasures,normalizeSizeTable,calculateFit,chooseSize};
export const CATEGORIES={tops:'Áo',bottoms:'Quần',skirts:'Váy',dresses:'Váy / đầm',outerwear:'Áo khoác',shoes:'Giày dép',hats:'Mũ',bags:'Túi',eyewear:'Kính',scarves:'Khăn',jewelry:'Trang sức',hair:'Phụ kiện tóc',accessories:'Phụ kiện'};
export const STYLES={minimal:'Tối giản',vintage:'Vintage',streetwear:'Streetwear',office:'Công sở',active:'Thể thao',traditional:'Truyền thống',cosplay:'Cosplay',classic:'Cổ điển',cinematic:'Điện ảnh',casual:'Thường ngày'};
const allowedCategories=new Set(Object.keys(CATEGORIES)),allowedStyles=new Set(Object.keys(STYLES)),text=(x,n=160)=>String(x??'').trim().slice(0,n),id=()=>globalThis.crypto?.randomUUID?.()||'ws-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),colorOk=x=>/^#[0-9a-f]{6}$/i.test(String(x||''));
function colorFamily(color){if(!colorOk(color))return'custom';const s=color.slice(1),r=parseInt(s.slice(0,2),16),g=parseInt(s.slice(2,4),16),b=parseInt(s.slice(4,6),16),mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<26)return'neutral';if(r>g*1.2&&r>b*1.2)return'warm';if(b>r*1.13&&b>g*1.07)return'blue';if(g>r*1.1&&g>b*1.03)return'green';if(r>g*1.16&&b>g*1.06)return'purple';if(r>g*1.2)return'red';return'custom';}
export function normalizeGarment(v={}){
 const category=allowedCategories.has(v.category)?v.category:'',name=text(v.name,100);if(!category||!name)return null;
 const styles=Array.isArray(v.styleTags)?v.styleTags.filter(x=>allowedStyles.has(x)):allowedStyles.has(v.style)?[v.style]:[];
 const season=['all','spring','summer','autumn','winter'].includes(v.season)?v.season:'all';
 const temp=value=>value==null||value===''?null:Number(value);
 const min=temp(v.temperatureC?.min),max=temp(v.temperatureC?.max),params=v.parameters||{};
 return {id:text(v.id,120)||id(),name,category,legacyCategory:['tops','bottoms','dresses','outerwear','shoes'].includes(category)?category:'accessories',layer:['base','mid','outer','accessory'].includes(v.layer)?v.layer:category==='outerwear'?'outer':['shoes','hats','bags','eyewear','scarves','jewelry','hair','accessories'].includes(category)?'accessory':'base',layerOrder:Number.isFinite(Number(v.layerOrder))?Number(v.layerOrder):20,color:colorOk(v.color)?v.color.toLowerCase():'#647d69',colorFamily:['neutral','blue','green','warm','red','purple'].includes(v.colorFamily)?v.colorFamily:colorFamily(v.color),patternId:(({'stripes':'thin-stripe','dots':'polka-small','check':'gingham'})[text(v.patternId||v.pattern,60)]||text(v.patternId||v.pattern,60)||'solid'),legacyPatternId:text(v.legacyPatternId||(['stripes','dots','check'].includes(v.pattern)?v.pattern:''),60)||null,materialId:text(v.materialId||v.material,60),fit:['slim','regular','relaxed','oversize','layered'].includes(v.fit)?v.fit:'regular',styleTags:[...new Set(styles)],season,temperatureC:{min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null},weather:{rain:typeof v.weather?.rain==='boolean'?v.weather.rain:null,wind:typeof v.weather?.wind==='boolean'?v.weather.wind:null},weatherTags:Array.isArray(v.weather)?[...new Set(v.weather.map(x=>text(x,30)).filter(Boolean))]:Array.isArray(v.weatherTags)?[...new Set(v.weatherTags.map(x=>text(x,30)).filter(Boolean))]:[],measurementsCm:normalizeMeasures(v.measurementsCm),sizeTable:normalizeSizeTable(v.sizeTable),sizeTableVersion:text(v.sizeTableVersion,40)||null,measurementSource:text(v.measurementSource,200)||null,notes:text(v.notes||v.note,1000),favorite:Boolean(v.favorite),isTemplate:Boolean(v.isTemplate),collections:Array.isArray(v.collections)?v.collections.map(x=>text(x,40)).filter(Boolean).slice(0,12):[],parameters:{neck:['crew','v','square','high'].includes(params.neck)?params.neck:'crew',sleeve:['short','long','sleeveless','wide'].includes(params.sleeve)?params.sleeve:'short',length:['short','regular','long'].includes(params.length)?params.length:'regular',width:['slim','regular','wide'].includes(params.width)?params.width:'regular',pleats:Math.max(0,Math.min(8,Number(params.pleats)||0))},shootingNotes:v.shootingNotes&&typeof v.shootingNotes==='object'?v.shootingNotes:{},imageAssetId:text(v.imageAssetId,120)||null,vectorAssetId:text(v.vectorAssetId,120)||null,createdAt:v.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
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
 if(!items.length)return{score:0,reasons:['Chọn ít nhất một món.'],warnings:[],harmony:colorHarmony([])};
 let score=60,reasons=['Điểm quy tắc tham khảo 0–100 dựa trên dữ liệu hiện có; không đánh giá cơ thể hoặc bảo đảm kết quả ảnh.'],warnings=[],cats=items.map(x=>x.category),harmony=colorHarmony(items);
 if(items.length>=2){score+=5;reasons.push('Có nhiều món phối cùng nhau.');}
 if(new Set(cats).size<cats.length){score-=4;warnings.push('Có nhiều món cùng danh mục; kiểm tra cách xếp lớp.');}
 const upper=items.filter(x=>['tops','outerwear'].includes(x.category)),lower=items.filter(x=>['bottoms','skirts'].includes(x.category));
 const upperWide=upper.some(x=>x.fit==='oversize'),lowerWide=lower.some(x=>x.fit==='oversize'),lowerFitted=lower.some(x=>['slim','regular'].includes(x.fit));
 if(upperWide&&lowerFitted){score+=6;reasons.push('Tỉ lệ áo rộng và phần dưới gọn dựa trên nhãn fit đã có.');}
 else if(upperWide&&lowerWide){score-=5;warnings.push('Cả phần trên và phần dưới đều được gắn nhãn oversize; thử cân bằng độ rộng.');}
 else reasons.push('Chưa có đủ nhãn fit để đánh giá tỉ lệ; có thể chỉnh thủ công.');
 reasons.push('Hòa sắc tham khảo: '+harmony.scheme+'; quy tắc màu trung tính, không phải đánh giá thẩm mỹ.');
 const ratio=items.map(x=>contrastRatio(x.color,context.background||'#56736f')).filter(Number.isFinite);
 if(ratio.some(x=>x>=3)){score+=8;reasons.push('Ít nhất một màu có tương phản nền từ 3:1 trở lên.');}
 else reasons.push('Tương phản màu với nền dưới 3:1 hoặc chưa đủ dữ liệu; hãy xem ảnh thật.');
 const largePatterns=items.filter(x=>{const id=String(x.patternId||'').toLowerCase();return x.parameters?.patternScale==='large'||['wide-stripe','polka-large','floral-large','large-check'].includes(id)||id.includes('large');});
 const patternCount=items.filter(x=>x.patternId&&x.patternId!=='solid').length;
 if(largePatterns.length>=2){score-=9;warnings.push('Có từ hai họa tiết lớn được ghi nhận; cân nhắc giữ một họa tiết lớn.');}
 else if(patternCount>1){score-=4;warnings.push('Có nhiều họa tiết cùng lúc; xem trước để tránh cạnh tranh thị giác.');}
 else reasons.push('Số họa tiết được giữ gọn.');
 if(items.some(x=>x.shootingNotes?.moireRisk)){score-=5;warnings.push('Họa tiết nhỏ có thể tạo moiré.');}
 if(items.some(x=>x.shootingNotes?.reflective===true))warnings.push('Có món phản quang theo ghi chú dữ liệu.');
 if(items.some(x=>x.shootingNotes?.wrinkle===true))warnings.push('Có món dễ nhăn theo ghi chú dữ liệu.');
 if(items.some(x=>x.shootingNotes?.highlight===true||x.shootingNotes?.highlight==='high'))warnings.push('Có thể cháy sáng theo ghi chú dữ liệu.');
 const layerRank={base:0,mid:1,outer:2};let layerError=false;
 for(const a of items)for(const b of items)if(layerRank[a.layer]!=null&&layerRank[b.layer]!=null&&layerRank[a.layer]<layerRank[b.layer]&&Number(a.layerOrder)>Number(b.layerOrder))layerError=true;
 if(layerError){warnings.push('Thứ tự lớp đang đảo: lớp ngoài nằm dưới lớp trong.');score-=5;}
 const dressCode=String(context.dressCode||'').toLowerCase(),dressStyles={formal:['office','classic','minimal'],office:['office','classic','minimal'],casual:['casual','streetwear','classic'],sport:['active'],traditional:['traditional'],cosplay:['cosplay']};
 if(dressStyles[dressCode]){const known=items.flatMap(x=>x.styleTags||[]);if(known.length&&!known.some(x=>dressStyles[dressCode].includes(x)))warnings.push('Phong cách được ghi nhận chưa khớp dress code '+dressCode+'.');else if(!known.length)warnings.push('Chưa có thẻ phong cách để kiểm tra dress code.');}
 const genre=String(context.genre||'').toLowerCase(),styles=items.flatMap(x=>x.styleTags||[]);
 if(genre==='cosplay'&&styles.length&&!styles.includes('cosplay'))warnings.push('Chưa có thẻ cosplay trên món đang chọn.');
 if(['portrait','night','moon'].includes(genre)&&items.some(x=>x.shootingNotes?.reflective===true))warnings.push('Phản quang có thể bắt sáng mạnh trong bối cảnh chân dung/đêm.');
 const temp=context.temperatureC===null||context.temperatureC===undefined||context.temperatureC===''?null:Number(context.temperatureC);
 if(Number.isFinite(temp)){
  if(temp<15&&!items.some(x=>x.layer==='outer'||x.temperatureC?.min!=null&&x.temperatureC.min<=temp)){score-=6;warnings.push('Trời lạnh nhưng chưa có lớp ngoài hoặc khoảng nhiệt độ phù hợp được xác nhận.');}
  if(temp>=28&&items.some(x=>['wool','wool-blend','heavy-knit'].includes(x.materialId))){score-=3;warnings.push('Chất liệu dày được ghi nhận có thể không phù hợp trời nóng.');}
  if(items.some(x=>(x.temperatureC?.min!=null&&temp<x.temperatureC.min)||(x.temperatureC?.max!=null&&temp>x.temperatureC.max)))warnings.push('Một số món nằm ngoài khoảng nhiệt độ được ghi nhận.');
 }
 if(Number(context.precipitationMm)>0&&!items.some(x=>x.weather?.rain===true))warnings.push('Có mưa nhưng chưa có dữ liệu xác nhận khả năng chịu mưa của bộ đồ.');
 if(Number(context.windKmh)>30&&!items.some(x=>x.weather?.wind===true))warnings.push('Gió mạnh nhưng chưa có dữ liệu xác nhận khả năng cản gió.');
 return{score:Math.max(0,Math.min(100,Math.round(score))),reasons,warnings:[...new Set(warnings)],harmony};
}
export function composeRuleOutfit(pool=[],options={}){
 let state=(Number(options.seed)||1)>>>0;const random=()=>((state=(state*1664525+1013904223)>>>0)/4294967296),pick=list=>list.length?list[Math.floor(random()*list.length)]:null,available=pool.filter(x=>x&&x.id);
 if(options.mode==='capsule')return buildCapsule(available,options.limit||8);
 const anchor=options.anchor||null,current=options.current||[],byCategory=new Map();for(const x of available){if(!byCategory.has(x.category))byCategory.set(x.category,[]);byCategory.get(x.category).push(x);}
 if(options.mode==='variation'&&current.length){const out=current.slice(),i=Math.floor(random()*out.length),old=out[i],alt=pick((byCategory.get(old.category)||[]).filter(x=>x.id!==old.id));if(alt)out[i]=alt;return out.sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));}
 const choose=(cat)=>{const rows=byCategory.get(cat)||[];return anchor?.category===cat?anchor:pick(rows);},weather=options.weather||{},temp=weather.temp===null||weather.temp===undefined||weather.temp===''?null:Number(weather.temp),mustOuter=Boolean(options.includeOuter)||Number.isFinite(temp)&&temp<15;
 let out=[];const anchorCategory=anchor?.category;
 if(anchorCategory==='dresses')out=[anchor];else if(['tops','bottoms','skirts','outerwear'].includes(anchorCategory)){if(anchorCategory==='tops')out.push(anchor,choose(pick(['bottoms','skirts'])));else if(anchorCategory==='bottoms'||anchorCategory==='skirts')out.push(choose('tops'),anchor);else out.push(anchor,choose(pick(['tops','bottoms','skirts'])));}
 else{const dress=pick(byCategory.get('dresses')||[]);if(dress&&random()<.35)out=[dress];else out=[choose('tops'),choose(pick(['bottoms','skirts']))];}
 if(mustOuter&&!out.some(x=>x?.layer==='outer'))out.push(choose('outerwear'));
 if(!out.some(x=>x?.category==='shoes'))out.push(choose('shoes'));
 const accessory=pick((available.filter(x=>x.layer==='accessory'&&!['shoes'].includes(x.category))));if(accessory)out.push(accessory);
 return [...new Map(out.filter(Boolean).map(x=>[x.id,x])).values()].sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));
}
export function buildCapsule(items=[],limit=8){
 const priority=['tops','bottoms','skirts','outerwear','shoes','dresses','bags','hats','scarves','accessories','eyewear','jewelry','hair'],picked=[],seen=new Set();
 for(const cat of priority){const rows=items.filter(x=>x.category===cat).slice().sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));if(!rows.length)continue;const candidate=rows.find(x=>!seen.has(x.materialId+':'+x.patternId))||rows[0];picked.push(candidate);seen.add(candidate.materialId+':'+candidate.patternId);if(picked.length>=Math.max(1,Math.min(16,Number(limit)||8)))break;}
 return picked;
}
export function resolveStudioMode(mode,webgl=true){return mode==='3d'&&webgl?'3d':'2d';}
export function reconcileLook(items=[],ids=[]){const map=new Map(items.map(x=>[x.id,x]));return [...new Set(ids)].map(x=>map.get(x)).filter(Boolean).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));}
export function inspectTemplateBounds(template,preset){const keys=['heightCm','shoulderCm','chestCm','waistCm','hipCm'];const measurable=keys.every(x=>Number.isFinite(Number(preset?.[x])));const clearance=Number(template?.virtualShellClearanceCm??1.5)*Number(preset?.heightCm||170)/170;return{measurable,clearanceCm:Number(clearance.toFixed(2)),violates:measurable&&clearance<=0,method:'procedural shell margin proxy; not triangle intersection'};}
export function applyOutfitAction(items=[],seed=1){let n=(Number(seed)||1)>>>0;const rand=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);const groups=new Map();for(const x of items){if(!groups.has(x.category))groups.set(x.category,[]);groups.get(x.category).push(x);}return[...groups.values()].map(a=>a[Math.floor(rand()*a.length)]).slice(0,8);}
export const MANNEQUIN_DEFAULTS_CM=Object.freeze({heightCm:170,shoulders:40,chest:90,waist:74,hips:96,sleeve:58,inseam:78,neck:34});
export const MANNEQUIN_PRESETS=Object.freeze([
 {id:'reference-a',label:'Tham chiếu A',heightCm:160,shoulders:36,chest:82,waist:66,hips:88,sleeve:54,inseam:72,neck:31},
 {id:'reference-b',label:'Tham chiếu B',heightCm:170,shoulders:40,chest:90,waist:74,hips:96,sleeve:58,inseam:78,neck:34},
 {id:'reference-c',label:'Tham chiếu C',heightCm:180,shoulders:44,chest:102,waist:86,hips:108,sleeve:63,inseam:84,neck:37},
 {id:'reference-d',label:'Tham chiếu D',heightCm:165,shoulders:38,chest:104,waist:90,hips:112,sleeve:57,inseam:75,neck:36}
]);
const MANNEQUIN_LIMITS_CM={heightCm:[140,210],shoulders:[30,60],chest:[60,150],waist:[45,140],hips:[60,160],sleeve:[40,90],inseam:[55,110],neck:[25,55]};
export function normalizeMannequin(value={}){
 const out={};for(const [key,limits] of Object.entries(MANNEQUIN_LIMITS_CM)){const raw=value?.[key],n=raw===null||raw===''?NaN:Number(raw);out[key]=Number.isFinite(n)?Math.min(limits[1],Math.max(limits[0],n)):MANNEQUIN_DEFAULTS_CM[key];}
 return out;
}
export function createMannequinLandmarks(value){
 const m=normalizeMannequin(value), height=m.heightCm;
 const ankle=height*.02, crotch=ankle+m.inseam;
 const headHeight=height*.128, neckTop=height-headHeight*.98;
 const shoulder=Math.max(height*.78,Math.min(neckTop-2,crotch+24));
 const torso=shoulder-crotch;
 return {m,ankle,crotch,headHeight,neckTop,shoulder,pelvis:crotch+torso*.21,waist:crotch+torso*.52,chest:crotch+torso*.82,knee:ankle+m.inseam*.48,wrist:shoulder-m.sleeve};
}
export function createMannequinAnchors(value={}){
 const landmarks=createMannequinLandmarks(value),m=landmarks.m,scale=360/m.heightCm,cx=205,top=42;
 const y=cm=>top+cm*scale,ratio=r=>y(m.heightCm*r),fromFloor=cm=>y(m.heightCm-cm);
 const shoulderHalf=m.shoulders/2,torsoHalf=(cm)=>cm*.2;
 const anchors={
  centerX:cx,scalePxPerCm:scale,heightCm:m.heightCm,head:{cx,cy:fromFloor(landmarks.neckTop+landmarks.headHeight*.49),rx:Math.min(24,m.neck*.58*scale),ry:Math.min(27,m.neck*.68*scale)},
  neck:{left:cx-m.neck*.22*scale,right:cx+m.neck*.22*scale,top:fromFloor(landmarks.neckTop),bottom:fromFloor(landmarks.shoulder)},
  shoulders:{left:cx-shoulderHalf*scale,right:cx+shoulderHalf*scale,y:fromFloor(landmarks.shoulder)},
  armpits:{left:cx-torsoHalf(m.chest)*scale,right:cx+torsoHalf(m.chest)*scale,y:fromFloor((landmarks.shoulder+landmarks.chest)/2)},
  chest:{left:cx-torsoHalf(m.chest)*scale,right:cx+torsoHalf(m.chest)*scale,y:fromFloor(landmarks.chest)},
  waist:{left:cx-torsoHalf(m.waist)*scale,right:cx+torsoHalf(m.waist)*scale,y:fromFloor(landmarks.waist)},
  hips:{left:cx-torsoHalf(m.hips)*scale,right:cx+torsoHalf(m.hips)*scale,y:fromFloor(landmarks.pelvis)},
  crotch:{cx,y:fromFloor(landmarks.crotch)},knees:{left:cx-9*scale,right:cx+9*scale,y:fromFloor(landmarks.knee)},
  ankles:{left:cx-8*scale,right:cx+8*scale,y:fromFloor(landmarks.ankle)},
  wrists:{left:cx-m.sleeve*.50*scale,right:cx+m.sleeve*.50*scale,y:fromFloor(landmarks.wrist)},
  feet:{left:cx-14*scale,right:cx+14*scale,y:ratio(1)}
 };
 return Object.freeze({...anchors,measurementsCm:m});
}
const svgPathPoints=d=>[...String(d||'').matchAll(/-?\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
export function garmentSvgGeometry(item={},anchors=createMannequinAnchors()){
 const a=anchors,m=a.measurementsCm,cx=a.centerX,waist=a.waist,hips=a.hips,shoulder=a.shoulders,arm=a.wrists;
 const p=item.parameters||{},wide=p.width==='wide'?1.18:p.width==='slim'?.86:1,long=p.length==='long'?1.22:p.length==='short'?.78:1;
 let paths=[],category=item.category;
 if(category==='tops'||category==='outerwear'){
  const bottom=Math.min(a.ankles.y-45,waist.y+(category==='outerwear'?Math.max(40,m.hips*.54*long):Math.max(28,22*long)));
  const sw=Math.max(5,m.sleeve*.13*a.scalePxPerCm),sl=Math.min(arm.y-shoulder.y,25*a.scalePxPerCm);
  paths.push('M '+shoulder.left+' '+shoulder.y+' Q '+cx+' '+(shoulder.y-12)+' '+shoulder.right+' '+shoulder.y+' L '+(shoulder.right+sw)+' '+(shoulder.y+sl*.72)+' L '+(arm.right+sw*.35)+' '+(arm.y+sl*.14)+' L '+(arm.right)+' '+arm.y+' L '+(a.armpits.right+3)+' '+(a.armpits.y+8)+' L '+(cx+(waist.right-cx)*wide)+' '+(waist.y+12)+' L '+(cx+(waist.right-cx)*wide)+' '+bottom+' L '+(cx-(waist.right-cx)*wide)+' '+bottom+' L '+(cx-(cx-waist.left)*wide)+' '+(waist.y+12)+' L '+(a.armpits.left-3)+' '+(a.armpits.y+8)+' L '+arm.left+' '+arm.y+' L '+(arm.left-sw*.35)+' '+(shoulder.y+sl*.14)+' L '+(shoulder.left-sw)+' '+(shoulder.y+sl*.72)+' Z');
 }else if(category==='bottoms'){
  const bottom=a.ankles.y-8,mid=a.crotch.y;
  paths.push('M '+(waist.left-5)+' '+(waist.y-3)+' L '+(waist.right+5)+' '+(waist.y-3)+' L '+(hips.right+7)+' '+(mid-4)+' L '+(cx+4)+' '+mid+' L '+(cx+2)+' '+bottom+' L '+(cx-13)+' '+bottom+' L '+(cx-18)+' '+mid+' L '+(hips.left-7)+' '+(mid-4)+' Z');
  paths.push('M '+(cx+3)+' '+mid+' L '+(hips.right-5)+' '+(mid-7)+' L '+(cx+17)+' '+(mid+35)+' L '+(cx+13)+' '+bottom+' L '+(cx+1)+' '+bottom+' Z');
 }else if(category==='skirts'){
  const bottom=hips.y+(a.ankles.y-hips.y)*.66*long,hw=(hips.right-hips.left)*.5*wide;
  paths.push('M '+(cx-hw*.82)+' '+(hips.y-5)+' Q '+cx+' '+(hips.y+4)+' '+(cx+hw*.82)+' '+(hips.y-5)+' L '+(cx+hw*1.6)+' '+bottom+' Q '+cx+' '+(bottom+12)+' '+(cx-hw*1.6)+' '+bottom+' Z');
 }else if(category==='dresses'){
  const bottom=hips.y+(a.ankles.y-hips.y)*.72*long;
  paths.push('M '+shoulder.left+' '+shoulder.y+' Q '+cx+' '+(shoulder.y-12)+' '+shoulder.right+' '+shoulder.y+' L '+(hips.right*.92)+' '+(hips.y+5)+' L '+(cx+(hips.right-cx)*1.65)+' '+bottom+' Q '+cx+' '+(bottom+10)+' '+(cx-(hips.right-cx)*1.65)+' '+bottom+' L '+(hips.left*1.12)+' '+(hips.y+5)+' Z');
 }else if(category==='shoes'){
  paths.push('M '+(a.feet.left-10)+' '+(a.feet.y-5)+' Q '+(cx-4)+' '+(a.feet.y-18)+' '+cx+' '+a.feet.y+' L '+(cx-4)+' '+(a.feet.y+12)+' L '+(a.feet.left-15)+' '+(a.feet.y+12)+' Z','M '+cx+' '+a.feet.y+' Q '+(cx+6)+' '+(a.feet.y-16)+' '+(a.feet.right+10)+' '+(a.feet.y-5)+' L '+(a.feet.right+16)+' '+(a.feet.y+12)+' L '+(cx+5)+' '+(a.feet.y+12)+' Z');
 }else if(category==='hats'){
  paths.push('M '+(cx-30)+' '+(a.head.cy-16)+' Q '+cx+' '+(a.head.cy-a.head.ry-14)+' '+(cx+30)+' '+(a.head.cy-16)+' L '+(cx+28)+' '+(a.head.cy+4)+' L '+(cx-28)+' '+(a.head.cy+4)+' Z','M '+(cx-43)+' '+(a.head.cy+3)+' Q '+cx+' '+(a.head.cy-5)+' '+(cx+43)+' '+(a.head.cy+3)+' L '+(cx+40)+' '+(a.head.cy+10)+' L '+(cx-40)+' '+(a.head.cy+10)+' Z');
 }else if(category==='eyewear'){
  paths.push('M '+(cx-27)+' '+(a.head.cy-2)+' L '+(cx-4)+' '+(a.head.cy-2)+' L '+(cx-4)+' '+(a.head.cy+14)+' L '+(cx-27)+' '+(a.head.cy+14)+' Z M '+(cx+4)+' '+(a.head.cy-2)+' L '+(cx+27)+' '+(a.head.cy-2)+' L '+(cx+27)+' '+(a.head.cy+14)+' L '+(cx+4)+' '+(a.head.cy+14)+' Z M '+(cx-4)+' '+(a.head.cy+4)+' L '+(cx+4)+' '+(a.head.cy+4));
 }else if(category==='bags'||category==='accessories'){
  paths.push('M '+(cx+28)+' '+(hips.y-8)+' L '+(cx+74)+' '+(hips.y-8)+' L '+(cx+74)+' '+(hips.y+44)+' L '+(cx+28)+' '+(hips.y+44)+' Z M '+(cx+35)+' '+(hips.y-8)+' Q '+(cx+35)+' '+(hips.y-32)+' '+(cx+51)+' '+(hips.y-32)+' Q '+(cx+67)+' '+(hips.y-32)+' '+(cx+67)+' '+(hips.y-8));
 }else if(category==='scarves'){
  paths.push('M '+(cx-10)+' '+(a.neck.bottom-2)+' Q '+cx+' '+(a.neck.bottom+5)+' '+(cx+10)+' '+(a.neck.bottom-2)+' L '+(cx+5)+' '+(a.neck.bottom+60)+' L '+(cx-7)+' '+(a.neck.bottom+60)+' Z');
 }else if(category==='jewelry'||category==='hair'){
  paths.push('M '+(cx-22)+' '+(a.head.cy-a.head.ry+2)+' Q '+cx+' '+(a.head.cy-a.head.ry-16)+' '+(cx+22)+' '+(a.head.cy-a.head.ry+2)+' L '+(cx+22)+' '+(a.head.cy-a.head.ry+10)+' Q '+cx+' '+(a.head.cy-a.head.ry)+' '+(cx-22)+' '+(a.head.cy-a.head.ry+10)+' Z');
 }else{
  paths.push('M '+(cx-20)+' '+(waist.y-10)+' h 40 v 40 h -40 z');
 }
 return {paths,anchors:a};
}
export function inspectSvgGarmentClipping(item,anchors=createMannequinAnchors(),bounds={width:410,height:450}){
 const paths=garmentSvgGeometry(item,anchors).paths,coords=paths.flatMap(svgPathPoints),xs=coords.filter((_,i)=>i%2===0),ys=coords.filter((_,i)=>i%2===1);
 const outside=coords.length?xs.filter(x=>x<0||x>bounds.width).length+ys.filter(y=>y<0||y>bounds.height).length:0,total=coords.length;
 return {passed:total>0&&outside===0,vertexCount:Math.floor(total/2),outsideCoordinateCount:outside,clippingRatio:total?outside/total:1,method:'SVG control-point bounds in 410×450 viewBox; does not measure 3D body penetration'};
}
export function buildSvgLook(items=[],options={}){
 const bg=colorOk(options.background)?options.background:'#f2f6f4',tone=colorOk(options.mannequinTone)?options.mannequinTone:'#9ba5a2',anchors=createMannequinAnchors(options.mannequin||options.measurements||{}),pose=options.pose==='lean'?'translate(8 0) rotate(-4 205 220)':options.pose==='step'?'skewX(-3)':options.pose==='sitting'?'translate(0 16) scale(1 .94)':'';
 const a=anchors,cx=a.centerX,body='M '+a.neck.left+' '+a.neck.bottom+' L '+a.shoulders.left+' '+a.shoulders.y+' L '+a.armpits.left+' '+a.armpits.y+' L '+a.waist.left+' '+a.waist.y+' L '+a.hips.left+' '+a.hips.y+' L '+(cx-8)+' '+a.crotch.y+' L '+(cx-14)+' '+a.ankles.y+' L '+(cx-25)+' '+a.ankles.y+' L '+(cx-8)+' '+a.crotch.y+' L '+a.hips.right+' '+a.hips.y+' L '+a.waist.right+' '+a.waist.y+' L '+a.armpits.right+' '+a.armpits.y+' L '+a.shoulders.right+' '+a.shoulders.y+' L '+a.neck.right+' '+a.neck.bottom+' Z';
 const human='<g fill="'+tone+'" opacity=".68"><ellipse cx="'+cx+'" cy="'+a.head.cy+'" rx="'+a.head.rx+'" ry="'+a.head.ry+'"/><path d="'+body+'"/><path d="M '+a.shoulders.left+' '+a.shoulders.y+' L '+a.wrists.left+' '+a.wrists.y+' M '+a.shoulders.right+' '+a.shoulders.y+' L '+a.wrists.right+' '+a.wrists.y+' M '+(cx-5)+' '+a.crotch.y+' L '+a.knees.left+' '+a.knees.y+' L '+a.ankles.left+' '+a.ankles.y+' M '+(cx+5)+' '+a.crotch.y+' L '+a.knees.right+' '+a.knees.y+' L '+a.ankles.right+' '+a.ankles.y+'" fill="none" stroke="'+tone+'" stroke-width="'+Math.max(8,a.scalePxPerCm*8)+'" stroke-linecap="round" stroke-linejoin="round"/></g>';
 const defs='<defs><pattern id="ws-stripe" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 0V12" stroke="#fff" stroke-opacity=".55" stroke-width="3"/></pattern><pattern id="ws-check" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0H18M0 0V18" stroke="#fff" stroke-opacity=".45" stroke-width="2"/></pattern><pattern id="ws-dot" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2" fill="#fff" fill-opacity=".7"/></pattern><pattern id="ws-wave" width="24" height="14" patternUnits="userSpaceOnUse"><path d="M0 7Q6 0 12 7T24 7" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></pattern></defs>';
 const patternFor=id=>['thin-stripe','wide-stripe','pinstripe','vertical-stripe','horizontal-stripe'].includes(id)?'ws-stripe':['gingham','plaid','windowpane','check','herringbone'].includes(id)?'ws-check':['polka-small','polka-large','dots','stars','floral-small'].includes(id)?'ws-dot':['wave','zigzag','scallop'].includes(id)?'ws-wave':'';
 const sorted=items.slice().sort((x,y)=>(x.layerOrder||0)-(y.layerOrder||0));
 const shapes=sorted.map((x,i)=>{const c=colorOk(x.color)?x.color:'#647d69',geometry=garmentSvgGeometry(x,a),pat=patternFor(x.patternId),path=geometry.paths.map(d=>'<path data-garment="'+text(x.id,80).replace(/[^\w-]/g,'')+'" data-region="main" d="'+d+'" fill="'+c+'" stroke="#52625e" stroke-width="2.5" vector-effect="non-scaling-stroke"/>').join(''),pattern=pat?geometry.paths.map(d=>'<path d="'+d+'" fill="url(#'+pat+')" opacity=".8"/>').join(''):'';
  if(!options.flatLay)return '<g>'+path+pattern+'</g>';
  const tx=[52,154,256,358][i%4],ty=i<4?126:306;return '<g transform="translate('+tx+' '+ty+') scale(.32) translate(-205 -230)">'+path+pattern+'</g>';
 }).join('');
 const flatHint=options.flatLay?'<text x="205" y="425" text-anchor="middle" fill="#52625e" font-size="14">Bày phẳng · bố cục minh họa</text>':'<text x="205" y="435" text-anchor="middle" fill="#52625e" font-size="13">Mô phỏng hình học tham khảo · kích thước quy đổi cm</text>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410 450" role="img" aria-label="'+(options.flatLay?'Bố cục trang phục flat-lay':'Ma-nơ-canh và trang phục minh họa theo số đo cm')+'" style="width:100%;height:100%">'+defs+'<rect width="410" height="450" rx="24" fill="'+bg+'"/>'+(!options.flatLay?'<g transform="'+pose+'">'+human+'</g>':'')+'<g transform="'+(options.flatLay?'':pose)+'">'+shapes+'</g>'+flatHint+'</svg>';
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