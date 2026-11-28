import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ray,Triangle,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MANNEQUIN_PRESETS, createMannequinAnchors, normalizeGarment} from '../core/wardrobe-engine.js';
import {calculateFit,chooseSize,parseSizeRows} from '../core/fit/measurements.js';
import {
  BONE_NAMES, MORPH_NAMES, POSE_NAMES, BODY_CLIP_LIMIT, MAX_SCENE_TRIANGLES,
  buildStudioGeometry, buildBodyMorphs, findLayerCrossings, measurePenetration, mannequinAimHeight, poseSurfacePoint
} from '../features/wardrobe/studio3d/geometry.js';
import {inspectGarmentGlb} from '../features/wardrobe/studio3d/glb.js';
import {makeProceduralGarmentGlb,packGlb} from '../features/wardrobe/studio3d/export-glb.js';
import {lensVerticalFov} from '../features/wardrobe3d.js';
import {createClothCollisionGuard} from '../features/wardrobe/studio3d/cloth-collisions.js';
import {countSurfaceCrossings,findFirstSurfaceConflict,prepareSurface} from '../features/wardrobe/studio3d/surface-crossings.js';
import {createRenderSampler} from '../features/wardrobe/studio3d/performance.js';
import {fabricSurfaceProfile} from '../features/wardrobe/studio3d/materials.js';

const {templates}=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url)));

test('render sampler reports only sustained FPS and returns to idle after invalidation-driven rendering stops',()=>{
 const sampler=createRenderSampler({startedAt:0,sampleWindowMs:1000,idleAfterMs:1000,minFrames:5});
 for(const time of [0,200,400,600,800,1000])sampler.recordFrame(time);
 assert.deepEqual(sampler.snapshot(1000),{active:true,fps:6,firstFrameMs:0});
 assert.deepEqual(sampler.snapshot(2001),{active:false,fps:null,firstFrameMs:0});
});

test('render sampler withholds FPS until it has enough frames in a full sample window',()=>{
 const sampler=createRenderSampler({startedAt:0,sampleWindowMs:1000,idleAfterMs:1000,minFrames:5});
 sampler.recordFrame(0);sampler.recordFrame(1000);
 assert.deepEqual(sampler.snapshot(1000),{active:true,fps:null,firstFrameMs:0});
});

test('all licensed fabric presets resolve to a deterministic non-identical PBR surface profile',()=>{
 const {materials}=JSON.parse(readFileSync(new URL('../data/wardrobe/materials.json',import.meta.url)));
 const profiles=materials.map(({id})=>fabricSurfaceProfile(id));
 assert.equal(profiles.length,20);
 assert.ok(profiles.every(Boolean));
 assert.equal(new Set(profiles.map(profile=>profile.id)).size,11);
 assert.notEqual(fabricSurfaceProfile('silk').normalScale,fabricSurfaceProfile('denim').normalScale);
 assert.equal(fabricSurfaceProfile('unknown-fiber'),null);
});

test('canonical garment sizes survive normalization and compare only overlapping cm values',()=>{
 const garment=normalizeGarment({name:'User supplied',category:'tops',temperatureC:{min:null,max:null},sizeTable:[
  {size:'M',measurementsCm:{waistCircumferenceCm:77,shoulderWidthCm:42.5},measurementSource:'Tape'},
  {size:'Other',measurementsCm:{hipCircumferenceCm:95}},
  {size:'L',measurementsCm:{waistCircumferenceCm:90,shoulderWidthCm:48}}
 ]});
 assert.deepEqual(garment.temperatureC,{min:null,max:null});
 const best=chooseSize({shoulders:40,waist:78},garment.sizeTable);
 assert.equal(best.size,'M');assert.deepEqual(best.details.map(x=>[x.easeCm,x.status]),[[2.5,'loose'],[-1,'tight']]);
 assert.equal(chooseSize({neck:34},garment.sizeTable).size,null);
 assert.equal(calculateFit({},garment).available,false);
 const user=parseSizeRows("M; 42,5;; 77","Tape");
 assert.deepEqual(user[0].measurementsCm,{shoulders:42.5,waist:77});
 assert.throws(()=>parseSizeRows("M; 42",""),/nguồn/);
 assert.throws(()=>parseSizeRows("M; 42\nm; 43","Tape"),/dòng 2/);
 assert.throws(()=>parseSizeRows("S; 999","Tape"),/300/);
});

test('all shared dimensions reach the rig and the accumulated morph vertices match the body mesh',()=>{
 const input={heightCm:178,shoulders:53,waist:89,hips:112,neck:32,sleeve:71,inseam:82,chest:101};
 const model=buildStudioGeometry(input);
 const {base,targets}=buildBodyMorphs(input);
 assert.deepEqual(model.layout.bones.map(x=>x.name),BONE_NAMES);
 assert.deepEqual(targets.map(x=>x.name),Object.values(MORPH_NAMES));
 for(const [partIndex,part] of base.entries())for(const [i,point] of part.points.entries()){
  const result=point.map((coord,axis)=>targets.reduce((sum,target)=>sum+target.parts[partIndex][i][axis],coord));
  assert.ok(result.every((coord,axis)=>Math.abs(coord-model.body[partIndex].points[i][axis])<1e-7));
 }
 const {layout}=model;
 assert.equal(layout.crotch-layout.ankle,input.inseam);
 assert.ok(targets.every(target=>target.parts.some(part=>part.some(point=>point.some(coord=>Math.abs(coord)>1e-5)))));
 const anchor=createMannequinAnchors(input);
 assert.ok(Math.abs((anchor.ankles.y-anchor.crotch.y)/anchor.scalePxPerCm-input.inseam)<1e-7);
});

test('3D camera target centers the posed mannequin bounds for every preset and pose',()=>{
 for(const preset of MANNEQUIN_PRESETS)for(const pose of POSE_NAMES){
  const model=buildStudioGeometry(preset,[],{pose});
  const ys=model.body[0].points.map((_,index)=>poseSurfacePoint(model.body[0],index,model.transforms)[1]);
  const expected=(Math.min(...ys)+Math.max(...ys))/2;
  assert.ok(Math.abs(mannequinAimHeight(model)-expected)<1e-9,`${preset.id}/${pose}`);
  if(pose==='sitting')assert.ok(mannequinAimHeight(model)>preset.heightCm*.53,`${preset.id} seated aim`);
 }
});

function assertClosedBody(part) {
 const edges=new Map(), vertices=part.points.map(()=>[]);
 for(let i=0;i<part.indices.length;i+=3){
  const triangle=part.indices.slice(i,i+3);
  assert.equal(new Set(triangle).size,3);
  for(const [j,a] of triangle.entries()){
   const b=triangle[(j+1)%3], key=Math.min(a,b)+':'+Math.max(a,b);
   const edge=edges.get(key)||{count:0,direction:0};
   edge.count++;
   edge.direction+=a<b?1:-1;
   edges.set(key,edge);
   vertices[a].push(b);
  }
 }
 assert.ok([...edges.values()].every(edge=>edge.count===2&&edge.direction===0),'closed, consistently oriented mesh');
 assert.equal(part.points.length-edges.size+part.indices.length/3,2);
 const seen=new Set([0]), pending=[0];
 while(pending.length)for(const next of vertices[pending.pop()])if(!seen.has(next)){
  seen.add(next);
  pending.push(next);
 }
 assert.equal(seen.size,part.points.length,'one connected body mesh');
}

function intersectionCount(indices,points,split){
 const faces=[];
 for(let i=0;i<indices.length;i+=3){
  const ids=indices.slice(i,i+3), triangle=ids.map(id=>points[id]);
  faces.push({ids,triangle,
   min:[0,1,2].map(axis=>Math.min(...triangle.map(p=>p.getComponent(axis)))),
   max:[0,1,2].map(axis=>Math.max(...triangle.map(p=>p.getComponent(axis))))
  });
 }
 faces.sort((a,b)=>a.min[1]-b.min[1]);
 const direction=new Vector3(),hit=new Vector3(),ray=new Ray();
 const crosses=(from,to)=>{
  for(const [i,start] of from.entries()){
   direction.subVectors(from[(i+1)%3],start);
   const length=direction.length();
   ray.set(start,direction.divideScalar(length));
   if(!ray.intersectTriangle(...to,false,hit))continue;
   const distance=hit.distanceTo(start);
   if(distance>1e-5&&distance<length-1e-5)return true;
  }
  return false;
 };
 let count=0;
 for(const [i,a] of faces.entries())for(let j=i+1;j<faces.length&&faces[j].min[1]<=a.max[1];j++){
  const b=faces[j];
  if(split!==undefined&&(a.ids[0]<split)===(b.ids[0]<split))continue;
  if([0,2].some(axis=>a.max[axis]<b.min[axis]||b.max[axis]<a.min[axis]))continue;
  if(a.ids.some(id=>b.ids.includes(id)))continue;
  if(crosses(a.triangle,b.triangle)||crosses(b.triangle,a.triangle))count++;
 }
 return count;
}

test('mannequin has one closed, skinned surface at both detail levels',()=>{
 const jointPairs=['UpperArm_L/Forearm_L','Forearm_R/Hand_R','Thigh_L/Shin_L','Shin_R/Foot_R'];
 for(const radial of [12,20]){
  const {body}=buildStudioGeometry(MANNEQUIN_PRESETS[1],[],{radial});
  assert.equal(body.length,1);
  const [part]=body;
  assertClosedBody(part);
  assert.equal(part.skin.length,part.points.length);
  for(const weights of part.skin){
   assert.ok(weights.length>=1&&weights.length<=4);
   assert.ok(weights.every(([joint,weight])=>BONE_NAMES.includes(joint)&&weight>0));
   assert.ok(Math.abs(weights.reduce((sum,[,weight])=>sum+weight,0)-1)<1e-7);
  }
  for(const pair of jointPairs)assert.ok(part.skin.some(weights=>pair.split('/').every(j=>weights.some(([bone,w])=>bone===j&&w>.15))),pair);
 }
});

test('mannequin presets and two measurement extremes pose without crossing or degenerate triangles',t=>{
 let tested=0,minimumArea=Infinity;
 const face=new Triangle();
 const measurements=[
  ...MANNEQUIN_PRESETS,
  {id:'short-wide',heightCm:140,shoulders:30,chest:150,waist:140,hips:160,sleeve:40,inseam:110,neck:55},
  {id:'tall-narrow',heightCm:210,shoulders:60,chest:60,waist:45,hips:60,sleeve:90,inseam:55,neck:25}
 ];
 for(const preset of measurements)for(const pose of POSE_NAMES)for(const radial of [12,20]){
  const {body:[part],transforms}=buildStudioGeometry(preset,[],{pose,radial});
  const posed=part.points.map((_,i)=>new Vector3(...poseSurfacePoint(part,i,transforms)));
  assert.ok(Math.abs(Math.max(...part.points.map(([,y])=>y))-preset.heightCm)<1e-7);
  for(let i=0;i<part.indices.length;i+=3){
   face.set(...part.indices.slice(i,i+3).map(id=>posed[id]));
   const area=face.getArea();
   assert.ok(area>1e-4,preset.id+'/'+pose+'/'+radial);
   minimumArea=Math.min(minimumArea,area);
  }
  const intersections=intersectionCount(part.indices,posed);
  assert.equal(intersections,0,preset.id+'/'+pose+'/'+radial);
  tested++;
 }
 t.diagnostic(JSON.stringify({testedPosedBodies:tested,minimumFaceAreaCm2:minimumArea}));
});

test('mesh containment detects an intentionally buried vertex',()=>{
 const {transforms,colliders,layout}=buildStudioGeometry(MANNEQUIN_PRESETS[1]);
 const result=measurePenetration([{bone:'Spine',points:[[0,layout.chest,0],[400,0,0]]}],transforms,colliders);
 assert.deepEqual(result,{ratio:.5,testedVertices:2,penetratingVertices:1});
});

test('seated skirts and dress hems do not cut through the body between mesh vertices',t=>{
 const skirts=templates.filter(item=>['skirts','dresses'].includes(item.category));
 let cases=0;
 for(const preset of MANNEQUIN_PRESETS)for(const radial of [12,20]){
  const options={pose:'sitting',radial};
  const {body:[body],transforms}=buildStudioGeometry(preset,[],options);
  const posed=part=>part.points.map((_,i)=>new Vector3(...poseSurfacePoint(part,i,transforms)));
  const bodyPoints=posed(body);
  const split=bodyPoints.length;
  for(const item of skirts){
   const {garments:[{parts}]}=buildStudioGeometry(preset,[item],options);
   const skirt=parts.at(-1);
   const posedSkirt=posed(skirt);
   const crossings=intersectionCount(
    [...body.indices,...skirt.indices.map(index=>index+split)],
    [...bodyPoints,...posedSkirt],split);
   assert.equal(crossings,0,preset.id+'/'+item.id+'/'+radial);
   cases++;
  }
 }
 t.diagnostic(JSON.stringify({seatedSkirtAndDressCases:cases}));
});

test('all 60 procedural garments stay below 1% vertex penetration for 4 presets, 4 poses and both render LODs',t=>{
 let combinations=0,tested=0,inside=0,maximum=0,maxTriangles=0;
 for(const preset of MANNEQUIN_PRESETS)for(const pose of POSE_NAMES)for(const radial of [12,20]){
  for(const item of templates){
   const geometry=buildStudioGeometry(preset,[item],{pose,radial});
   const c=measurePenetration(geometry.garments[0].parts,geometry.transforms,geometry.colliders);
   assert.ok(c.testedVertices>0);
   assert.ok(c.ratio<=BODY_CLIP_LIMIT,JSON.stringify({id:item.id,preset:preset.id,pose,radial,...c}));
   combinations++;tested+=c.testedVertices;inside+=c.penetratingVertices;maximum=Math.max(maximum,c.ratio);
   maxTriangles=Math.max(maxTriangles,geometry.triangles);
  }
 }
 assert.equal(combinations,1920);
 const dense=buildStudioGeometry(MANNEQUIN_PRESETS[3],templates.filter(x=>['tops','outerwear','bottoms','dresses'].includes(x.category)),{pose:'sitting'});
 assert.ok(dense.triangles+2<=MAX_SCENE_TRIANGLES);
 t.diagnostic(JSON.stringify({combinations,testedVertices:tested,penetratingVertices:inside,maxVertexRatio:maximum,maxSingleGarmentSceneTriangles:maxTriangles,denseSceneTriangles:dense.triangles+2}));
});

test('the 60 catalogue templates have distinct 3D meshes without relying on their names or colors',()=>{
 const fingerprints=new Map();
 for(const item of templates){
  const {garments:[{parts}]}=buildStudioGeometry(MANNEQUIN_PRESETS[1],[{...item,color:'#627970',name:'Fixture'}],{radial:12});
  assert.ok(parts.length,item.id);
  const signature=JSON.stringify(parts.map(({points,indices})=>[points,indices]));
  assert.ok(!fingerprints.has(signature),item.id+' shares a mesh with '+fingerprints.get(signature));
  fingerprints.set(signature,item.id);
 }
 assert.equal(fingerprints.size,60);
});

test('draped skirts and split áo dài panels cover trousers in both walking and sitting poses',t=>{
 const byId=id=>templates.find(item=>item.id===id);
 let cases=0;
 for(const radial of [12,20])for(const pose of ['standing','step','sitting']){
  for(const [upper,pants] of [['tpl-skirts-4','tpl-bottoms-1'],['tpl-tops-3','tpl-bottoms-4']]){
   const model=buildStudioGeometry(MANNEQUIN_PRESETS[1],[byId(upper),byId(pants)],{radial,pose});
   const crossings=findLayerCrossings(model.garments,model.transforms,{firstPerPair:false});
   assert.deepEqual(crossings,[],upper+'/'+pants+'/'+pose+'/'+radial);
   cases++;
  }
 }
 t.diagnostic(JSON.stringify({layerCases:cases}));
});

test('the layer checker finds crossing faces with exterior vertices',()=>{
 const triangle=(id,points)=>({item:{id},parts:[{points,bone:'Root',indices:[0,1,2]}]});
 const layers=[
  triangle('horizontal',[[-1,0,-1],[1,0,-1],[0,0,1]]),
  triangle('vertical',[[0,-1,-.5],[0,1,-.5],[0,0,.5]])
 ];
 const transforms=new Map([['Root',{toWorld:p=>p}]]);
 assert.equal(findLayerCrossings(layers,transforms)[0]?.crossings,1);
});

test('imported mesh collision guard identifies the conflicting garment and accepts separated surfaces',()=>{
 const surface=(points)=>prepareSurface(points,[0,1,2]);
 const candidate=[surface([[-1,0,-1],[1,0,-1],[0,0,1]])];
 const crossing={item:{id:'outer',name:'Áo khoác'},surfaces:[surface([[0,-1,-.5],[0,1,-.5],[0,0,.5]])]};
 const separated={item:{id:'pants',name:'Quần'},surfaces:[surface([[5,-1,-.5],[5,1,-.5],[5,0,.5]])]};
 assert.equal(findFirstSurfaceConflict(candidate,[crossing])?.id,'outer');
 assert.equal(findFirstSurfaceConflict(candidate,[separated]),null);
});

test('layered outfits clear their seams across every mannequin preset, pose and LOD',t=>{
 const outfits=[
  ['tops-1','outerwear-1'],['tops-2','bottoms-1','outerwear-2'],
  ['tops-4','outerwear-4'],['tops-1','skirts-2'],
  ['tops-3','bottoms-4'],['bottoms-1','skirts-4'],
  ['dresses-2','outerwear-1'],['tops-2','tops-1'],
  ['tops-5','outerwear-3'],['tops-1','skirts-3','outerwear-3'],
  ['dresses-4','outerwear-2'],['dresses-5','outerwear-5'],
  ['tops-3','bottoms-4','outerwear-1']
 ].map(ids=>ids.map(id=>templates.find(item=>item.id==='tpl-'+id)));
 let layeredCases=0,capeCases=0,adjustedCases=0,maxTriangles=0,penetratingVertices=0,testedVertices=0;
 for(const preset of MANNEQUIN_PRESETS)for(const pose of POSE_NAMES)for(const radial of [12,20]){
  const options={pose,radial};
  const armAngle=layout=>layout.bones.find(({name})=>name==='UpperArm_R').rz;
  const reference=armAngle(buildStudioGeometry(preset,[],options).layout);
  for(const items of outfits){
   const {garments,layout,body,transforms,colliders,triangles}=buildStudioGeometry(preset,items,options);
   const context=[preset.id,pose,radial,...items.map(({id})=>id)].join('/');
   assert.deepEqual(findLayerCrossings(garments,transforms,{firstPerPair:false}),[],context);
   const clip=measurePenetration(garments.flatMap(({parts})=>parts),transforms,colliders);
   assert.ok(clip.ratio<=BODY_CLIP_LIMIT,context);
   const cape=garments.find(({item})=>item.id==='tpl-outerwear-3')?.parts[0];
   if(cape){
    const posed=part=>prepareSurface(part.points.map((_,index)=>poseSurfacePoint(part,index,transforms)),part.indices);
    assert.equal(countSurfaceCrossings(posed(cape),posed(body[0]),1),0,context);
    capeCases++;
   }
   const adjustment=armAngle(layout)-reference;
   assert.ok(adjustment>=0&&adjustment<=.271,context);
   if(adjustment){
    const [part]=body;
    const points=part.points.map((_,i)=>new Vector3(...poseSurfacePoint(part,i,transforms)));
    assert.equal(intersectionCount(part.indices,points),0,context);
    adjustedCases++;
   }
   assert.ok(triangles+2<=MAX_SCENE_TRIANGLES,context);
   maxTriangles=Math.max(maxTriangles,triangles+2);
   penetratingVertices+=clip.penetratingVertices;
   testedVertices+=clip.testedVertices;
   layeredCases++;
  }
 }
 assert.equal(layeredCases,416);
 assert.equal(capeCases,64);
 assert.ok(adjustedCases>0&&adjustedCases<layeredCases);
 t.diagnostic(JSON.stringify({layeredCases,capeCases,adjustedCases,maxTriangles,penetratingVertices,testedVertices}));
});

test('cloth collision checks reject crossing surfaces against fixed and accepted moving layers',()=>{
 const transform={origin:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]]};
 const indices=[0,1,2];
 const horizontal=[[-1,.5,-1],[1,.5,-1],[0,.5,1]];
 const vertical=[[0,0,-.5],[0,1,-.5],[0,.5,.5]];
 const move=(points,axis,by)=>points.map(point=>point.map((value,i)=>value+(axis===i?by:0)));
 const draft=(garment,points)=>({garment,indices,positions:Float32Array.from(points.flat()),transform});
 const first=draft(0,move(horizontal,1,2));
 const second=draft(1,move(vertical,0,2));
 const accepts=createClothCollisionGuard({body:[],garments:[],cloth:[first,second]});
 assert.equal(accepts(0,Float32Array.from(horizontal.flat())),true);
 assert.equal(accepts(1,Float32Array.from(vertical.flat())),false);
 assert.equal(accepts(0,first.positions),true);
 assert.equal(accepts(1,Float32Array.from(vertical.flat())),true);
 const fixed=createClothCollisionGuard({
  body:[],garments:[{garment:0,points:horizontal,indices}],cloth:[second]
 });
 assert.equal(fixed(0,Float32Array.from(vertical.flat())),false);
});

test('procedural GLB is a real skinned v2 asset in metres and preflight excludes external files and excessive triangles',async()=>{
 const b=makeProceduralGarmentGlb(templates[0]),info=inspectGarmentGlb(b);
 assert.equal(info.contract.unit,'m');
 assert.equal(info.contract.upAxis,'Y');
 assert.equal(info.contract.binding,'rigged');
 assert.deepEqual(info.json.skins[0].joints.map(i=>info.json.nodes[i].name),BONE_NAMES);
 assert.ok(info.triangles>0&&info.triangles<12_000);
 const gltf=await new GLTFLoader().parseAsync(b.buffer,'');
 const meshes=[];
 gltf.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node);});
 assert.ok(meshes.length>0);
 for(const mesh of meshes){
  const weights=mesh.geometry.getAttribute('skinWeight');
  assert.equal(weights.count,mesh.geometry.getAttribute('position').count);
  for(let i=0;i<weights.count;i++)
   assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
 }
 assert.throws(()=>inspectGarmentGlb(b,{triangleBudget:1}),/tam giác/);
 const binOffset=28+new DataView(b.buffer).getUint32(12,true),binary=b.subarray(binOffset);
 info.json.buffers[0].uri='https://example.invalid/asset.bin';
 assert.throws(()=>inspectGarmentGlb(packGlb(info.json,binary)),/nhúng/);
 delete info.json.buffers[0].uri;
 delete info.json.asset.extras;
 assert.throws(()=>inspectGarmentGlb(packGlb(info.json,binary)),/mốc gắn/);
});

test('camera focal length changes vertical field of view on a fixed sensor',()=>{
 assert.ok(lensVerticalFov(24,1.5)>lensVerticalFov(50,1.5));
 assert.ok(lensVerticalFov(50,1.5)>lensVerticalFov(85,1.5));
 assert.ok(Math.abs(lensVerticalFov(50,1.5)-26.991)<.01);
});
