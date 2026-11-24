const SHAPES={
 tops:'<path d="M29 24 40 17h20l11 7 17 24-13 6-8-11v39H33V43l-8 11-13-6z"/>',
 bottoms:'<path d="M30 18h40l-3 28-4 35H48l-4-32-4 32H24l4-35z"/>',
 skirts:'<path d="M35 18h30l19 63H16z"/>',
 dresses:'<path d="M39 17h22l9 16 8 48H22l8-48z"/>',
 outerwear:'<path d="M31 21 42 16h16l11 5 18 28-13 7-8-11v39H34V45l-8 11-13-7z"/><path d="m42 17 8 18 8-18"/>',
 shoes:'<path d="M12 61h27l10 13v9H11Q5 79 12 61Zm49 0h17l11 13v9H53q-6-4 8-22Z"/>',
 hats:'<path d="M15 57q4-8 24-9l7-25q5-9 13 0l7 25q18 1 20 9l-3 7H18z"/>',
 bags:'<path d="M24 35h52l7 48H17z"/><path d="M35 36q1-23 15-23t15 23" fill="none" stroke-width="6"/>',
 eyewear:'<path d="M12 39h31l-3 23q-2 8-11 8T17 61zm45 0h31l-5 22q-2 9-12 9T60 61z"/><path d="M43 45q7-6 14 0"/>',
 scarves:'<path d="M36 18h28l-5 24 18 34-13 9-21-31-15 30-13-8 20-35z"/>',
 jewelry:'<path d="M24 22q26 56 52 0" fill="none" stroke-width="5"/><circle cx="50" cy="66" r="9"/><circle cx="24" cy="27" r="6"/><circle cx="76" cy="27" r="6"/>',
 hair:'<path d="m24 35 12-16 14 11 14-11 12 16-13 12 13 13-12 15-14-12-14 12-12-15 13-13z"/><circle cx="50" cy="48" r="7" fill="#eef2ef"/>'
};
export const GARMENT_CATEGORIES=Object.keys(SHAPES);
export function categoryPlaceholderSvg(category){
 const shape=SHAPES[category]||'<circle cx="50" cy="50" r="25"/>';
 const safe=GARMENT_CATEGORIES.includes(category)?category:'other';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Hình minh họa '+safe+'" data-placeholder-category="'+safe+'"><rect x="3" y="3" width="94" height="94" rx="16" fill="#eef2ef"/><g fill="#9bac9f" stroke="#53665b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'+shape+'</g></svg>';
}
export function thumbnailAssetUrl(path,base='/'){
 if(typeof path!=='string'||!/^assets\/wardrobe\/previews\/[\w.-]+\.svg$/.test(path))return null;
 const root=base.endsWith('/')?base:base+'/';
 return root+path;
}

const CATEGORY_LABELS={tops:'Áo',bottoms:'Quần',skirts:'Váy',dresses:'Đầm',outerwear:'Áo khoác',shoes:'Giày',hats:'Mũ',bags:'Túi',eyewear:'Kính',scarves:'Khăn',jewelry:'Trang sức',hair:'Phụ kiện tóc'};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function renderGarmentThumbnail(item,{base='/',categoryLabel=CATEGORY_LABELS[item?.category]||'Trang phục'}={}){
 const id=typeof item?.imageAssetId==='string'?item.imageAssetId:'';
 const src=id?null:thumbnailAssetUrl(item?.assets?.thumbnail?.path,base);
 const name=escapeHtml(item?.name||'Món đồ'),label=escapeHtml(categoryLabel);
 const image=src?'<img src="'+escapeHtml(src)+'" alt="Xem trước '+label+': '+name+'" loading="lazy" decoding="async" width="410" height="450">':categoryPlaceholderSvg(item?.category);
 const local=id?'data-ws-asset-id="'+escapeHtml(id)+'" data-ws-preview-alt="Xem trước '+label+': '+name+'" ':'';
 const color=/^#[0-9a-f]{6}$/i.test(String(item?.color||''))?item.color:'#647d69';
 return '<div class="ws-thumb" '+local+'style="--item:'+color+'">'+image+'</div>';
}

export async function renderGlbThumbnail(blob){
 const [THREE,{createLocalGlbLoader}]=await Promise.all([import('three'),import('./studio3d/load-glb.js')]);
 const canvas=document.createElement('canvas');
 canvas.width=320;canvas.height=360;
 let renderer,loader,root;
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setSize(canvas.width,canvas.height,false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor('#eef2ef',1);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eef2ef');
  const camera=new THREE.PerspectiveCamera(34,canvas.width/canvas.height,.01,100);
  scene.add(new THREE.HemisphereLight('#ffffff','#738078',2));
  const key=new THREE.DirectionalLight('#ffffff',2.5);key.position.set(3,5,6);scene.add(key);
  const fill=new THREE.DirectionalLight('#bdc9c0',1.2);fill.position.set(-4,1,-3);scene.add(fill);
  loader=createLocalGlbLoader(renderer);
  const gltf=await loader.parse(await blob.arrayBuffer());root=gltf.scene;scene.add(root);
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const max=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(max)||max<=0)throw new Error('GLB không có kích thước xem trước.');
  const scale=1.7/max;root.scale.multiplyScalar(scale);root.position.sub(center.multiplyScalar(scale));
  camera.position.set(2.4,1.8,3.5);camera.lookAt(0,0,0);
  renderer.render(scene,camera);
  const output=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được PNG xem trước.')),'image/png'));
  return output;
 }finally{
  loader?.dispose();
  root?.traverse(node=>{node.geometry?.dispose();for(const material of(Array.isArray(node.material)?node.material:node.material?[node.material]:[])){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose?.();}});
  renderer?.dispose();
 }
}
