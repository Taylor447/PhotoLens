import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Ray,Triangle,Vector3} from 'three';
import {MANNEQUIN_PRESETS, createMannequinAnchors, normalizeGarment} from '../core/wardrobe-engine.js';
import {calculateFit,chooseSize,parseSizeRows} from '../core/fit/measurements.js';
import {
  BONE_NAMES, MORPH_NAMES, POSE_NAMES, BODY_CLIP_LIMIT, MAX_SCENE_TRIANGLES,
  buildStudioGeometry, buildBodyMorphs, measurePenetration, poseSurfacePoint
} from '../features/wardrobe/studio3d/geometry.js';
import {inspectGarmentGlb} from '../features/wardrobe/studio3d/glb.js';
import {makeProceduralGarmentGlb,packGlb} from '../features/wardrobe/studio3d/export-glb.js';
import {lensVerticalFov} from '../features/wardrobe3d.js';

const {templates}=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url)));

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

function intersectionCount(indices,points){
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

test('procedural GLB is a real v2 asset in metres and preflight excludes external files and excessive triangles',()=>{
 const b=makeProceduralGarmentGlb(templates[0]),info=inspectGarmentGlb(b);
 assert.equal(info.contract.unit,'m');
 assert.equal(info.contract.upAxis,'Y');
 assert.ok(info.triangles>0&&info.triangles<1000);
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
