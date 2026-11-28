import {bodyRayExits, buildBodyMorphs, buildStudioGeometry, findLayerCrossings, mannequinAimHeight, poseSurfacePoint, BODY_CLIP_LIMIT, MAX_PROCEDURAL_ITEMS, MAX_SCENE_TRIANGLES} from './wardrobe/studio3d/geometry.js';
import {inspectGarmentGlb} from './wardrobe/studio3d/glb.js';
import {createMaterialFactory} from './wardrobe/studio3d/materials.js';
import {createRenderSampler} from './wardrobe/studio3d/performance.js';
import {findFirstSurfaceConflict,prepareSurface} from './wardrobe/studio3d/surface-crossings.js';
import {lensVerticalFov,framedCameraDistance} from './wardrobe/studio3d/camera-framing.js';
export {lensVerticalFov,framedCameraDistance} from './wardrobe/studio3d/camera-framing.js';

export const WARDROBE_LIGHTING={
  golden:{label:'Gi? v�ng',sky:'#ffd397',fill:'#89766d',key:'#ffab65',power:2.8,ambient:1.25,position:[-380,245,300]},
  blue:{label:'Gi? xanh',sky:'#a2bfff',fill:'#4c507b',key:'#b9d9ff',power:1.45,ambient:1.15,position:[-280,320,350]},
  overcast:{label:'Tr?i �m u',sky:'#eef3f6',fill:'#8faaa3',key:'#f4f7ff',power:1.6,ambient:2.15,position:[-240,520,330]},
  indoor:{label:'Trong nh�',sky:'#ffe5c3',fill:'#807269',key:'#ffdbad',power:2.4,ambient:1.1,position:[-320,420,310]},
  night:{label:'D�n du?ng ban d�m',sky:'#7286ad',fill:'#303e55',key:'#ffc570',power:2.8,ambient:.65,position:[135,385,95]}
};

const hasColor=value=>/^#[0-9a-f]{6}$/i.test(value);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const deviceIsLimited=()=>Boolean(navigator.connection?.saveData||(navigator.deviceMemory??6)<=4||(navigator.hardwareConcurrency??6)<=4);

export function supportsWebGL(){
  try{
    const context=document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(context);
  }catch{return false;}
}

function disposeNode(root,sharedMaterials=false){
  const seen=new Set();
  const once=value=>{if(value&&!seen.has(value)){seen.add(value);value.dispose?.();}};
  root.traverse(object=>{
    once(object.geometry);
    if(!sharedMaterials){
      for(const material of [object.material].flat().filter(Boolean)){
        for(const value of Object.values(material))if(value?.isTexture){value.source?.data?.close?.();once(value);}
        once(material);
      }
    }
    if(object.isSkinnedMesh)once(object.skeleton);
  });
}

function buildRig(T, root, layout){
  const bones=new Map();
  for(const descriptor of layout.bones){
    const bone=new T.Bone(),parent=bones.get(descriptor.parent);
    bone.name=descriptor.name;
    bone.position.set(...descriptor.position.map((v,i)=>v-(parent?.descriptor.position[i]||0)));
    (parent?.bone||root).add(bone);
    bones.set(bone.name,{bone,descriptor});
  }
  root.updateMatrixWorld(true);
  const skeleton=new T.Skeleton([...bones.values()].map(row=>row.bone));
  return {bones,skeleton,pose(){
    for(const {bone,descriptor} of bones.values())bone.rotation.set(descriptor.rx,0,descriptor.rz,'ZYX');
    root.updateMatrixWorld(true);
  }};
}

function skinnedPart(T,root,rig,part,material,targets=[]){
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(part.points.flat(),3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));
  geometry.setIndex(part.indices);
  const joints=new Map(rig.skeleton.bones.map((bone,index)=>[bone.name,index]));
  const skinIndices=new Uint16Array(part.points.length*4), skinWeights=new Float32Array(part.points.length*4);
  for(let i=0;i<part.points.length;i++){
    const influences=part.skin?.[i]||[[part.bone,1]];
    for(const [slot,[bone,weight]] of influences.entries()){
      skinIndices[i*4+slot]=joints.get(bone);
      skinWeights[i*4+slot]=weight;
    }
  }
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndices,4));
  geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeights,4));
  geometry.computeVertexNormals();
  if(targets.length){
    geometry.morphTargetsRelative=true;
    geometry.morphAttributes.position=targets.map(({name,points})=>{
      const attribute=new T.Float32BufferAttribute(points.flat(),3);
      attribute.name=name;
      return attribute;
    });
    const fitted=geometry.clone();
    const positions=fitted.getAttribute('position');
    for(let i=0;i<positions.count;i++)positions.setXYZ(i,...targets.reduce((p,target)=>p.map((v,a)=>v+target.points[i][a]),part.points[i]));
    fitted.computeVertexNormals();
    const restNormal=geometry.getAttribute('normal').array, fittedNormal=fitted.getAttribute('normal').array;
    geometry.morphAttributes.normal=targets.map((target,index)=>{
      const values=index===targets.length-1?Float32Array.from(restNormal,(v,i)=>fittedNormal[i]-v):new Float32Array(restNormal.length);
      const attribute=new T.Float32BufferAttribute(values,3);attribute.name=target.name;return attribute;
    });
    fitted.dispose();
  }
  const mesh=new T.SkinnedMesh(geometry,material);
  mesh.frustumCulled=false;
  mesh.castShadow=mesh.receiveShadow=true;
  if(targets.length)mesh.morphTargetInfluences.fill(1);
  root.add(mesh);
  mesh.bind(rig.skeleton,root.matrixWorld);
  return mesh;
}

function arrangeFlatLay(T,root,garments,materials){
  garments.forEach(({item,parts},i)=>{
    const swatch=new T.Group();
    for(const part of parts){
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(part.points.flat(),3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));
      geometry.setIndex(part.indices);
      geometry.computeVertexNormals();
      swatch.add(new T.Mesh(geometry,materials.material(item)));
    }
    const bounds=new T.Box3().setFromObject(swatch), center=new T.Vector3(), size=new T.Vector3();
    if(bounds.isEmpty())return;
    bounds.getCenter(center);bounds.getSize(size);
    const scale=43/Math.max(size.x,size.y,1);
    swatch.scale.setScalar(scale);
    swatch.position.set((i%4-1.5)*56-center.x*scale,153-Math.floor(i/4)*54-center.y*scale,-center.z*scale);
    root.add(swatch);
  });
}

function proceduralLayerSurfaces(model){
  return model.garments.map(({item,parts})=>({item,surfaces:parts.map(part=>prepareSurface(
    part.points.map((_,index)=>poseSurfacePoint(part,index,model.transforms)),part.indices
  ))}));
}

function collectImportedSurfaces(T,root){
  const surfaces=[],point=new T.Vector3();
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry)return;
    if(mesh.isSkinnedMesh)mesh.skeleton.update();
    const position=mesh.geometry.getAttribute('position');
    if(!position||position.count<3)return;
    const index=mesh.geometry.getIndex();
    const indices=index?Array.from(index.array):Array.from({length:position.count},(_,i)=>i);
    if(indices.length<3)return;
    const points=[];
    for(let i=0;i<position.count;i++)points.push(mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).toArray());
    surfaces.push(prepareSurface(points,indices));
  });
  return surfaces;
}

async function mountImportedLayers({T,renderer,rig,root,model,source,signal,onMessage,onAssetLoad=()=>{},invalidate,addCleanup}){
  const count=model.garments.filter(({item})=>item.vectorAssetId).length;
  if(!count){onAssetLoad('Kh�ng d�ng GLB');return;}
  if(!source){onAssetLoad('Kh�ng c� ngu?n GLB c?c b?');return;}
  onAssetLoad('Dang n?p 0/'+count);
  const {createLocalGlbLoader}=await import('./wardrobe/studio3d/load-glb.js');
  if(signal.aborted)return;
  const parser=createLocalGlbLoader(renderer,signal);
  let remaining=MAX_SCENE_TRIANGLES-model.triangles-2;
  const failures=[],layerSurfaces=proceduralLayerSurfaces(model);let loaded=0,loadedBytes=0,elapsedMs=0;
  for(const {item,meshes} of model.garments){
    if(signal.aborted)break;
    if(!item.vectorAssetId)continue;
    let assetScene;const loadStarted=performance.now();
    try{
      const blob=await source(item.vectorAssetId);
      if(!blob)throw new Error('Chua t�m th?y t?p c?c b?.');
      const bytes=await blob.arrayBuffer();
      if(signal.aborted)break;
      const inspected=inspectGarmentGlb(bytes,{triangleBudget:remaining});
      const gltf=await parser.parse(bytes);
      assetScene=gltf.scene;
      if(signal.aborted){disposeNode(assetScene);return;}
      const {binding,anchor}=inspected.contract;
      // glTF uses metres. A rigid piece is authored around the named bone.
      assetScene.scale.setScalar(100);
      if(binding==='anchor')rig.bones.get(anchor).bone.add(assetScene);
      else{
        root.add(assetScene);
        assetScene.traverse(node=>{
          const descriptor=rig.bones.get(node.name)?.descriptor;
          if(node.isBone&&descriptor)node.quaternion.premultiply(new T.Quaternion().setFromEuler(new T.Euler(descriptor.rx,0,descriptor.rz,'ZYX')));
        });
      }
      root.updateMatrixWorld(true);
      let tested=0,inside=0;
      const point=new T.Vector3();
      assetScene.traverse(mesh=>{
        if(!mesh.isMesh)return;
        if(mesh.isSkinnedMesh)mesh.skeleton.update();
        mesh.castShadow=mesh.receiveShadow=true;
        for(const material of [mesh.material].flat()){
          if(material?.name!=='main'||!material.color)continue;
          if(hasColor(item.color))material.color.set(item.color);
          // Keep baked detail when an authored albedo or normal map is present.
        }
        const positions=mesh.geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
          if(bodyRayExits(point.toArray(),model.colliders).length)inside++;
          tested++;
        }
      });
      if(!tested||inside/tested>BODY_CLIP_LIMIT)throw new Error('GLB xuy�n th�n qu� 1% s? d?nh ? tu th? hi?n t?i.');
      const candidateSurfaces=collectImportedSurfaces(T,assetScene);
      const conflictingItem=findFirstSurfaceConflict(candidateSurfaces,layerSurfaces.filter(layer=>layer.item.id!==item.id));
      if(conflictingItem)throw new Error('GLB giao c?t v?i l?p trang ph?c: '+conflictingItem.name+'.');
      remaining-=inspected.triangles;
      for(const mesh of meshes)mesh.visible=false;
      addCleanup(()=>{assetScene.removeFromParent();disposeNode(assetScene);});
      const layerIndex=layerSurfaces.findIndex(layer=>layer.item.id===item.id);
      if(layerIndex>=0)layerSurfaces[layerIndex]={item,surfaces:candidateSurfaces};
      loaded++;loadedBytes+=bytes.byteLength;
    }catch(error){
      assetScene?.removeFromParent();
      if(assetScene)disposeNode(assetScene);
      failures.push(item.name+': '+(error?.message||'Kh�ng t?i du?c GLB.'));
    }finally{
      elapsedMs+=performance.now()-loadStarted;
      onAssetLoad(`${loaded}/${count} m�n � ${elapsedMs.toFixed(0)} ms � ${(loadedBytes/1048576).toFixed(1)} MB`);
    }
  }
  if(!signal.aborted){
    if(failures.length)onMessage(failures.join(' ')+' Studio hi?n th? m?u h�nh h?c thay th?.');
    invalidate();
  }
}

function startCloth({model,meshes,windKmh,signal,invalidate,lowPower}){
  if(lowPower||typeof Worker==='undefined'||!meshes.length)return ()=>{};
  const worker=new Worker(new URL('../workers/wardrobe-cloth.worker.js',import.meta.url),{type:'module'});
  let lastFrames=null,frameHandle=0;
  const stop=()=>{worker.terminate();cancelAnimationFrame(frameHandle);};
  signal.addEventListener('abort',stop,{once:true});
  worker.onerror=()=>stop();
  function applyFrames(){
    frameHandle=0;
    if(signal.aborted||document.hidden)return;
    let changed=false;
    for(const {key,positions,revision} of lastFrames){
      const layer=meshes[key],{mesh}=layer;
      if(!mesh.visible||revision===(layer.revision??0))continue;
      layer.revision=revision;
      const attribute=mesh.geometry.getAttribute('position');
      attribute.array.set(positions);
      attribute.needsUpdate=true;
      mesh.geometry.computeVertexNormals();
      changed=true;
    }
    if(changed)invalidate();
  }
  worker.onmessage=({data})=>{
    lastFrames=data;
    if(!frameHandle)frameHandle=requestAnimationFrame(applyFrames);
  };
  const posed=part=>({
    indices:part.indices,
    points:part.points.map((_,index)=>poseSurfacePoint(part,index,model.transforms))
  });
  const moving=new Set(meshes.map(({part})=>part));
  const owners=new Map();
  const garments=model.garments.flatMap(({parts},garment)=>parts.flatMap(part=>{
    if(!moving.has(part))return [{...posed(part),garment}];
    owners.set(part,garment);
    return [];
  }));
  worker.postMessage({
    type:'start',windKmh,body:model.body.map(posed),garments,
    meshes:meshes.map(({part},key)=>{
      const {toWorld,axes}=model.transforms.get(part.bone);
      return {key,garment:owners.get(part),positions:part.points.flat(),indices:part.indices,
        rows:part.rows,stride:part.stride,transform:{origin:toWorld([0,0,0]),axes}};
    })
  });
  return stop;
}

export async function mountWardrobe3D(host,{
  items=[],mannequin={},flatLay=false,pose='standing',mannequinTone='#9ba5a2',distanceCm=450,cameraHeightCm=135,
  focalLengthMm=50,sceneLight='overcast',background='#edf3f0',turntable=false,cloth=true,windKmh=null,source=null,
  onMessage=()=>{},onFallback=()=>{},externalSignal=null
}={}){
  if(!host||!supportsWebGL())throw new Error('WebGL2 kh�ng kh? d?ng.');
  const mountedAt=performance.now();
  const T=await import('three');
  if(externalSignal?.aborted||!host.isConnected)return ()=>{};
  const controller=new AbortController(),{signal}=controller, cleanups=[];
  const dispose=()=>{
    if(signal.aborted)return;
    controller.abort();
    for(const clean of cleanups.reverse())clean();
  };
  externalSignal?.addEventListener('abort',dispose,{once:true,signal});
  try{
    const lowPower=deviceIsLimited(), geometryOptions={pose:flatLay?'standing':pose,flatLay};
    let model=buildStudioGeometry(mannequin,items,{...geometryOptions,radial:lowPower?12:20});
    if(model.triangles+2>MAX_SCENE_TRIANGLES)
      model=buildStudioGeometry(mannequin,items,{...geometryOptions,radial:12});
    if(items.length>MAX_PROCEDURAL_ITEMS)onMessage('Studio 3D dang d�ng '+MAX_PROCEDURAL_ITEMS+' m�n d?u c?a b? ph?i.');
    const scene=new T.Scene();scene.background=new T.Color(hasColor(background)?background:'#edf3f0');
    const camera=new T.PerspectiveCamera(35,1,.5,3000);
    const renderer=new T.WebGLRenderer({antialias:!lowPower,powerPreference:lowPower?'low-power':'default',alpha:false});
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,lowPower?1:1.5));
    renderer.shadowMap.enabled=!lowPower;
    renderer.toneMapping=T.ACESFilmicToneMapping;
    const canvas=renderer.domElement;
    canvas.tabIndex=0;canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Ma-no-canh 3D. Ph�m mui t�n xoay, d?u c?ng v� d?u tr? ch?nh zoom.');
    const diagnostics=createPerformancePanel(host);
    if(flatLay)diagnostics.setAssetLoad('Kh�ng �p d?ng trong flat-lay');
    host.replaceChildren(canvas,diagnostics.element);
    cleanups.push(()=>{renderer.dispose();renderer.forceContextLoss();canvas.remove();});
    cleanups.push(()=>{diagnostics.dispose();diagnostics.element.remove();});
    const materials=createMaterialFactory(T);
    cleanups.push(()=>{disposeNode(scene,true);materials.dispose();});

    const lighting=WARDROBE_LIGHTING[sceneLight]||WARDROBE_LIGHTING.overcast;
    scene.add(new T.HemisphereLight(lighting.sky,lighting.fill,lighting.ambient));
    const keyLight=new T.DirectionalLight(lighting.key,lighting.power);
    keyLight.position.set(...lighting.position);keyLight.castShadow=!lowPower;
    keyLight.shadow.mapSize.set(1024,1024);
    keyLight.shadow.camera.left=-170;keyLight.shadow.camera.right=170;
    keyLight.shadow.camera.top=185;keyLight.shadow.camera.bottom=-155;
    keyLight.shadow.camera.far=1300;keyLight.shadow.normalBias=.36;
    if(!flatLay){keyLight.target.position.y=55;scene.add(keyLight.target);}
    scene.add(keyLight);
    const floor=new T.Mesh(new T.PlaneGeometry(700,700),materials.material({color:'#dce7e2'},false));
    floor.rotation.x=-Math.PI/2;floor.position.y=-2;floor.receiveShadow=true;scene.add(floor);

    const root=new T.Group();scene.add(root);
    const clothMeshes=[];
    let rig=null;
    if(flatLay)arrangeFlatLay(T,root,model.garments,materials);
    else{
      rig=buildRig(T,root,model.layout);
      const morphs=buildBodyMorphs(mannequin,model.radial),bodyMaterial=materials.material({color:mannequinTone},false);
      morphs.base.forEach((part,index)=>skinnedPart(T,root,rig,part,bodyMaterial,morphs.targets.map(target=>({name:target.name,points:target.parts[index]}))));
      for(const garment of model.garments){
        const material=materials.material(garment.item);
        garment.meshes=garment.parts.map(part=>{
          const mesh=skinnedPart(T,root,rig,part,material);
          if(part.cloth)clothMeshes.push({part,mesh});
          return mesh;
        });
      }
      rig.pose();
    }

    let yaw=0,pitch=0,distance=clamp(Number(distanceCm)||450,140,1200), frame=0, previousTime=0, pinch=0,autoFrame=true;
    const renderSampler=createRenderSampler({startedAt:mountedAt});
    const diagnosticsTimer=setInterval(()=>{
      if(signal.aborted||document.hidden)return;
      const activity=renderSampler.snapshot(performance.now());
      diagnostics.update({
        activity,
        calls:renderer.info.render.calls,
        triangles:renderer.info.render.triangles,
        geometries:renderer.info.memory.geometries,
        textures:renderer.info.memory.textures,
        heapBytes:performance.memory?.usedJSHeapSize??null
      });
    },1000);
    cleanups.push(()=>clearInterval(diagnosticsTimer));
    const reduceMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const pointers=new Map();
    const aim=flatLay?Math.max(35,154-(Math.ceil(model.garments.length/4)-1)*24):mannequinAimHeight(model);
    const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3());
    const fit=()=>framedCameraDistance({
      heightCm:Math.max(flatLay?120:model.layout.m.heightCm,size.y),
      widthCm:Math.max(flatLay?120:100,size.x),
      focalLengthMm,aspect:camera.aspect,cameraHeightCm,aimCm:aim
    });
    const frameSubject=()=>{autoFrame=true;yaw=0;pitch=0;distance=Math.max(clamp(Number(distanceCm)||450,140,1200),fit());invalidate();};
    function draw(time){
      frame=0;
      if(signal.aborted||document.hidden)return;
      if(turntable&&!reduceMotion&&!pointers.size&&previousTime)yaw+=Math.min(.032,(time-previousTime)*.00048);
      previousTime=time;
      const baseHeight=Number(cameraHeightCm)||135;
      camera.position.set(Math.sin(yaw)*distance,baseHeight+pitch,Math.cos(yaw)*distance);
      camera.lookAt(0,aim,0);
      renderer.render(scene,camera);
      renderSampler.recordFrame(time);
      if(turntable&&!reduceMotion)invalidate();
    }
    function invalidate(){if(!frame&&!signal.aborted)frame=requestAnimationFrame(draw);}
    function resize(){
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.fov=lensVerticalFov(focalLengthMm,camera.aspect);camera.updateProjectionMatrix();
      if(autoFrame)distance=Math.max(clamp(Number(distanceCm)||450,140,1200),fit());
      invalidate();
    }
    const observer=new ResizeObserver(resize);observer.observe(host);
    cleanups.push(()=>{cancelAnimationFrame(frame);observer.disconnect();});
    const listen=(event,fn,opts)=>canvas.addEventListener(event,fn,{...opts,signal});
    listen('pointerdown',event=>{
      canvas.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId,[event.clientX,event.clientY]);pinch=0;
    });
    listen('pointermove',event=>{
      const point=pointers.get(event.pointerId);
      if(!point)return;
      pointers.set(event.pointerId,[event.clientX,event.clientY]);
      if(pointers.size===1){yaw+=(event.clientX-point[0])*.009;pitch=clamp(pitch-(event.clientY-point[1])*.65,-110,95);}
      else if(pointers.size===2){
        const [a,b]=pointers.values(),gap=Math.hypot(a[0]-b[0],a[1]-b[1]);
        if(pinch){autoFrame=false;distance=clamp(distance-(gap-pinch)*1.35,140,1200);}
        pinch=gap;
      }
      invalidate();
    });
    for(const kind of ['pointerup','pointercancel','lostpointercapture'])listen(kind,event=>{pointers.delete(event.pointerId);pinch=0;});
    listen('wheel',event=>{event.preventDefault();autoFrame=false;distance=clamp(distance+event.deltaY*.35,140,1200);invalidate();},{passive:false});
    host.addEventListener('wardrobe:frame',frameSubject,{signal});
    listen('keydown',event=>{
      if(event.key==='ArrowLeft')yaw-=.14;
      else if(event.key==='ArrowRight')yaw+=.14;
      else if(event.key==='ArrowUp')pitch=clamp(pitch+12,-110,95);
      else if(event.key==='ArrowDown')pitch=clamp(pitch-12,-110,95);
      else if(['+','='].includes(event.key)){autoFrame=false;distance=clamp(distance-20,140,1200);}
      else if(event.key==='-'){autoFrame=false;distance=clamp(distance+20,140,1200);}
      else if(event.key==='0'){frameSubject();}
      else return;
      event.preventDefault();invalidate();
    });
    listen('webglcontextlost',event=>{event.preventDefault();dispose();onFallback('M?t k?t n?i WebGL2. Da chuy?n sang Studio 2D.');});
    document.addEventListener('visibilitychange',()=>{previousTime=0;invalidate();},{signal});
    resize();
    if(cloth&&rig&&clothMeshes.length){
      if(lowPower||reduceMotion)onMessage('M� ph?ng v?i dang t?t theo c?u h�nh thi?t b? ho?c gi?m chuy?n d?ng.');
      else startCloth({model,meshes:clothMeshes,windKmh,signal,invalidate,lowPower});
    }
    if(rig){
      const pairs=findLayerCrossings(model.garments,model.transforms);
      if(pairs.length){
        const details=pairs.slice(0,3).map(({inner,outer})=>inner.name+' / '+outer.name).join(', ');
        onMessage('M?t s? l?p giao nhau ? tu th? n�y. '+details+(pairs.length>3?' v� '+(pairs.length-3)+' c?p kh�c.':'.'));
      }
    }
    if(rig)void mountImportedLayers({T,renderer,rig,root,model,source,signal,onMessage,onAssetLoad:diagnostics.setAssetLoad,invalidate,addCleanup:fn=>cleanups.push(fn)})
      .catch(()=>{if(!signal.aborted)onMessage('Kh�ng t?i du?c b? d?c GLB. Studio hi?n th? m?u h�nh h?c thay th?.');});
    return dispose;
  }catch(error){
    dispose();
    throw error;
  }
}

function createPerformancePanel(host){
  const details=document.createElement('details');
  details.className='ws-three-diagnostics';
  details.setAttribute('aria-label','S? li?u hi?u nang Studio 3D tr�n thi?t b? n�y');
  const summary=document.createElement('summary');summary.textContent='Hi?u nang tr�n thi?t b? n�y';details.append(summary);
  const status=document.createElement('p');status.className='ws-three-diagnostics-status';status.setAttribute('role','status');
  const list=document.createElement('dl');
  const values={};
  const rows=[['fps','FPS'],['calls','L?nh v?'],['triangles','Tam gi�c khung h�nh'],['geometries','H�nh h?c dang d�ng'],['textures','Texture dang d�ng'],['firstFrame','T?i khung h�nh d?u'],['assetLoad','GLB n?p & ki?m tra'],['heap','Heap JS c?a trang']];
  for(const [key,label] of rows){
    const term=document.createElement('dt');term.textContent=label;
    const value=document.createElement('dd');value.textContent='Dang do';values[key]=value;
    list.append(term,value);
  }
  const note=document.createElement('p');note.className='ws-three-diagnostics-note';
  note.textContent='B? nh? GPU kh�ng du?c tr�nh duy?t cung c?p; heap JS l� s? li?u to�n trang. D? li?u ch? d?c t?i ch?, kh�ng g?i di.';
  details.append(status,list,note);
  const format=value=>Number.isFinite(value)?Math.round(value).toLocaleString('vi-VN'):'Chua c� d? li?u';
  return {
    element:details,
    update({activity,calls,triangles,geometries,textures,heapBytes}){
      status.textContent=activity.active?'Dang k?t xu?t':'Dang ngh? (Studio ch? v? khi c� thay d?i)';
      values.fps.textContent=activity.active?(activity.fps===null?'Dang do':activity.fps.toFixed(1)):'-';
      values.calls.textContent=format(calls);
      values.triangles.textContent=format(triangles)+' / 150.000';
      values.geometries.textContent=format(geometries);
      values.textures.textContent=format(textures);
      values.firstFrame.textContent=activity.firstFrameMs===null?'Dang ch?':activity.firstFrameMs.toFixed(0)+' ms';
      values.heap.textContent=Number.isFinite(heapBytes)?(heapBytes/1048576).toFixed(1)+' MB':'Chua c� d? li?u';
    },
    setAssetLoad(value){values.assetLoad.textContent=value;},
    dispose(){details.remove();}
  };
}
