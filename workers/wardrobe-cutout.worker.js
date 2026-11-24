const MODEL_URL='https://huggingface.co/edgetools/u2netp/resolve/25dee37ab19c5b6ad64ba6578eba63f1ae07720c/u2netp.onnx';
const MODEL_BYTES=4574861;
const MODEL_SHA256='309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
const RUNTIME_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
const CACHE_NAME='photolens-u2netp-'+MODEL_SHA256;
let sessionPromise;
const progress=stage=>self.postMessage({type:'progress',stage});
async function sha256(buffer){
 const digest=await crypto.subtle.digest('SHA-256',buffer);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function getModel(){
 const cache=globalThis.caches?await caches.open(CACHE_NAME).catch(()=>null):null;
 if(cache){
  const hit=await cache.match(MODEL_URL);
  if(hit){
   const buffer=await hit.arrayBuffer();
   if(buffer.byteLength===MODEL_BYTES&&await sha256(buffer)===MODEL_SHA256)return buffer;
   await cache.delete(MODEL_URL);
  }
 }
 progress('model');
 const response=await fetch(MODEL_URL,{mode:'cors',credentials:'omit',cache:'force-cache'});
 if(!response.ok)throw new Error('Không tải được model. Hãy kiểm tra mạng.');
 const buffer=await response.arrayBuffer();
 if(buffer.byteLength!==MODEL_BYTES||await sha256(buffer)!==MODEL_SHA256)throw new Error('Model không khớp kích thước/SHA-256 đã ghim.');
 if(cache)await cache.put(MODEL_URL,new Response(buffer.slice(0),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public,max-age=31536000'}})).catch(()=>{});
 return buffer;
}
async function getSession(){
 if(sessionPromise)return sessionPromise;
 sessionPromise=(async()=>{
  progress('runtime');
  importScripts(RUNTIME_BASE+'ort.min.js');
  const ort=self.ort;
  if(!ort?.InferenceSession)throw new Error('ONNX Runtime Web không tải được.');
  ort.env.wasm.wasmPaths=RUNTIME_BASE;
  ort.env.wasm.numThreads=1;
  ort.env.wasm.proxy=false;
  const model=await getModel();
  return ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 })();
 try{return await sessionPromise;}catch(error){sessionPromise=null;throw error;}
}
self.addEventListener('message',async event=>{
 if(event.data?.type!=='cutout')return;
 let bitmap;
 try{
  progress('infer');
  const session=await getSession();
  bitmap=await createImageBitmap(event.data.file);
  const canvas=new OffscreenCanvas(320,320),ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,320,320);
  const image=ctx.getImageData(0,0,320,320).data;
  const tensor=new Float32Array(3*320*320),mean=[.485,.456,.406],std=[.229,.224,.225];
  for(let i=0;i<320*320;i++){
   tensor[i]=(image[i*4]/255-mean[0])/std[0];
   tensor[320*320+i]=(image[i*4+1]/255-mean[1])/std[1];
   tensor[2*320*320+i]=(image[i*4+2]/255-mean[2])/std[2];
  }
  const ort=self.ort,inputName=session.inputNames[0],outputName=session.outputNames[0];
  const result=await session.run({[inputName]:new ort.Tensor('float32',tensor,[1,3,320,320])});
  const saliency=result[outputName].data;
  if(saliency.length!==320*320)throw new Error('Kích thước mặt nạ model không đúng.');
  let min=Infinity,max=-Infinity;
  for(const value of saliency){if(value<min)min=value;if(value>max)max=value;}
  const range=max-min,mask=new Uint8Array(320*320);
  if(!Number.isFinite(range)||range<1e-8)throw new Error('Model không tạo được mặt nạ dùng được.');
  for(let i=0;i<mask.length;i++)mask[i]=Math.max(0,Math.min(255,Math.round((saliency[i]-min)/range*255)));
  self.postMessage({type:'mask',mask:mask.buffer},[mask.buffer]);
 }catch(error){self.postMessage({type:'error',message:String(error?.message||'Lỗi xử lý ảnh cục bộ.')});}
 finally{bitmap?.close?.();}
});
