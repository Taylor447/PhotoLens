const COLOR=/^#[0-9a-f]{6}$/i;
const cleanText=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';

export function normalizeOutfit(value={}){
 const itemIds=[...new Set((Array.isArray(value.itemIds)?value.itemIds:[]).filter(id=>typeof id==='string'&&id))];
 const edits=Object.fromEntries(itemIds.flatMap(id=>{
  const edit=Object.hasOwn(value.edits||{},id)?value.edits[id]:null;
  if(!edit)return [];
  const color=COLOR.test(edit.color)?edit.color.toLowerCase():undefined,patternId=cleanText(edit.patternId,60);
  return color||patternId?[[id,{...(color?{color}:{}),...(patternId?{patternId}:{})}]]:[];
 }));
 const lockedIds=itemIds.filter(id=>Array.isArray(value.lockedIds)&&value.lockedIds.includes(id));
 return {itemIds,edits,lockedIds};
}

export function resolveOutfit(items, value){
 const out=normalizeOutfit(value),byId=new Map(items.map(item=>[item.id,item]));
 return out.itemIds.flatMap((id,layerOrder)=>{
  const item=byId.get(id);
  return item?[{...item,...out.edits[id],catalogLayerOrder:item.layerOrder,layerOrder}]:[];
 });
}

export function changeOutfit(value,action){
 const current=normalizeOutfit(value), {itemIds,edits,lockedIds}=current;
 const id=action.id,index=itemIds.indexOf(id);
 if(action.type==='load')return normalizeOutfit(action.outfit);
 if(action.type==='replace'){
  if(!action.itemIds.length)return current;
  const next=[...new Set(action.itemIds)].filter(id=>!lockedIds.includes(id));
  // Put locked pieces back at their previous positions where possible.
  for(const pinned of lockedIds)next.splice(Math.min(itemIds.indexOf(pinned),next.length),0,pinned);
  return normalizeOutfit({...current,itemIds:next});
 }
 if(action.type==='lock'&&index>=0){
  return {...current,lockedIds:lockedIds.includes(id)?lockedIds.filter(x=>x!==id):[...lockedIds,id]};
 }
 if(action.type==='add'&&index<0&&id){
  itemIds.splice(Number.isInteger(action.at)?action.at:itemIds.length,0,id);
  return current;
 }
 if(index<0||lockedIds.includes(id))return current;
 if(action.type==='remove')return normalizeOutfit({...current,itemIds:itemIds.filter(x=>x!==id)});
 if(action.type==='move'){
  const to=index+action.delta;
  if(to>=0&&to<itemIds.length&&!lockedIds.includes(itemIds[to]))[itemIds[index],itemIds[to]]=[itemIds[to],itemIds[index]];
 }
 if(action.type==='edit')return normalizeOutfit({...current,edits:{...edits,[id]:{...edits[id],...action.values}}});
 return current;
}

export function createOutfitState(){
 let entries=[normalizeOutfit()],cursor=0,revision=0;
 return {
  get value(){return normalizeOutfit(entries[cursor]);},
  get revision(){return revision;},
  get canUndo(){return cursor>0;},
  get canRedo(){return cursor<entries.length-1;},
  dispatch(action){
   if(action.type==='undo'||action.type==='redo'){
    const next=Math.max(0,Math.min(entries.length-1,cursor+(action.type==='undo'?-1:1)));
    if(next!==cursor){cursor=next;revision++;}
    return this.value;
   }
   const next=changeOutfit(entries[cursor],action);
   if(JSON.stringify(next)===JSON.stringify(entries[cursor]))return this.value;
   entries=[...entries.slice(0,cursor+1),next].slice(-30);
   cursor=entries.length-1;revision++;
   return this.value;
  }
 };
}

export function outfitViewSettings(value={}){
 return {
  background:COLOR.test(value.background)?value.background:'#f2f6f4',
  mannequinTone:COLOR.test(value.mannequinTone)?value.mannequinTone:'#9ba5a2',
  pose:['standing','lean','step','sitting'].includes(value.pose)?value.pose:'standing',
  flatLay:value.flatLay===true
 };
}

export function makePlanLookReference(look){
 if(!look?.id||!look?.name)return null;
 return {id:cleanText(look.id,120),name:cleanText(look.name,100)};
}

export function getPlanLookReference(formId,existing,looks){
 if(!formId)return null;
 const found=looks.find(look=>look.id===formId);
 return makePlanLookReference(found||(existing?.id===formId?existing:null));
}
