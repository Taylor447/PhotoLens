import {MANNEQUIN_DEFAULTS_CM, normalizeMannequin, createMannequinLandmarks} from '../../../core/wardrobe-engine.js';
import {buildMannequinSurface} from './mannequin-surface.js';

export const MAX_SCENE_TRIANGLES = 150_000;
export const MAX_PROCEDURAL_ITEMS = 18;
export const BODY_CLIP_LIMIT = 0.01;
export const MORPH_NAMES = {
  heightCm: 'Height', shoulders: 'ShoulderWidth', chest: 'ChestCircumference',
  waist: 'WaistCircumference', hips: 'HipCircumference', sleeve: 'ArmLength',
  inseam: 'InseamLength', neck: 'NeckCircumference'
};
export const BONE_NAMES = [
  'Root', 'Pelvis', 'Spine', 'Neck', 'Head',
  'UpperArm_L', 'Forearm_L', 'Hand_L', 'Thigh_L', 'Shin_L', 'Foot_L',
  'UpperArm_R', 'Forearm_R', 'Hand_R', 'Thigh_R', 'Shin_R', 'Foot_R'
];
export const POSE_NAMES = ['standing', 'lean', 'step', 'sitting'];
const TAU = Math.PI * 2;
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

function radii(circumference, depthRatio) {
  const h = ((1-depthRatio)/(1+depthRatio))**2;
  const radius = circumference / (Math.PI*(1+depthRatio)*(1+3*h/(10+Math.sqrt(4-3*h))));
  return [radius, radius*depthRatio];
}

export function createRigLayout(value, pose = 'standing') {
  const {m,ankle,crotch,headHeight,neckTop,shoulder,pelvis,waist,chest,knee,wrist}=createMannequinLandmarks(value);
  const [hipRx, hipRz] = radii(m.hips,.73);
  const [waistRx, waistRz] = radii(m.waist,.7);
  const [chestRx, chestRz] = radii(m.chest,.68);
  const [neckRx, neckRz] = radii(m.neck,.9);
  // Short torsos have less room for hip flexion when the front of the thighs rises.
  const uprightClearance=clamp((shoulder-crotch)/(hipRz*1.55),0,1);
  const seatedHipAngle=.72+.46*uprightClearance;
  const bones = [];
  const bone = (name,parent,position,rx=0,rz=0) => bones.push({name,parent,position,rx,rz});
  bone('Root',null,[0,0,0]);
  bone('Pelvis','Root',[0,pelvis,0],0,pose==='lean'?-.105:0);
  bone('Spine','Pelvis',[0,waist,0],pose==='sitting'?-.07:0);
  bone('Neck','Spine',[0,shoulder,0]);
  bone('Head','Neck',[0,neckTop,0]);
  const sideData=[];
  for (const [sign, suffix] of [[-1,'L'],[1,'R']]){
    const armX=sign*m.shoulders/2, legX=sign*hipRx*.48;
    const upperLength=m.sleeve*.53, lowerLength=m.sleeve-upperLength;
    const handY=wrist;
    bone('UpperArm_'+suffix,'Spine',[armX,shoulder,0],pose==='sitting'?-.33:pose==='step'?sign*.3:0,sign*.2);
    bone('Forearm_'+suffix,'UpperArm_'+suffix,[armX,shoulder-upperLength,0],pose==='sitting'?-1.27:-.14,sign*-.055);
    bone('Hand_'+suffix,'Forearm_'+suffix,[armX,handY,0]);
    bone('Thigh_'+suffix,'Pelvis',[legX,crotch+1,hipRz*.19],pose==='sitting'?-seatedHipAngle:pose==='step'?sign*-.36:0,sign*.045);
    bone('Shin_'+suffix,'Thigh_'+suffix,[legX,knee,0],pose==='sitting'?seatedHipAngle-.02:pose==='step'?.25:0);
    bone('Foot_'+suffix,'Shin_'+suffix,[legX,ankle,0],pose==='step'?sign*.14:0);
    sideData.push({suffix,armX,legX,knee,upperLength,lowerLength,handY});
  }
  return {m,bones,sideData,ankle,crotch,headHeight,neckTop,shoulder,pelvis,waist,chest,hipRx,hipRz,waistRx,waistRz,chestRx,chestRz,neckRx,neckRz};
}

const ring=(y, rx, rz, x=0, z=0)=>({x,y,z,rx,rz});
const part=(bone,rings,cap=false,cloth=false)=>({bone,rings,cap,cloth});
// Reference sections for the existing procedural garment shells.
function garmentReferenceSections(layout) {
  const {m,ankle,crotch,shoulder,pelvis,hipRx,hipRz,sideData}=layout;
  const parts=[
    part('Pelvis',[ring(crotch-3,hipRx*.61,hipRz*.76),ring(crotch+2,hipRx*.9,hipRz*.92),ring(pelvis,hipRx,hipRz),ring(pelvis+3,hipRx*.95,hipRz*.95)],true)
  ];
  for (const {suffix,armX,legX,knee,upperLength,handY} of sideData){
    const elbow=shoulder-upperLength, upperRadius=clamp(m.chest*.049,3.2,7.1), thighRadius=clamp(hipRx*.46,5.6,14);
    parts.push(
      part('UpperArm_'+suffix,[ring(elbow-1,upperRadius*.69,upperRadius*.73,armX),ring(shoulder-upperLength*.26,upperRadius,upperRadius,armX),ring(shoulder+upperRadius*.42,upperRadius*.83,upperRadius*.85,armX)],true),
      part('Forearm_'+suffix,[ring(handY-1,upperRadius*.47,upperRadius*.53,armX),ring(elbow-3,upperRadius*.74,upperRadius*.78,armX),ring(elbow+1,upperRadius*.67,upperRadius*.72,armX)],true),
      part('Hand_'+suffix,[ring(handY-6,upperRadius*.25,upperRadius*.37,armX),ring(handY-3,upperRadius*.45,upperRadius*.54,armX),ring(handY+1,upperRadius*.4,upperRadius*.48,armX)],true),
      part('Thigh_'+suffix,[ring(knee-1,thighRadius*.58,thighRadius*.66,legX),ring(crotch-8,thighRadius,thighRadius*.98,legX),ring(crotch+3,thighRadius*.87,thighRadius*.93,legX)],true),
      part('Shin_'+suffix,[ring(ankle-1,thighRadius*.31,thighRadius*.40,legX),ring(knee-(knee-ankle)*.38,thighRadius*.67,thighRadius*.74,legX),ring(knee+1,thighRadius*.55,thighRadius*.61,legX)],true),
      part('Foot_'+suffix,[ring(0,thighRadius*.5,m.heightCm*.063,legX,m.heightCm*.026),ring(ankle+1,thighRadius*.42,m.heightCm*.042,legX,m.heightCm*.014)],true)
    );
  }
  return parts;
}

const expand = (descriptor, ease) => ({...descriptor,cap:false,rings:descriptor.rings.map(r=>({...r,rx:r.rx+ease,rz:r.rz+ease}))});
function referenceShell(item, layout, sections, layerOffset) {
  const {m,ankle,crotch,headHeight,neckTop,shoulder,pelvis,waist,chest,hipRx,hipRz,waistRx,waistRz,chestRx,chestRz,neckRx,neckRz,sideData}=layout;
  const variant = Math.max(0,(Number(String(item.id||'').match(/-(\d+)$/)?.[1])||1)-1)%5;
  const galleryShape = item.name||'';
  const p=item.parameters||{}, ease=(p.width==='wide'?4.6:p.width==='slim'?1.4:2.6)+layerOffset+variant*.3;
  const long=p.length==='long'?1.18:p.length==='short'?.78:1;
  const bodiceLength = shoulder-waist;
  const torso=(hem) => part('Spine',[ring(hem,Math.max(waistRx,hem<waist?hipRx:0)+ease,Math.max(waistRz,hem<waist?hipRz:0)+ease),ring(waist,waistRx+ease,waistRz+ease),ring(chest,chestRx+ease,chestRz+ease),ring(shoulder-1,m.shoulders*.5+ease,chestRz*.83+ease),ring(shoulder+3.1+(p.neck==='high'?1:0),neckRx+ease,neckRz+ease)]);
  const skirt=(longer)=>part('Pelvis',[
    ring(Math.max(ankle+4,pelvis-m.inseam*(longer?.69:.48)*long),hipRx+ease+10+variant,hipRz+ease+5+variant*.7),
    ring(Math.max(ankle+8,pelvis-m.inseam*.23*long),hipRx+ease+5,hipRz+ease+3),
    ring(pelvis+1,hipRx+ease,hipRz+ease),ring(waist,waistRx+ease,waistRz+ease)
  ],false,true);
  const limb=name=>sections.filter(row=>row.bone.startsWith(name)).map(row=>expand(row,ease));
  switch(item.category){
    case 'tops':
    case 'outerwear': {
      const outer=item.category==='outerwear', cape=outer&&(/choàng/i.test(galleryShape)||p.sleeve==='wide');
      const hem = Math.min(waist-1, waist-bodiceLength*(outer?.48:.18)*long);
      if(cape){
        return [...torsoCape(layout,ease,variant,long)];
      }
      const shells=[torso(hem)];
      if(p.sleeve!=='sleeveless') for(const arm of limb('UpperArm')){
        if(p.sleeve==='long'||outer) shells.push(arm);
        else shells.push({...arm,rings:[{...arm.rings[1],y:(arm.rings[1].y+arm.rings[0].y)*.5},...arm.rings.slice(1)]});
      }
      if(p.sleeve==='long'||outer) shells.push(...limb('Forearm'));
      return shells;
    }
    case 'dresses':return [torso(waist-1),skirt(/tứ thân|dài/i.test(galleryShape)||variant===3)];
    case 'skirts':return [skirt(variant===3)];
    case 'bottoms':return [...limb('Pelvis'),...limb('Thigh'),...(p.length==='short'||variant===1?[]:limb('Shin'))];
    case 'shoes':return sections.filter(row=>row.bone.startsWith('Foot')).map(row=>({...expand(row,1.05+layerOffset),cap:true}));
    case 'hats':return [part('Head',[ring(neckTop+headHeight*.64,headHeight*(variant===2?.74:.62),headHeight*.62),ring(m.heightCm+1,headHeight*.33,headHeight*.36),ring(m.heightCm+(variant===2?8:4),variant===2?.4:headHeight*.25,variant===2?.4:headHeight*.27)],false)];
    case 'hair':return [part('Head',[ring(m.heightCm+.4,2.6,3.1,headHeight*.17),ring(m.heightCm+2.7,2.1,2.6,headHeight*.17)],true)];
    case 'scarves':return [part('Neck',[ring(shoulder+.1,neckRx+ease,neckRz+ease),ring(neckTop-1,neckRx+ease,neckRz+ease)],false)];
    case 'eyewear':return [-1,1].map(sign=>part('Head',[ring(neckTop+headHeight*.43,headHeight*.166,1.1,sign*headHeight*.16,headHeight*.39),ring(neckTop+headHeight*.6,headHeight*.176,1.1,sign*headHeight*.16,headHeight*.4)],true));
    case 'jewelry':return [part('Neck',[ring(shoulder+1,neckRx+ease*.55,neckRz+ease*.55),ring(shoulder+1.7,neckRx+ease*.53,neckRz+ease*.53)],false)];
    case 'bags':
    case 'accessories':return [part('Pelvis',[ring(crotch-13,8+variant,4,hipRx+8,hipRz+3),ring(waist-1,8+variant,4,hipRx+8,hipRz+3)],true)];
    default: return [];
  }
}
function torsoCape({m,chest,shoulder,pelvis,hipRz,hipRx,neckRx,neckRz},ease,variant,long) {
  const rows=[];
  for(let i=0;i<=8;i++){
    const t=i/8;
    rows.push(ring(pelvis-(m.inseam*.35*long)+t*(shoulder+1-pelvis+m.inseam*.35*long),
      (hipRx+14+variant)*(1-t)**.62+(neckRx+ease)*t+ease,
      (hipRz+8)*(1-t)**.7+(neckRz+ease)*t+ease,0,-2.7));
  }
  return [part('Spine',rows,false,true)];
}

export function tessellate(descriptor, radial = 20){
  const {rings,cap,bone,cloth}=descriptor, points=[],uv=[],indices=[];
  for(let r=0;r<rings.length;r++){
    const {x,y,z,rx,rz}=rings[r];
    for(let i=0;i<=radial;i++){
      const angle=i/radial*TAU;
      points.push([x+Math.cos(angle)*rx,y,z+Math.sin(angle)*rz]);
      uv.push(i/radial,r/(rings.length-1));
    }
  }
  const stride=radial+1;
  for(let r=0;r<rings.length-1;r++){
    for(let i=0;i<radial;i++){
      const a=r*stride+i,b=a+stride;
      indices.push(a,b,a+1,a+1,b,b+1);
    }
  }
  if(cap)for(const r of [0,rings.length-1]){
    const {x,y,z}=rings[r],center=points.length;
    points.push([x,y,z]); uv.push(.5,r?1:0);
    for(let i=0;i<radial;i++){const a=r*stride+i;indices.push(center,r?a+1:a,r?a:a+1);}
  }
  return {bone,points,uv,indices,cloth,radial,rows:rings.length,stride};
}

const rotateX=(p,a)=>[p[0],p[1]*Math.cos(a)-p[2]*Math.sin(a),p[1]*Math.sin(a)+p[2]*Math.cos(a)];
const rotateZ=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a),p[2]];
export function poseTransform(bones){
  const result=new Map();
  for(const bone of bones){
    const parent=result.get(bone.parent);
    const toParent=p=>add(bone.position,rotateZ(rotateX(sub(p,bone.position),bone.rx),bone.rz));
    const fromParent=p=>add(bone.position,rotateX(rotateZ(sub(p,bone.position),-bone.rz),-bone.rx));
    result.set(bone.name,{
      toWorld:p=>parent?parent.toWorld(toParent(p)):toParent(p),
      toRest:p=>fromParent(parent?parent.toRest(p):p)
    });
  }
  return result;
}

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const RAY=[1,.01319,.02723];
const CELL_CM=6;
const rayCell=(point,axis)=>Math.floor((point[axis]-RAY[axis]*point[0])/CELL_CM);
const cellKey=(y,z)=>y+':'+z;

export function poseSurfacePoint(part, index, transforms){
  const point=part.points[index];
  if(!part.skin)return transforms.get(part.bone).toWorld(point);
  const result=[0,0,0];
  for(const [bone,weight] of part.skin[index]){
    const posed=transforms.get(bone).toWorld(point);
    for(let axis=0;axis<3;axis++)result[axis]+=posed[axis]*weight;
  }
  return result;
}

export function buildCollider(body, transforms){
  return body.map(part=>{
    const points=part.points.map((_,i)=>poseSurfacePoint(part,i,transforms));
    const min=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis])));
    const max=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])));
    // Every point on a ray has the same projected Y/Z. Index the triangles in that plane.
    const bins=new Map();
    for(let i=0;i<part.indices.length;i+=3){
      const [a,b,c]=part.indices.slice(i,i+3).map(index=>points[index]);
      const e1=sub(b,a),e2=sub(c,a),h=cross(RAY,e2),det=dot(e1,h);
      if(Math.abs(det)<=1e-8)continue;
      const face={a,e1,e2,h,inv:1/det};
      const ys=[rayCell(a,1),rayCell(b,1),rayCell(c,1)];
      const zs=[rayCell(a,2),rayCell(b,2),rayCell(c,2)];
      for(let y=Math.min(...ys);y<=Math.max(...ys);y++)for(let z=Math.min(...zs);z<=Math.max(...zs);z++){
        const key=cellKey(y,z);
        if(!bins.has(key))bins.set(key,[]);
        bins.get(key).push(face);
      }
    }
    return {min,max,bins};
  });
}

export function bodyRayExits(point, colliders){
  const containing=[];
  for(const {min,max,bins} of colliders){
    if(point.some((v,i)=>v<=min[i]+1e-5||v>=max[i]-1e-5))continue;
    const faces=bins.get(cellKey(rayCell(point,1),rayCell(point,2)));
    if(!faces)continue;
    const hits=[];
    for(const {a,e1,e2,h,inv} of faces){
      const s=sub(point,a),u=inv*dot(s,h);
      if(u<0||u>1)continue;
      const q=cross(s,e1),v=inv*dot(RAY,q);
      if(v<0||u+v>1)continue;
      const distance=inv*dot(e2,q);
      if(Math.abs(distance)<1e-5){hits.length=0;break;}
      if(!hits.some(t=>Math.abs(t-distance)<1e-5))hits.push(distance);
    }
    const forward=hits.filter(t=>t>0), backward=hits.filter(t=>t<0);
    if(forward.length%2===1&&backward.length%2===1)containing.push({positive:Math.min(...forward),negative:Math.max(...backward)});
  }
  return containing;
}

export function measurePenetration(parts, transforms, colliders){
  let testedVertices=0,penetratingVertices=0;
  for(const part of parts)for(let i=0;i<part.points.length;i++){
    testedVertices++;
    if(bodyRayExits(poseSurfacePoint(part,i,transforms),colliders).length)penetratingVertices++;
  }
  return {testedVertices,penetratingVertices,ratio:testedVertices?penetratingVertices/testedVertices:null};
}

function moveOutside(point, colliders){
  const exits=bodyRayExits(point,colliders);
  if(!exits.length)return point;
  const positive=Math.max(...exits.map(x=>x.positive)),negative=Math.min(...exits.map(x=>x.negative));
  const sign=point[0]<-1 ? -1 : point[0]>1 ? 1 : positive<=-negative ? 1 : -1;
  let current=point,hits=exits;
  for(let i=0;i<16;i++){
    const distance=sign>0?Math.max(...hits.map(x=>x.positive)):Math.min(...hits.map(x=>x.negative));
    // A larger clearance can pass through a narrow opening into another limb.
    const next=add(current,RAY.map(v=>v*(distance+sign*.55)));
    const nextHits=bodyRayExits(next,colliders);
    if(!nextHits.length)return next;
    for(const clearance of [.12,.025]){
      const candidate=add(current,RAY.map(v=>v*(distance+sign*clearance)));
      if(!bodyRayExits(candidate,colliders).length)return candidate;
    }
    current=next;
    hits=nextHits;
  }
  return current;
}

let lastMannequin;
function posedMannequin(value,pose,radial){
  const layout=createRigLayout(value,pose),key=JSON.stringify([layout.m,pose,radial]);
  if(lastMannequin?.key===key)return lastMannequin;
  const body=[buildMannequinSurface(layout,radial)];
  const transforms=poseTransform(layout.bones),colliders=buildCollider(body,transforms);
  lastMannequin={key,layout,body,transforms,colliders,radial};
  return lastMannequin;
}

export function buildStudioGeometry(value, items=[], {pose='standing',radial=20}={}){
  const {layout,body,transforms,colliders}=posedMannequin(value,pose,radial);
  const shape=garmentReferenceSections(layout);
  const sorted=items.slice(0,MAX_PROCEDURAL_ITEMS).sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0));
  const garments=sorted.map((item,i)=>{
    const shells=referenceShell(item,layout,shape,(item.layer==='outer'?1.6:0)+i*.48).map(desc=>tessellate(desc,radial));
    const parts=shells.map(part=>{
      const {toWorld,toRest}=transforms.get(part.bone);
      return {...part,points:part.points.map(point=>{
        const posed=toWorld(point), corrected=moveOutside(posed,colliders);
        return corrected===posed ? point : toRest(corrected);
      })};
    });
    return {item,parts};
  });
  const triangles=[...body,...garments.flatMap(x=>x.parts)].reduce((sum,x)=>sum+x.indices.length/3,0);
  return {layout,body,garments,transforms,colliders,triangles,radial};
}

export function buildBodyMorphs(value, radial=20){
  const actual=normalizeMannequin(value), dimensions={...MANNEQUIN_DEFAULTS_CM};
  const geometry=()=>[buildMannequinSurface(createRigLayout(dimensions),radial)];
  const base=geometry(),targets=[];
  let previous=base;
  for(const [key,name] of Object.entries(MORPH_NAMES)){
    dimensions[key]=actual[key];
    const next=geometry();
    targets.push({name,parts:next.map((part,i)=>part.points.map((p,j)=>sub(p,previous[i].points[j])))});
    previous=next;
  }
  return {base,targets};
}
