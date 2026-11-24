import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,extname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildSvgLook,safeSvgText} from '../../core/wardrobe-engine.js';
import {inspectGarmentGlb} from '../../features/wardrobe/studio3d/glb.js';
import {makeProceduralGarmentGlb,packGlb} from '../../features/wardrobe/studio3d/export-glb.js';

function check(file){
  const bytes=readFileSync(file),ext=extname(file).toLowerCase();
  if(ext==='.glb'){
    const {contract,triangles,textureSizes,extensions}=inspectGarmentGlb(bytes);
    return {format:'glb',triangles,textureSizes,extensions,contract};
  }
  if(ext!=='.svg')throw new Error('Only .svg and .glb assets are supported.');
  const svg=bytes.toString('utf8');
  if(safeSvgText(svg)!==svg||!/<svg\b[^>]*\bviewBox=["']0 0 410 450["']/.test(svg)||!/\bdata-garment=["'][\w-]+["']/.test(svg)){
    throw new Error('SVG must have the PhotoLens viewBox and a named garment region, without external or active content.');
  }
  return {format:'svg',viewBox:[0,0,410,450]};
}
function provenance(source,license,author){
  if([source,license,author].some(x=>!x?.trim()||/^(unknown|none|n\/a|unspecified)$/i.test(x.trim()))||
    !/^(CC0|CC0-1\.0|CC-BY-4\.0|MIT|Apache-2\.0|BSD-[23]-Clause|LicenseRef-CommercialPermission)$/.test(license)){
    throw new Error('Record the source, author and a license allowing commercial use. Document written permission for LicenseRef-CommercialPermission.');
  }
  return {source,license,author};
}
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const writeJson=(file,content)=>writeFileSync(file,JSON.stringify(content,null,2)+'\n');
function makeBundle(templateId,out){
  const catalog=JSON.parse(readFileSync(new URL('../../data/wardrobe/garments.json',import.meta.url)));
  const item=catalog.templates.find(entry=>entry.id===templateId);
  if(!item||!out)throw new Error('Specify a template ID and an output directory.');
  mkdirSync(out,{recursive:true});
  const svg=resolve(out,templateId+'.svg'),glb=resolve(out,templateId+'.glb');
  writeFileSync(svg,safeSvgText(buildSvgLook([item],{flatLay:true})));
  writeFileSync(glb,makeProceduralGarmentGlb(item));
  const assets=[svg,glb].map(file=>({
    file:basename(file),...check(file),sha256:digest(file),
    ...provenance('PhotoLens generated code','CC0','PhotoLens project')
  }));
  writeJson(resolve(out,'manifest.json'),{schemaVersion:1,templateId,thumbnail:basename(svg),assets});
  return {out,assets};
}

function compress(input,output){
  if(resolve(input)===resolve(output))throw new Error('Use a separate output file.');
  const {contract}=check(input);
  if(!contract)throw new Error('Compression requires a PhotoLens GLB.');
  const run=spawnSync('gltfpack',['-i',resolve(input),'-o',resolve(output),'-cc','-tc','-kn'],{stdio:'inherit',windowsHide:true,shell:false});
  if(run.error)throw run.error;
  if(run.status!==0)throw new Error('gltfpack failed. Install the native distribution with Basis Universal support.');
  const bytes=readFileSync(output), info=inspectGarmentGlb(bytes,{requireContract:false});
  const binaryOffset=28+bytes.readUInt32LE(12);
  info.json.asset.extras={...info.json.asset.extras,photoLens:contract};
  const sealed=packGlb(info.json,bytes.subarray(binaryOffset));
  inspectGarmentGlb(sealed);
  writeFileSync(output,sealed);
  return {...check(output),sha256:digest(output)};
}

const [command,input,arg1,arg2,arg3,arg4]=process.argv.slice(2);
try{
  let result;
  if(command==='generate')result=makeBundle(input,arg1);
  else if(command==='inspect')result={file:basename(input),...check(input),sha256:digest(input)};
  else if(command==='manifest'){
    const record={file:basename(input),...check(input),sha256:digest(input),...provenance(arg2,arg3,arg4)};
    writeJson(arg1,{schemaVersion:1,assets:[record]});result=record;
  }else if(command==='compress')result=compress(input,arg1);
  else throw new Error('Usage: generate TEMPLATE OUTPUT_DIR | inspect FILE | manifest FILE OUTPUT_JSON SOURCE LICENSE AUTHOR | compress INPUT_GLB OUTPUT_GLB');
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
