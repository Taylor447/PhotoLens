export const WARDROBE_CATEGORIES=[
 {id:'tops',label:'Áo'},
 {id:'bottoms',label:'Quần'},
 {id:'dresses',label:'Váy'},
 {id:'outerwear',label:'Áo khoác'},
 {id:'shoes',label:'Giày dép'},
 {id:'accessories',label:'Phụ kiện'}
];
export const WARDROBE_STYLES=[
 {id:'casual',label:'Thường ngày'},
 {id:'minimal',label:'Tối giản'},
 {id:'cinematic',label:'Điện ảnh'},
 {id:'active',label:'Năng động'},
 {id:'classic',label:'Cổ điển'}
];
export const WARDROBE_COLORS=[
 {id:'neutral',label:'Trung tính'},
 {id:'blue',label:'Xanh dương'},
 {id:'green',label:'Xanh lá'},
 {id:'warm',label:'Tông ấm'},
 {id:'red',label:'Đỏ'},
 {id:'purple',label:'Tím'}
];
export const WARDROBE_PATTERNS=[
 {id:'solid',label:'Trơn'},
 {id:'stripes',label:'Kẻ sọc'},
 {id:'dots',label:'Chấm bi'},
 {id:'check',label:'Kẻ ô'}
];
export const WARDROBE_WEATHER=[
 {id:'all',label:'Mọi thời tiết'},
 {id:'hot',label:'Trời nóng'},
 {id:'mild',label:'Ôn hòa'},
 {id:'cold',label:'Trời lạnh'},
 {id:'rainy',label:'Có mưa'},
 {id:'windy',label:'Gió mạnh'}
];
export const WARDROBE_SAMPLES=[
 {id:'sample-tee-cream',category:'tops',name:'Áo thun kem',color:'#e8dfc9',colorFamily:'neutral',pattern:'solid',material:'Vải nhẹ',style:'casual',season:'summer',weather:['hot','mild'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-shirt-blue',category:'tops',name:'Sơ mi xanh nhạt',color:'#8bb8c9',colorFamily:'blue',pattern:'stripes',material:'Vải dệt mỏng',style:'classic',season:'all',weather:['hot','mild'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-knit-green',category:'tops',name:'Áo len xanh rêu',color:'#647d69',colorFamily:'green',pattern:'solid',material:'Len dệt',style:'minimal',season:'winter',weather:['cold'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-trousers-charcoal',category:'bottoms',name:'Quần suông than chì',color:'#46505a',colorFamily:'neutral',pattern:'solid',material:'Vải dày vừa',style:'minimal',season:'all',weather:['mild','cold'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-skirt-rust',category:'dresses',name:'Váy chữ A màu đất',color:'#b76c4d',colorFamily:'warm',pattern:'solid',material:'Vải mềm',style:'classic',season:'all',weather:['mild','hot'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-jacket-navy',category:'outerwear',name:'Áo khoác navy',color:'#334f68',colorFamily:'blue',pattern:'solid',material:'Vải dệt',style:'cinematic',season:'autumn',weather:['cold','windy'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-sneakers-gray',category:'shoes',name:'Giày thể thao xám',color:'#c6ccd0',colorFamily:'neutral',pattern:'solid',material:'Bề mặt vải',style:'active',season:'all',weather:['all'],note:'Mẫu minh họa cơ bản.'},
 {id:'sample-scarf-ochre',category:'accessories',name:'Khăn màu đất',color:'#c28d48',colorFamily:'warm',pattern:'check',material:'Vải dệt',style:'classic',season:'winter',weather:['cold','windy'],note:'Mẫu minh họa cơ bản.'}
];

const ITEM_KEY='photolens_wardrobe_v1';
const OUTFIT_KEY='photolens_outfits_v1';
const categoryIds=new Set(WARDROBE_CATEGORIES.map(x=>x.id));
const styleIds=new Set(WARDROBE_STYLES.map(x=>x.id));
const colorIds=new Set(WARDROBE_COLORS.map(x=>x.id));
const patternIds=new Set(WARDROBE_PATTERNS.map(x=>x.id));
const weatherIds=new Set(WARDROBE_WEATHER.map(x=>x.id));
const text=(v,max=300)=>String(v??'').trim().slice(0,max);
const makeId=()=>globalThis.crypto?.randomUUID?.()||'w-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const readArray=(storage,key)=>{try{const value=JSON.parse(storage?.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
const writeArray=(storage,key,value)=>{try{if(!storage?.setItem)return false;storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};

export function normalizeWardrobeItem(input={}){
 const category=categoryIds.has(input.category)?input.category:'';
 const name=text(input.name,80);
 if(!category||!name)return null;
 const color=/^#[0-9a-f]{6}$/i.test(String(input.color||''))?String(input.color).toLowerCase():'#64748b';
 const weather=Array.isArray(input.weather)?input.weather.filter(x=>weatherIds.has(x)):weatherIds.has(input.weather)?[input.weather]:['all'];
 const seasons=['spring','summer','autumn','winter','all'];
 return {
  id:text(input.id,100)||makeId(),
  category,name,color,
  colorFamily:colorIds.has(input.colorFamily)?input.colorFamily:'neutral',
  pattern:patternIds.has(input.pattern)?input.pattern:'solid',
  material:text(input.material,80),
  style:styleIds.has(input.style)?input.style:'casual',
  season:seasons.includes(input.season)?input.season:'all',
  weather:weather.length?Array.from(new Set(weather)):['all'],
  note:text(input.note,500),
  createdAt:input.createdAt||new Date().toISOString()
 };
}

export function createWardrobeStore(storage=globalThis.localStorage){
 const listItems=()=>readArray(storage,ITEM_KEY).map(normalizeWardrobeItem).filter(Boolean);
 const listOutfits=()=>readArray(storage,OUTFIT_KEY).map(x=>({
  id:text(x?.id,100),name:text(x?.name,80),itemIds:Array.isArray(x?.itemIds)?Array.from(new Set(x.itemIds.map(v=>text(v,100)).filter(Boolean))):[],createdAt:x?.createdAt||new Date().toISOString(),updatedAt:x?.updatedAt||x?.createdAt||new Date().toISOString()
 })).filter(x=>x.id&&x.name);
 const saveItems=items=>writeArray(storage,ITEM_KEY,items);
 const saveOutfits=outfits=>writeArray(storage,OUTFIT_KEY,outfits);
 return {
  listItems,
  saveItem(input){
   const item=normalizeWardrobeItem(input);if(!item)return null;
   const items=listItems(),index=items.findIndex(x=>x.id===item.id);
   if(index<0)items.unshift(item);else items[index]={...items[index],...item};
   return saveItems(items)?item:null;
  },
  removeItem(id){
   const items=listItems().filter(x=>x.id!==id);
   const outfits=listOutfits().map(x=>({...x,itemIds:x.itemIds.filter(itemId=>itemId!==id)}));
   if(!saveItems(items))return false;
   saveOutfits(outfits);
   return true;
  },
  listOutfits,
  saveOutfit(input){
   const name=text(input?.name,80),allItems=new Set(listItems().map(x=>x.id));
   if(!name)return null;
   const itemIds=Array.isArray(input.itemIds)?Array.from(new Set(input.itemIds.filter(id=>allItems.has(id)))):[];
   if(!itemIds.length)return null;
   const outfits=listOutfits(),id=text(input.id,100)||makeId(),index=outfits.findIndex(x=>x.id===id);
   const previous=index<0?null:outfits[index];
   const outfit={id,name,itemIds,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
   if(index<0)outfits.unshift(outfit);else outfits[index]=outfit;
   return saveOutfits(outfits)?outfit:null;
  },
  renameOutfit(id,name){
   const outfit=listOutfits().find(x=>x.id===id);if(!outfit)return null;
   return this.saveOutfit({...outfit,name});
  },
  duplicateOutfit(id,name){
   const outfit=listOutfits().find(x=>x.id===id);if(!outfit)return null;
   return this.saveOutfit({name:text(name,80)||text(outfit.name+' · bản sao',80),itemIds:outfit.itemIds});
  },
  removeOutfit(id){return saveOutfits(listOutfits().filter(x=>x.id!==id));}
 };
}

export function weatherTags(current={}){
 const tags=[];
 const temp=Number(current.temp),rain=Number(current.rain),wind=Number(current.wind);
 if(current.temp!=null&&Number.isFinite(temp)){if(temp>=28)tags.push('hot');else if(temp<=14)tags.push('cold');else tags.push('mild');}
 if(current.rain!=null&&Number.isFinite(rain)&&rain>0)tags.push('rainy');
 if(current.wind!=null&&Number.isFinite(wind)&&wind>=25)tags.push('windy');
 return tags;
}
export function filterWardrobeItems(items=[],filters={},currentWeather={}){
 const query=text(filters.query,100).toLocaleLowerCase();
 const currentTags=weatherTags(currentWeather);
 return items.filter(item=>{
  if(filters.category&&filters.category!=='all'&&item.category!==filters.category)return false;
  if(filters.color&&filters.color!=='all'&&item.colorFamily!==filters.color)return false;
  if(filters.style&&filters.style!=='all'&&item.style!==filters.style)return false;
  if(filters.weather&&filters.weather!=='all'){
   const targets=filters.weather==='current'?currentTags:[filters.weather];
   if(targets.length&&!item.weather.includes('all')&&!targets.every(tag=>item.weather.includes(tag)))return false;
  }
  if(query){
   const category=WARDROBE_CATEGORIES.find(x=>x.id===item.category)?.label||'';
   const haystack=[item.name,item.material,item.note,item.pattern,item.style,category].join(' ').toLocaleLowerCase();
   if(!haystack.includes(query))return false;
  }
  return true;
 });
}
export function composeWardrobe(items=[],itemIds=[]){
 const byId=new Map(items.map(item=>[item.id,item]));
 const ordered=Array.from(new Set(itemIds)).map(id=>byId.get(id)).filter(Boolean);
 const lastByCategory=new Map();
 for(const item of ordered)lastByCategory.set(item.category,item.id);
 return ordered.filter(item=>lastByCategory.get(item.category)===item.id);
}
export function resolveTryOnMode(requested,supported=true){
 return requested==='3d'&&!supported?'2d':requested==='3d'?'3d':'2d';
}
export function prepareWardrobeTryOn(items=[],itemIds=[],requestedMode='2d',supports3D=true){
 return {mode:resolveTryOnMode(requestedMode,supports3D),items:composeWardrobe(items,itemIds)};
}
