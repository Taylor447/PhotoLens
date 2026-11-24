import {buildStudioGeometry} from './geometry.js';
import {surfaceNormals} from './tailored-mesh.js';

export function packGlb(json,binary){
  const encoded=new TextEncoder().encode(JSON.stringify(json));
  const jsonLength=Math.ceil(encoded.length/4)*4, binLength=Math.ceil(binary.length/4)*4;
  const bytes=new Uint8Array(28+jsonLength+binLength), view=new DataView(bytes.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,bytes.length,true);
  view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);
  bytes.fill(0x20,20,20+jsonLength);bytes.set(encoded,20);
  view.setUint32(20+jsonLength,binLength,true);view.setUint32(24+jsonLength,0x004e4942,true);
  bytes.set(binary,28+jsonLength);
  return bytes;
}

export function makeProceduralGarmentGlb(item,measurements){
  const model=buildStudioGeometry(measurements,[item]);
  const json={
    asset:{version:'2.0',generator:'PhotoLens procedural garment',extras:{
      photoLens:{schemaVersion:1,unit:'m',upAxis:'Y',binding:'rigged',anchor:'Root',templateId:item.id,reference:'PhotoLens reference mannequin'}
    }},
    scenes:[{nodes:[0,1]}],scene:0,nodes:[{mesh:0,skin:0,name:'Garment'}],
    meshes:[{name:item.name,primitives:[]}],buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[]
  };
  const color=/^#[0-9a-f]{6}$/i.test(item.color)?item.color:'#647d69';
  const channels=[1,3,5].map(offset=>{
    const s=parseInt(color.slice(offset,offset+2),16)/255;
    return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
  });
  json.materials.push({name:'main',doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...channels,1],roughnessFactor:.84,metallicFactor:0}});
  const chunks=[];
  let offset=0;
  function accessor(values,type,componentType,target,bounds){
    const bufferView=json.bufferViews.length;
    json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:values.byteLength,...(target?{target}:{})});
    chunks.push({offset,bytes:new Uint8Array(values.buffer)});
    offset+=Math.ceil(values.byteLength/4)*4;
    const count=values.length/({VEC2:2,VEC3:3,VEC4:4,MAT4:16}[type]||1);
    json.accessors.push({bufferView,componentType,count,type,...bounds});
    return json.accessors.length-1;
  }
  const bones=model.layout.bones;
  const joints=new Map(bones.map((bone,index)=>[bone.name,index]));
  for(const bone of bones){
    const parent=bones[joints.get(bone.parent)];
    const translation=bone.position.map((v,i)=>(v-(parent?.position[i]||0))/100);
    const children=bones.flatMap((child,i)=>child.parent===bone.name?[i+1]:[]);
    json.nodes.push({name:bone.name,translation,...(children.length?{children}:{})});
  }
  const inverseBindMatrices=Float32Array.from(bones.flatMap(({position:[x,y,z]})=>[
    1,0,0,0, 0,1,0,0, 0,0,1,0, -x/100,-y/100,-z/100,1
  ]));
  json.skins=[{skeleton:1,joints:bones.map((_,i)=>i+1),
    inverseBindMatrices:accessor(inverseBindMatrices,'MAT4',5126)}];
  for(const part of model.garments[0].parts){
    const points=part.points.map(point=>point.map(value=>Math.fround(value/100)));
    const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
    const POSITION=accessor(Float32Array.from(points.flat()),'VEC3',5126,34962,{min,max});
    const NORMAL=accessor(Float32Array.from(surfaceNormals(part).flat()),'VEC3',5126,34962);
    const TEXCOORD_0=accessor(Float32Array.from(part.uv),'VEC2',5126,34962);
    const jointIndices=new Uint8Array(points.length*4), weights=new Float32Array(points.length*4);
    for(let i=0;i<points.length;i++)for(const [slot,[joint,weight]] of (part.skin?.[i]||[[part.bone,1]]).entries()){
      jointIndices[4*i+slot]=joints.get(joint);
      weights[4*i+slot]=weight;
    }
    const JOINTS_0=accessor(jointIndices,'VEC4',5121,34962);
    const WEIGHTS_0=accessor(weights,'VEC4',5126,34962);
    const indices=accessor(Uint16Array.from(part.indices),'SCALAR',5123,34963);
    json.meshes[0].primitives.push({attributes:{POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0},indices,material:0,mode:4});
  }
  const contents=new Uint8Array(offset);
  for(const chunk of chunks)contents.set(chunk.bytes,chunk.offset);
  json.buffers[0].byteLength=contents.length;
  return packGlb(json,contents);
}
