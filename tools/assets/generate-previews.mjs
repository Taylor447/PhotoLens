import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {garmentPortrait} from '../../core/wardrobe/illustrations.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const catalogPath=path.join(root,'data/wardrobe/garments.json');
const manifestPath=path.join(root,'data/wardrobe/assets-manifest.json');
const outputRoot=path.join(root,'public/assets/wardrobe/previews');
const catalog=JSON.parse(readFileSync(catalogPath,'utf8'));
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const thumbRecords=[];
const check = process.argv.includes('--check');
function output(file, bytes) {
 if (check) {
  // Text checkouts can use CRLF. Digests of the SVG bytes remain exact.
  const existing=readFileSync(file);
  const equal=file.endsWith('.json')
   ? existing.toString('utf8').replace(/\r\n/g,'\n')===bytes.toString()
   : existing.equals(Buffer.from(bytes));
  if(!equal)throw new Error('Stale generated asset: '+path.relative(root,file)+'. Run npm run assets:previews.');
 } else {
  mkdirSync(path.dirname(file),{recursive:true});
  writeFileSync(file,bytes);
 }
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const item of catalog.templates){
 if(!/^[a-z0-9-]+$/i.test(item.id))throw new Error('Invalid template ID: '+item.id);
 const file=path.join(outputRoot,item.id+'.svg');
 const assetPath='assets/wardrobe/previews/'+item.id+'.svg';
 const svg=garmentPortrait(item);
 if(!svg)throw new Error('Missing drawing: '+item.id);
 const bytes=Buffer.from(svg,'utf8');
 output(file,bytes);
 const id='thumbnail:'+item.id,sha256=digest(bytes);
 item.assets.thumbnail={id,provenance:'generated-by-photolens',path:assetPath};
 thumbRecords.push({id,templateId:item.id,format:'thumbnail-svg',generator:'core/wardrobe/illustrations.js#garmentPortrait',source:'PhotoLens procedural code',license:'CC0',author:'PhotoLens project',path:assetPath,sha256});
}
manifest.assets=manifest.assets.filter(x=>x.format!=='thumbnail-svg').concat(thumbRecords).sort((a,b)=>a.id.localeCompare(b.id));
output(catalogPath,JSON.stringify(catalog,null,2)+'\n');
output(manifestPath,JSON.stringify(manifest,null,2)+'\n');
process.stdout.write(JSON.stringify({operation:check?'checked':'generated',files:thumbRecords.length,placeholderTemplates:0,templateCount:catalog.templates.length,manifestEntries:manifest.assets.length,byCategory:Object.fromEntries([...new Set(catalog.templates.map(x=>x.category))].map(category=>[category,catalog.templates.filter(x=>x.category===category).length]))},null,2)+'\n');
