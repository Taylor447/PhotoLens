import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash as hash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const config=readFileSync(path.join(root,'vite.config.js'),'utf8');
const base=config.match(/base:\s*['"]([^'"]+)['"]/)?.[1];
assert.ok(base?.startsWith('/')&&base.endsWith('/'),'Vite base path must be a rooted directory');
const manifest=JSON.parse(readFileSync(path.join(root,'data/wardrobe/assets-manifest.json'),'utf8'));
const thumbnails=manifest.assets.filter(asset=>asset.format==='thumbnail-svg');
assert.equal(thumbnails.length,60,'Expected 60 generated thumbnail assets before build');
for(const asset of thumbnails){
 const built=path.join(root,'dist',asset.path);
 assert.ok(statSync(built).isFile(),'Built preview missing: '+base+asset.path);
 const bytes=readFileSync(built);
 assert.equal(createHash(bytes),asset.sha256,'Built preview differs from manifest: '+asset.path);
}
function createHash(bytes){return hash('sha256').update(bytes).digest('hex');}
