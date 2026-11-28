import {BONE_NAMES, MAX_SCENE_TRIANGLES} from './geometry.js';

export const MAX_TEXTURE_EDGE = 2048;
const GLB_MAGIC=0x46546c67, JSON_CHUNK=0x4e4f534a, BIN_CHUNK=0x004e4942;
const positiveInt = value => Number.isSafeInteger(value)&&value>0;
const fail = message => {throw new Error(message);};

function imageSize(bytes,mime){
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(mime==='image/png'&&bytes.length>=24&&data.getUint32(0)===0x89504e47){
    return [data.getUint32(16),data.getUint32(20)];
  }
  if(mime==='image/ktx2'&&bytes.length>=48&&data.getUint32(0)===0xab4b5458&&data.getUint32(4)===0x203230bb){
    if(data.getUint32(28,true)>1||data.getUint32(32,true)>1||data.getUint32(36,true)!==1) fail('KTX2 chỉ hỗ trợ texture 2D.');
    return [data.getUint32(20,true),data.getUint32(24,true)];
  }
  if(mime==='image/jpeg'&&bytes.length>4&&data.getUint16(0)===0xffd8){
    let offset=2;
    while(offset+7<bytes.length&&bytes[offset]===255){
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(offset+7>=bytes.length||marker===0xda||marker===0xd9)break;
      const length=data.getUint16(offset);
      if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
        return [data.getUint16(offset+5),data.getUint16(offset+3)];
      }
      offset+=length;
    }
  }
  fail('Texture GLB phải là PNG, JPEG hoặc KTX2 hợp lệ.');
}

export function inspectGarmentGlb(bytes, {triangleBudget=MAX_SCENE_TRIANGLES, requireContract=true}={}){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(data.byteLength<20||data.byteLength>12*1024*1024)fail('GLB không hợp lệ hoặc quá 12 MB.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(view.getUint32(0,true)!==GLB_MAGIC||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.length)fail('Cần tệp GLB phiên bản 2.');
  const size=view.getUint32(12,true),end=20+size;
  if(!size||size>1024*1024||size%4||end+8>data.length||view.getUint32(16,true)!==JSON_CHUNK)fail('GLB thiếu JSON hoặc vượt giới hạn.');
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(20,end)));
  const binaryLength=view.getUint32(end,true);
  if(view.getUint32(end+4,true)!==BIN_CHUNK||end+8+binaryLength!==data.length||binaryLength%4)fail('GLB cần một khối nhị phân nhúng.');
  if(json.asset?.version!=='2.0'||json.buffers?.length!==1||!positiveInt(json.buffers[0].byteLength)||json.buffers[0].byteLength>binaryLength)fail('Cấu trúc GLB nhúng không hợp lệ.');

  const stack=[json];
  while(stack.length){
    const object=stack.pop();
    for(const [key,value] of Object.entries(object)){
      if(key==='uri')fail('GLB chỉ nhận tài nguyên nhúng trong tệp.');
      if(value&&typeof value==='object')stack.push(value);
    }
  }
  const meshCounts=(json.meshes||[]).map(mesh=>(mesh.primitives||[]).reduce((sum,primitive)=>{
    if(primitive.mode!=null&&primitive.mode!==4)fail('Chỉ hỗ trợ primitive tam giác.');
    const positions=json.accessors?.[primitive.attributes?.POSITION]?.count;
    const count=primitive.indices!=null?json.accessors?.[primitive.indices]?.count:positions;
    if(!positiveInt(positions)||positions>MAX_SCENE_TRIANGLES*3||!positiveInt(count)||count%3)fail('Accessor tam giác GLB không hợp lệ.');
    return sum+count/3;
  },0));
  if((json.nodes?.length||0)>256||(json.accessors?.length||0)>512||(json.images?.length||0)>12)fail('GLB vượt giới hạn độ phức tạp.');
  let triangles=0;
  for(const node of json.nodes||[]){
    if(node.extensions?.EXT_mesh_gpu_instancing)fail('GLB nhập không hỗ trợ GPU instancing.');
    if(node.mesh!=null)triangles+=meshCounts[node.mesh]||0;
    if(triangles>triangleBudget)fail('GLB vượt ngân sách tam giác còn lại.');
  }
  if(!triangles)fail('GLB không có lưới tam giác.');
  const textureSizes=[];
  for(const image of json.images||[]){
    const bufferView=json.bufferViews?.[image.bufferView], offset=bufferView?.byteOffset??0, length=bufferView?.byteLength;
    if(bufferView?.buffer!==0||!Number.isSafeInteger(offset)||offset<0||!positiveInt(length)||offset+length>binaryLength)fail('Texture GLB phải nằm trong buffer nhúng.');
    const dimensions=imageSize(data.subarray(end+8+offset,end+8+offset+length),image.mimeType);
    if(dimensions.some(edge=>!positiveInt(edge)||edge>MAX_TEXTURE_EDGE))fail('Texture GLB vượt 2048 px mỗi cạnh.');
    textureSizes.push(dimensions);
  }

  const contract=json.asset.extras?.photoLens;
  if(requireContract){
    if(contract?.schemaVersion!==1||contract.unit!=='m'||contract.upAxis!=='Y'||!['anchor','rigged'].includes(contract.binding)||!BONE_NAMES.includes(contract.anchor)){
      fail('GLB thiếu mốc gắn PhotoLens v1. Xem ASSET_SPEC.md.');
    }
    if(contract.binding==='rigged'){
      const nodes=json.nodes||[];
      if(!json.skins?.length||json.skins.some(skin=>!skin.joints?.length||skin.joints.some(index=>!BONE_NAMES.includes(nodes[index]?.name)))){
        fail('GLB rigged cần tên xương theo ASSET_SPEC.md.');
      }
    }else if(json.skins?.length)fail('GLB gắn cứng không được khai báo skin.');
  }
  return {json,contract,triangles,textureSizes,extensions:json.extensionsUsed||[]};
}
