import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutfitState,resolveOutfit,getPlanLookReference} from '../core/wardrobe/outfit-state.js';
import {createWardrobeRepository,buildSvgLook,composeRuleOutfit,buildCapsuleLooks,filterGarments,colorHarmony} from '../core/wardrobe-engine.js';
import {buildStudioGeometry} from '../features/wardrobe/studio3d/geometry.js';
import {buildComposeRequest,resolveComposeChoice,validateComposeRequest} from '../core/wardrobe/compose-contract.js';

const pieces=[
 {id:'top',name:'Áo',category:'tops',color:'#446699',layer:'base',layerOrder:10},
 {id:'top2',name:'Áo hai',category:'tops',color:'#336699',layer:'base',layerOrder:10},
 {id:'pants',name:'Quần',category:'bottoms',color:'#121212',layer:'base',layerOrder:20},
 {id:'skirts',name:'Váy',category:'skirts',color:'#8899aa',layer:'base',layerOrder:21},
 {id:'coat',name:'Khoác',category:'outerwear',color:'#005500',layer:'outer',layerOrder:30,weather:{rain:true,wind:true}}
];
test('both renderers receive the same order, colours and edits after undo/redo',()=>{
 const state=createOutfitState();
 state.dispatch({type:'replace',itemIds:['top','pants','coat']});
 state.dispatch({type:'edit',id:'coat',values:{color:'#ff4444',patternId:'wide-stripe'}});
 state.dispatch({type:'move',id:'coat',delta:-1});
 const draw=()=>{
  const rows=resolveOutfit(pieces,state.value);
  return [buildSvgLook(rows),buildStudioGeometry({},rows).garments.map(g=>g.item)];
 };
 const [svg,rendered]=draw();
 assert.deepEqual(rendered.map(x=>x.id),['top','coat','pants']);
 assert.ok(svg.indexOf('data-garment="coat"')<svg.indexOf('data-garment="pants"'));
 assert.equal(rendered[1].color,'#ff4444');
 state.dispatch({type:'undo'});state.dispatch({type:'undo'});
 assert.deepEqual(draw()[1].map(x=>x.color),['#446699','#121212','#005500']);
 state.dispatch({type:'redo'});
 assert.equal(draw()[1][2].patternId,'wide-stripe');
 assert.equal(pieces[4].color,'#005500');
});

test('locks survive an AI or local replacement and prevent removal, editing and moves',()=>{
 const state=createOutfitState();
 state.dispatch({type:'replace',itemIds:['top','pants']});
 state.dispatch({type:'lock',id:'top'});
 const before=state.revision;
 state.dispatch({type:'remove',id:'top'});
 state.dispatch({type:'edit',id:'top',values:{color:'#ffffff'}});
 state.dispatch({type:'move',id:'pants',delta:-1});
 assert.equal(state.revision,before);
 state.dispatch({type:'replace',itemIds:['top2','coat']});
 assert.deepEqual(state.value.itemIds,['top','top2','coat']);
 state.dispatch({type:'undo'});
 assert.deepEqual(state.value.itemIds,['top','pants']);
 assert.deepEqual(state.value.lockedIds,['top']);
});

test('lookbook saves independent outfit edits and tags, while plans keep a local reference and a title',async()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const repo=createWardrobeRepository(storage,null);await repo.ready;
 pieces.forEach(piece=>repo.saveItem(piece));
 const first=repo.saveLook({name:'Đêm',itemIds:['pants','top'],edits:{top:{color:'#223344'}},tags:['trăng'],view:{flatLay:true,background:'#131313'}});
 const second=repo.duplicateLook(first.id);
 repo.saveLook({...second,name:'Ban ngày',edits:{top:{color:'#ffffff'}},tags:['phố']});
 const looks=repo.listLooks();
 assert.deepEqual(looks.find(x=>x.id===first.id).itemIds,['pants','top']);
 assert.equal(looks.find(x=>x.id===first.id).edits.top.color,'#223344');
 assert.deepEqual(looks.find(x=>x.id===second.id).tags,['phố']);
 assert.ok(looks.find(x=>x.id===second.id).view.flatLay);
 const attachment=getPlanLookReference(second.id,null,looks);
 assert.deepEqual(attachment,{id:second.id,name:'Ban ngày'});
 repo.removeLook(second.id);
 assert.deepEqual(getPlanLookReference(second.id,attachment,repo.listLooks()),attachment);
 assert.equal(getPlanLookReference('',attachment,repo.listLooks()),null);
});

test('composer uses manual rain and wind for layers, capsule yields several looks from a bounded closet',()=>{
 const params={seed:23,weather:{rain:1,wind:35},anchor:pieces[0]};
 const picked=composeRuleOutfit(pieces,params);
 assert.ok(picked.some(x=>x.id==='coat'));
 assert.ok(picked.some(x=>x.id==='top'));
 assert.deepEqual(composeRuleOutfit(pieces,params).map(x=>x.id),picked.map(x=>x.id));
 const capsule=buildCapsuleLooks(pieces,params);
 assert.ok(capsule.length>=3);
 assert.ok(new Set(capsule.flatMap(rows=>rows.map(x=>x.id))).size<=8);
 assert.equal(filterGarments([{...pieces[0],temperatureC:{min:15}}],{weather:'current'},{temp:null}).length,1);
 assert.equal(colorHarmony([{color:'#333333'},{color:'#ff0000'}]).scheme,'Trung tính + điểm nhấn');
});

test('client omits personal fields and uses local rules if the Worker fails or names an unlisted item',async()=>{
 const request=buildComposeRequest([{...pieces[0],measurementsCm:{waist:90},notes:'secret',imageAssetId:'private',name:'private name'}],{genre:'moon',background:'#123456',weather:{temp:20}});
 assert.equal(validateComposeRequest(request),true);
 assert.deepEqual(Object.keys(request.candidates[0]),['id','category','color','style','pattern','material','season']);
 assert.equal(JSON.stringify(request).includes('private'),false);
 for(const fetchChoice of [async()=>{throw Error('Offline');},async()=>({itemIds:['outside'],reason:'Ngoài danh sách'}),async()=>({itemIds:['top'],reason:'Hợp nền',extra:true})]){
  assert.equal((await resolveComposeChoice({request,fetchChoice,localChoice:()=>['top']})).source,'rules');
 }
 const accepted=await resolveComposeChoice({request,fetchChoice:async()=>({itemIds:['top'],reason:'Tương phản với nền'}),localChoice:()=>[]});
 assert.equal(accepted.source,'ai');
});
