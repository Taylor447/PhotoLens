const THREE_URL='https://unpkg.com/three@0.187.0/build/three.module.js';
let threeModule;
export function supportsWebGL(){try{const c=document.createElement('canvas');return Boolean(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}catch{return false;}}
async function getThree(){return threeModule||(threeModule=import(/* @vite-ignore */ THREE_URL));}
const mat=(T,color,roughness=.9)=>new T.MeshStandardMaterial({color,roughness,metalness:0});
function ball(T,parent,m,pos,size){const x=new T.Mesh(new T.SphereGeometry(1,14,10),m);x.position.set(...pos);x.scale.set(...size);x.castShadow=true;x.receiveShadow=true;parent.add(x);return x;}
function clothes(T,group,items,scale){
 for(const x of [...items].sort((a,b)=>(a.layerOrder||0)-(b.layerOrder||0))){
  const m=mat(T,x.color||'#647d69'),w=x.parameters?.width==='wide'?1.14:x.parameters?.width==='slim'?.9:1,l=x.parameters?.length==='long'?1.1:x.parameters?.length==='short'?.9:1;
  if(['tops','outerwear','dresses'].includes(x.category)){ball(T,group,m,[0,148*scale,0],[x.category==='dresses'?33*scale:34*w*scale,41*l*scale,21*scale]);if(x.category!=='dresses'){ball(T,group,m,[-38*scale,148*scale,0],[11*scale,27*scale,12*scale]);ball(T,group,m,[38*scale,148*scale,0],[11*scale,27*scale,12*scale]);}}
  if(x.category==='bottoms'){ball(T,group,m,[0,102*scale,0],[33*w*scale,24*scale,20*scale]);for(const side of [-1,1]){const leg=new T.Mesh(new T.CylinderGeometry(11*scale,9*scale,68*l*scale,10),m);leg.position.set(side*16*scale,54*scale,0);group.add(leg);}}
  if(x.category==='skirts'||x.category==='dresses'){const skirt=new T.Mesh(new T.ConeGeometry(44*w*scale,76*l*scale,16),m);skirt.position.y=103*scale;skirt.scale.z=.56;group.add(skirt);}
  if(x.category==='shoes'){ball(T,group,m,[-15*scale,9*scale,5],[15*scale,8*scale,24*scale]);ball(T,group,m,[15*scale,9*scale,5],[15*scale,8*scale,24*scale]);}
  if(x.category==='hats'){const h=new T.Mesh(new T.ConeGeometry(28*scale,18*scale,16),m);h.position.y=208*scale;group.add(h);}
  if(['bags','accessories'].includes(x.category)){const b=new T.Mesh(new T.BoxGeometry(24*scale,30*scale,12*scale),m);b.position.set(48*scale,112*scale,4);group.add(b);}
  if(x.category==='scarves'){const b=new T.Mesh(new T.TorusGeometry(12*scale,3*scale,8,18),m);b.position.y=182*scale;b.rotation.x=Math.PI/2;group.add(b);}
  if(x.category==='eyewear'){const b=new T.Mesh(new T.TorusGeometry(9*scale,1.8*scale,6,16),m);b.position.set(0,188*scale,18*scale);group.add(b);}
  if(x.category==='jewelry'||x.category==='hair')ball(T,group,m,[0,x.category==='hair'?207*scale:172*scale,3],[10*scale,4*scale,8*scale]);
 }
}
export async function mountWardrobe3D(host,{items=[],measurements={},heightCm=170,flatLay=false,pose='standing',mannequinTone='#9ba5a2',distanceCm=450,cameraHeightCm=135}={}){
 if(!host||!supportsWebGL())throw new Error('WebGL unavailable');
 const T=await getThree();if(!supportsWebGL())throw new Error('WebGL unavailable');
 const width=Math.max(host.clientWidth||640,280),height=Math.max(host.clientHeight||480,340),scene=new T.Scene();scene.background=new T.Color('#edf3f0');
 const camera=new T.PerspectiveCamera(34,width/height,.1,10000);camera.position.set(0,135,450);
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(width,height);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.replaceChildren(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','application');renderer.domElement.setAttribute('aria-label','Mô phỏng 3D tham khảo. Dùng phím mũi tên để xoay mannequin.');
 scene.add(new T.HemisphereLight('#ffffff','#71867e',2));
 const light=new T.DirectionalLight('#ffffff',2.2);light.position.set(-300,600,500);light.castShadow=true;scene.add(light);
 const floor=new T.Mesh(new T.PlaneGeometry(800,800),mat(T,'#dce7e2',1));floor.rotation.x=-Math.PI/2;floor.position.y=-3;floor.receiveShadow=true;scene.add(floor);
 const grid=new T.GridHelper(800,16,'#afc2bb','#ccd9d4');grid.position.y=-1.5;scene.add(grid);
 const person=new T.Group();if(pose==='lean')person.rotation.z=-.08;scene.add(person);
 if(!flatLay){
  const grey=mat(T,mannequinTone,.95),scale=Math.max(.65,Math.min(1.4,(Number(heightCm)||170)/215));
  const chest=Number(measurements.chest)||92,waist=Number(measurements.waist)||76,hips=Number(measurements.hips)||98,shoulders=Number(measurements.shoulders)||40;
  ball(T,person,grey,[0,198*scale,0],[13*scale,17*scale,13*scale]);ball(T,person,grey,[0,148*scale,0],[Math.max(27,shoulders*.8)*scale,40*scale,19*scale]);ball(T,person,grey,[0,103*scale,0],[Math.max(25,waist*.52)*scale,25*scale,18*scale]);ball(T,person,grey,[0,90*scale,0],[Math.max(27,hips*.48)*scale,18*scale,18*scale]);
  for(const side of [-1,1]){ball(T,person,grey,[side*36*scale,150*scale,0],[9*scale,29*scale,10*scale]);ball(T,person,grey,[side*39*scale,118*scale,1],[7.5*scale,28*scale,8*scale]);const thigh=new T.Mesh(new T.CylinderGeometry(10.5*scale,9.5*scale,44*scale,10),grey);thigh.position.set(side*16*scale,(pose==='sitting'?80:61)*scale,0);thigh.rotation.z=pose==='sitting'?side*.8:pose==='step'?side*.15:0;person.add(thigh);const calf=new T.Mesh(new T.CylinderGeometry(9*scale,7*scale,42*scale,10),grey);calf.position.set(side*16*scale,22*scale,0);calf.rotation.z=pose==='step'?-side*.14:0;person.add(calf);}
  clothes(T,person,items,scale);
 }else items.slice(0,10).forEach((x,i)=>{const b=new T.Mesh(new T.BoxGeometry(44,62,4),mat(T,x.color||'#647d69'));b.position.set((i%5-2)*72,Math.floor(i/5)*82,0);person.add(b);});
 let yaw=0,pitch=10,radius=Math.max(280,Math.min(700,Number(distanceCm)||450)),drag=null,pointers=new Map(),pinch=0,raf=0;
 const update=()=>{camera.position.set(Math.sin(yaw)*radius,(Number(cameraHeightCm)||135)+pitch,radius*Math.cos(yaw));camera.lookAt(0,105,0);};update();
 const resize=()=>{const w=Math.max(host.clientWidth||width,280),h=Math.max(host.clientHeight||height,340);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);
 const down=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)drag={x:e.clientX,y:e.clientY,yaw,pitch};else if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}renderer.domElement.setPointerCapture?.(e.pointerId);};
 const move=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1&&drag){yaw=drag.yaw+(e.clientX-drag.x)*.008;pitch=Math.max(-65,Math.min(60,drag.pitch-(e.clientY-drag.y)*.6));}else if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);radius=Math.max(280,Math.min(700,radius+(pinch-d)*.3));pinch=d;}update();};
 const up=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=0;drag=null;};
 const key=e=>{if(e.key==='ArrowLeft')yaw-=.12;else if(e.key==='ArrowRight')yaw+=.12;else if(e.key==='ArrowUp')pitch=Math.min(60,pitch+12);else if(e.key==='ArrowDown')pitch=Math.max(-65,pitch-12);else return;e.preventDefault();update();};
 const wheel=e=>{e.preventDefault();radius=Math.max(280,Math.min(700,radius+e.deltaY*.3));update();};
 for(const [n,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['keydown',key]])renderer.domElement.addEventListener(n,fn);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
 const draw=()=>{raf=requestAnimationFrame(draw);renderer.render(scene,camera);};draw();
 return()=>{cancelAnimationFrame(raf);observer.disconnect();for(const [n,fn] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['keydown',key]])renderer.domElement.removeEventListener(n,fn);renderer.domElement.removeEventListener('wheel',wheel);scene.traverse(x=>{x.geometry?.dispose?.();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose?.());else x.material?.dispose?.();});renderer.dispose();renderer.domElement.remove();};
}
