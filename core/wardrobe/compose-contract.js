export const COMPOSE_PATH='/outfit/compose';
const color=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
const token=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value);
const categories=new Set(['tops','bottoms','skirts','dresses','outerwear','shoes','hats','bags','eyewear','scarves','jewelry','hair','accessories']);
const genres=new Set(['portrait','landscape','architecture','street','night','moon','cosplay','documentary']);
const styles=new Set(['minimal','vintage','streetwear','office','active','traditional','cosplay','classic','cinematic','casual','unknown']);
const seasons=new Set(['all','spring','summer','autumn','winter']);
const fields=['genre','backgroundColor','temperatureC','precipitationMm','windKmh','candidates'];
const candidateFields=['id','category','color','style','pattern','material','season'];
const exact=(value,keys)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)));
const range=(value,min,max)=>value===null||Number.isFinite(value)&&value>=min&&value<=max;
const number=(value,min,max)=>range(value,min,max)?value:null;

function candidateValid(value){
 return exact(value,candidateFields)&&token(value.id)&&categories.has(value.category)&&color(value.color)&&styles.has(value.style)
  &&token(value.pattern)&&token(value.material)&&seasons.has(value.season);
}

export function validateComposeRequest(body){
 if(!exact(body,fields)||!genres.has(body.genre)||!(body.backgroundColor===null||color(body.backgroundColor)))return false;
 if(!range(body.temperatureC,-80,65)||!range(body.precipitationMm,0,500)||!range(body.windKmh,0,400))return false;
 const rows=body.candidates;
 return Array.isArray(rows)&&rows.length>=1&&rows.length<=60&&rows.every(candidateValid)&&new Set(rows.map(row=>row.id)).size===rows.length;
}

export function buildComposeRequest(items,{genre,background,weather={}}={}){
 const candidates=[],seen=new Set();
 for(const item of items){
  const row={
   id:item.id,category:item.category,color:color(item.color)?item.color:'#647d69',
   style:item.styleTags?.find(tag=>styles.has(tag))||'unknown',
   pattern:token(item.patternId)?item.patternId:'unknown',material:token(item.materialId)?item.materialId:'unknown',
   season:seasons.has(item.season)?item.season:'all'
  };
  if(candidateValid(row)&&!seen.has(row.id)){candidates.push(row);seen.add(row.id);}
  if(candidates.length===60)break;
 }
 return {
  genre:genres.has(genre)?genre:'portrait',backgroundColor:color(background)?background:null,
  temperatureC:number(weather.temp,-80,65),precipitationMm:number(weather.rain,0,500),windKmh:number(weather.wind,0,400),candidates
 };
}

export function validateComposeChoice(result,candidates){
 if(!exact(result,['itemIds','reason'])||!Array.isArray(result.itemIds)||result.itemIds.length<1||result.itemIds.length>8)return false;
 if(typeof result.reason!=='string'||result.reason.trim().length<1||result.reason.length>700)return false;
 const ids=new Set(candidates.map(row=>row.id));
 return new Set(result.itemIds).size===result.itemIds.length&&result.itemIds.every(id=>ids.has(id));
}

export async function resolveComposeChoice({request,fetchChoice,localChoice}){
 try{
  if(!validateComposeRequest(request))throw new Error('Chưa có món phù hợp để gửi AI.');
  const result=await fetchChoice(request);
  if(!validateComposeChoice(result,request.candidates))throw new Error('Gợi ý AI sai cấu trúc hoặc có món ngoài danh sách.');
  return {source:'ai',itemIds:result.itemIds,reason:result.reason};
 }catch(error){
  return {source:'rules',itemIds:localChoice(),reason:error?.message||'Không kết nối được AI.'};
 }
}
