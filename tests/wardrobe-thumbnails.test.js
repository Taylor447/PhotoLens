import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {GARMENT_CATEGORIES,categoryPlaceholderSvg,renderGarmentThumbnail,thumbnailAssetUrl} from '../features/wardrobe/thumbnail.js';

const catalog=JSON.parse(readFileSync(new URL('../data/wardrobe/garments.json',import.meta.url),'utf8'));
const manifest=JSON.parse(readFileSync(new URL('../data/wardrobe/assets-manifest.json',import.meta.url),'utf8'));
const byId=new Map(manifest.assets.map(asset=>[asset.id,asset]));
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
