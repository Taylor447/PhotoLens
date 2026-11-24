import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cutFor,garmentPortrait} from '../core/wardrobe/illustrations.js';
import {patternTile,fabricFinish} from '../core/wardrobe/fabric-swatches.js';
import {GARMENT_CATEGORIES,categoryPlaceholderSvg,renderGarmentThumbnail,thumbnailAssetUrl} from '../features/wardrobe/thumbnail.js';

const catalog=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../data/wardrobe/assets-manifest.json',import.meta.url),'utf8'));
const byId=new Map(manifest.assets.map(asset=>[asset.id,asset]));

test('the bundled UTF-8 text preserves the recovered Vietnamese names and notes',()=>{
 const decoder=new TextDecoder('utf-8',{fatal:true});
 for(const filename of ['garments','assets-manifest','patterns','materials']){
  const text=decoder.decode(readFileSync(new URL('../data/wardrobe/'+filename+'.json',import.meta.url)));
  assert.ok(!text.includes('\uFFFD'),filename);
 }
 for(const {id,name,culturalNote} of catalog.templates)assert.doesNotMatch(name+(culturalNote||''),/[?\uFFFD]/u,id);
 assert.deepEqual(catalog.templates.slice(0,4).map(item=>item.name),['Áo thun cơ bản','Sơ mi dáng thẳng','Áo dài minh họa','Áo bà ba minh họa']);
});

test('all template cuts are unique independently of text, colour, material and pattern',()=>{
 const outlines=catalog.templates.map(item=>cutFor(item).drawing[0]);
 assert.equal(new Set(outlines).size,catalog.templates.length);
 assert.equal(cutFor({id:'tpl-unknown-1',category:'unknown'}),null);
 for(const item of catalog.templates){
  const recorded=byId.get(item.assets.thumbnail.id);
  assert.equal(garmentPortrait(item),readFileSync(new URL('../public/'+recorded.path,import.meta.url),'utf8'));
 }
});

test('personal variants use the original cut with current fabric, colour, width and length',()=>{
 const item={...catalog.templates[1],id:'personal-123',color:'#781f26',parameters:{width:'wide',length:'long'}};
 const html=renderGarmentThumbnail(item);
 const portrait=garmentPortrait(item);
 assert.ok(html.includes(encodeURIComponent(portrait)));
 assert.ok(portrait.includes(cutFor(item).drawing[0]));
 assert.match(portrait,/#781f26/);
 assert.match(portrait,/scale\(1.1 1.08\)/);
 const json=key=>JSON.parse(readFileSync(new URL('../data/wardrobe/'+key+'.json',import.meta.url),'utf8'))[key];
 assert.equal(new Set(json('patterns').map(({id})=>patternTile(id))).size,40);
 assert.equal(new Set(json('materials').map(({id})=>JSON.stringify(fabricFinish(id)))).size,20);
});
const labels={tops:'Áo',bottoms:'Quần',skirts:'Váy',dresses:'Váy / đầm',outerwear:'Áo khoác',shoes:'Giày dép',hats:'Mũ',bags:'Túi',eyewear:'Kính',scarves:'Khăn',jewelry:'Trang sức',hair:'Phụ kiện tóc'};

test('each bundled garment card maps to its own generated preview, manifest path and matching category',()=>{
 assert.equal(catalog.templates.length,60);
 const seen=new Set();
 for(const garment of catalog.templates){
  const thumb=garment.assets.thumbnail;
  assert.ok(thumb,garment.id+' has no thumbnail reference');
  assert.equal(thumb.id,'thumbnail:'+garment.id);
  assert.equal(thumb.provenance,'generated-by-photolens');
  assert.match(thumb.path,/^assets\/wardrobe\/previews\/[a-z0-9-]+\.svg$/);
  assert.ok(!seen.has(thumb.path),thumb.path+' is shared by multiple garments');seen.add(thumb.path);
  const rendered=renderGarmentThumbnail(garment,{base:'/PhotoLens/',categoryLabel:labels[garment.category]});
  assert.ok(rendered.includes('src="/PhotoLens/'+thumb.path+'"'),garment.id+' card URL mismatch');
  assert.ok(rendered.includes('alt="Xem trước '+labels[garment.category]+': '+garment.name+'"'),garment.id+' card alt category mismatch');
  const record=byId.get(thumb.id);
  assert.ok(record,garment.id+' missing from asset manifest');
  assert.equal(record.format,'thumbnail-svg');
  assert.equal(record.path,thumb.path);
  const bytes=readFileSync(new URL('../public/'+thumb.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,garment.id+' checksum');
  const svg=bytes.toString('utf8');
  assert.ok(svg.includes('data-garment-id="'+garment.id+'"'),garment.id+' ID mismatch');
  assert.ok(svg.includes('data-garment-category="'+garment.category+'"'),garment.id+' category mismatch');
  assert.ok(svg.includes('data-garment="'+garment.id+'"'),garment.id+' has no rendered garment geometry');
 }
 assert.equal(seen.size,60);
});

test('template preview URL respects the app base path and rejects unsafe paths',()=>{
 assert.equal(thumbnailAssetUrl('assets/wardrobe/previews/tpl-tops-1.svg','/'),'/assets/wardrobe/previews/tpl-tops-1.svg');
 assert.equal(thumbnailAssetUrl('assets/wardrobe/previews/tpl-tops-1.svg','/PhotoLens/'),'/PhotoLens/assets/wardrobe/previews/tpl-tops-1.svg');
 assert.equal(thumbnailAssetUrl('../assets/other.svg','/PhotoLens/'),null);
 assert.equal(thumbnailAssetUrl('/absolute.svg','/PhotoLens/'),null);
});

test('fallback illustrations are category-specific instead of reusing a shirt icon',()=>{
 assert.deepEqual(new Set(GARMENT_CATEGORIES),new Set(['tops','bottoms','skirts','dresses','outerwear','shoes','hats','bags','eyewear','scarves','jewelry','hair']));
 const byCategory=GARMENT_CATEGORIES.map(category=>[category,categoryPlaceholderSvg(category)]);
 assert.equal(new Set(byCategory.map(([,svg])=>svg)).size,GARMENT_CATEGORIES.length);
 for(const [category,svg] of byCategory)assert.ok(svg.includes('data-placeholder-category="'+category+'"'));
 const local=renderGarmentThumbnail({name:'Giày cá nhân',category:'shoes',imageAssetId:'asset-1'});
 assert.ok(local.includes('data-ws-asset-id="asset-1"'));
 assert.ok(local.includes('data-placeholder-category="shoes"'));
});
