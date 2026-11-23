const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const PI=Math.PI;
const V3={
 add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
 sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 length:a=>Math.hypot(a[0],a[1],a[2]),
 norm(a){const l=this.length(a)||1;return this.scale(a,1/l);}
};

export const SENSOR_PRESETS={
 fullFrame:{label:'Full-frame tham chiếu · 36 × 24 mm',width:36,height:24},
 apsc:{label:'APS-C tham chiếu · 23,5 × 15,6 mm',width:23.5,height:15.6},
 mft:{label:'Micro Four Thirds · 17,3 × 13 mm',width:17.3,height:13},
 custom:{label:'Tự nhập kích thước',width:36,height:24}
};

export function calculateCameraFov(focalLength=50,sensorWidth=36,sensorHeight=24,orientation='portrait'){
 const f=Math.max(.1,Number(focalLength)||50);
 const sw=Math.max(.1,Number(sensorWidth)||36),sh=Math.max(.1,Number(sensorHeight)||24);
 const width=orientation==='portrait'?sh:sw,height=orientation==='portrait'?sw:sh;
 const horizontalRadians=2*Math.atan(width/(2*f)),verticalRadians=2*Math.atan(height/(2*f));
 return {horizontal:horizontalRadians*180/PI,vertical:verticalRadians*180/PI,horizontalRadians,verticalRadians,width,height};
}

function personLayout(config){
 if(config.pose==='couple')return [{x:-.34,z:0},{x:.34,z:0}];
 if(config.pose==='group')return [{x:-.66,z:0},{x:-.33,z:-.12},{x:.33,z:-.12},{x:.66,z:0},{x:0,z:-.42}];
 return [{x:0,z:0}];
}
function physicalCamera(config){
 const h=clamp((Number(config.cameraHeight)||160)/100,.6,2.2);
 const d=clamp(Number(config.distance)||4,2,10);
 const subjectH=clamp((Number(config.subjectHeight)||170)/100,1.4,2.0);
 const fov=calculateCameraFov(config.focalLength,config.sensorWidth,config.sensorHeight,config.orientation);
 const desired=[.36,.5,.64][clamp(Number(config.angleIndex)||0,0,2)];
 const aimX=-(desired-.5)*2*d*Math.tan(fov.horizontalRadians/2);
 const eye=[0,h,d],target=[aimX,subjectH*.9,0];
 const forward=V3.norm(V3.sub(target,eye));
 let right=V3.norm(V3.cross(forward,[0,1,0]));
 if(V3.length(right)<.01)right=[1,0,0];
 const up=V3.norm(V3.cross(right,forward));
 return {eye,target,forward,right,up,subjectH,d,fov};
}

export function projectWorldPoint(point,config){
 const c=physicalCamera(config),delta=V3.sub(point,c.eye),depth=V3.dot(delta,c.forward);
 const x=V3.dot(delta,c.right),y=V3.dot(delta,c.up);
 const tanX=Math.tan(c.fov.horizontalRadians/2),tanY=Math.tan(c.fov.verticalRadians/2);
 return {x:.5+x/(2*depth*tanX),y:.5-y/(2*depth*tanY),depth,visible:depth>0};
}

const n=(v)=>Number.isFinite(v)?Number(v.toFixed(2)):0;
function screenPoint(world,config,w,h,box){
 const p=projectWorldPoint(world,config);
 return {x:box.x+p.x*box.w,y:box.y+p.y*box.h,depth:p.depth,visible:p.visible};
}
function framePersonSvg(position,index,config,box){
 const height=(Number(config.subjectHeight)||170)/100;
 const x=position.x,z=position.z;
 const pts={
  head:screenPoint([x,height*.93,z],config,0,0,box),
  neck:screenPoint([x,height*.83,z],config,0,0,box),
  shoulderL:screenPoint([x-.14*height,height*.77,z],config,0,0,box),
  shoulderR:screenPoint([x+.14*height,height*.77,z],config,0,0,box),
  elbowL:screenPoint([x-.21*height,height*.62,z],config,0,0,box),
  elbowR:screenPoint([x+.21*height,height*.62,z],config,0,0,box),
  handL:screenPoint([x-.24*height,height*.48,z],config,0,0,box),
  handR:screenPoint([x+.24*height,height*.48,z],config,0,0,box),
  hipL:screenPoint([x-.1*height,height*.49,z],config,0,0,box),
  hipR:screenPoint([x+.1*height,height*.49,z],config,0,0,box),
  kneeL:screenPoint([x-.13*height,height*.27,z],config,0,0,box),
  kneeR:screenPoint([x+.13*height,height*.27,z],config,0,0,box),
  footL:screenPoint([x-.17*height,height*.03,z],config,0,0,box),
  footR:screenPoint([x+.17*height,height*.03,z],config,0,0,box)
 };
 const c=index%2?'#476e83':'#0b7a5a';
 const depth=Math.max(1,pts.head.depth);
 const camera=physicalCamera(config);
 const radius=clamp(box.w*.105/(2*depth*Math.tan(camera.fov.horizontalRadians/2)),2.5,15);
 const path=(a,b)=>'M'+n(pts[a].x)+' '+n(pts[a].y)+'L'+n(pts[b].x)+' '+n(pts[b].y);
 const all=[pts.head,pts.neck,pts.shoulderL,pts.shoulderR,pts.elbowL,pts.elbowR,pts.handL,pts.handR,pts.hipL,pts.hipR,pts.kneeL,pts.kneeR,pts.footL,pts.footR];
 if(all.some(p=>!p.visible))return '';
 return '<g stroke="'+c+'" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="'+path('neck','head')+path('shoulderL','shoulderR')+path('neck','hipL')+path('neck','hipR')+path('shoulderL','elbowL')+path('elbowL','handL')+path('shoulderR','elbowR')+path('elbowR','handR')+path('hipL','kneeL')+path('kneeL','footL')+path('hipR','kneeR')+path('kneeR','footR')+'"/><circle cx="'+n(pts.head.x)+'" cy="'+n(pts.head.y)+'" r="'+n(radius)+'" fill="'+c+'" stroke="none"/></g>';
}

export function analyzeSubjectFraming(config){
 const height=(Number(config.subjectHeight)||170)/100;
 const points=personLayout(config).flatMap(person=>[
  [person.x,height*1.07,person.z],[person.x-.24*height,height*.48,person.z],[person.x+.24*height,height*.48,person.z],
  [person.x-.17*height,0,person.z],[person.x+.17*height,0,person.z]
 ]).map(point=>projectWorldPoint(point,config));
 const cropped=points.some(p=>!p.visible||p.x<0||p.x>1||p.y<0||p.y>1);
 return {cropped,visible:points.every(p=>p.visible)};
}

export function renderPhotoFrameSvg(config){
 const landscape=config.orientation==='landscape',width=landscape?272:190,height=landscape?190:272,box=landscape?{x:14,y:13,w:244,h:164}:{x:13,y:14,w:164,h:244};
 const grid='<path d="M'+n(box.x+box.w/3)+' '+box.y+'v'+box.h+'M'+n(box.x+2*box.w/3)+' '+box.y+'v'+box.h+'M'+box.x+' '+n(box.y+box.h/3)+'h'+box.w+'M'+box.x+' '+n(box.y+2*box.h/3)+'h'+box.w+'" stroke="#77938d" stroke-width="1.2" stroke-dasharray="4 4"/>';
 const people=personLayout(config).map((person,i)=>framePersonSvg(person,i,config,box)).join('');
 const fov=calculateCameraFov(config.focalLength,config.sensorWidth,config.sensorHeight,config.orientation);
 return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Khung ảnh dự kiến với lưới 1/3, tiêu cự '+config.focalLength+' mm, trường nhìn dọc '+n(fov.vertical)+' độ"><title>Khung ảnh tính theo tiêu cự, cảm biến, khoảng cách và chiều cao chủ thể</title><defs><clipPath id="angle-frame-clip"><rect x="'+box.x+'" y="'+box.y+'" width="'+box.w+'" height="'+box.h+'" rx="10"/></clipPath></defs><rect x="'+box.x+'" y="'+box.y+'" width="'+box.w+'" height="'+box.h+'" rx="10" fill="#f7fbf9" stroke="#76928d" stroke-width="2.3"/><g clip-path="url(#angle-frame-clip)">'+grid+people+'</g></svg>';
}

function color(hex,alpha=1){
 const h=hex.replace('#','');
 return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255,alpha];
}
class MeshBuilder{
 constructor(){this.p=[];this.n=[];this.c=[];}
 push(v,norm,col){this.p.push(v[0],v[1],v[2]);this.n.push(norm[0],norm[1],norm[2]);this.c.push(col[0],col[1],col[2],col[3]);}
 face(a,b,c,col){const normal=V3.norm(V3.cross(V3.sub(b,a),V3.sub(c,a)));this.push(a,normal,col);this.push(b,normal,col);this.push(c,normal,col);}
 tri(a,na,b,nb,c,nc,col){this.push(a,na,col);this.push(b,nb,col);this.push(c,nc,col);}
 quad(a,b,c,d,col){this.face(a,b,c,col);this.face(a,c,d,col);}
 sphere(center,radii,col,lat=16,lon=24){
  for(let j=0;j<lat;j++){const t0=-PI/2+PI*j/lat,t1=-PI/2+PI*(j+1)/lat;
   for(let i=0;i<lon;i++){const p0=2*PI*i/lon,p1=2*PI*(i+1)/lon;
    const point=(t,p)=>[center[0]+radii[0]*Math.cos(t)*Math.cos(p),center[1]+radii[1]*Math.sin(t),center[2]+radii[2]*Math.cos(t)*Math.sin(p)];
    const normal=(v)=>V3.norm([(v[0]-center[0])/(radii[0]**2),(v[1]-center[1])/(radii[1]**2),(v[2]-center[2])/(radii[2]**2)]);
    const a=point(t0,p0),b=point(t1,p0),c=point(t1,p1),d=point(t0,p1);
    this.tri(a,normal(a),b,normal(b),c,normal(c),col);this.tri(a,normal(a),c,normal(c),d,normal(d),col);
   }
  }
 }
 cylinder(a,b,ra,rb,col,segments=14){
  const axis=V3.norm(V3.sub(b,a));let ref=Math.abs(axis[1])>.92?[1,0,0]:[0,1,0];
  const u=V3.norm(V3.cross(axis,ref)),v=V3.norm(V3.cross(axis,u));
  for(let i=0;i<segments;i++){const a0=2*PI*i/segments,a1=2*PI*(i+1)/segments;
   const radial=t=>V3.norm(V3.add(V3.scale(u,Math.cos(t)),V3.scale(v,Math.sin(t))));
   const r0=radial(a0),r1=radial(a1),p0=V3.add(a,V3.scale(r0,ra)),p1=V3.add(a,V3.scale(r1,ra)),p2=V3.add(b,V3.scale(r1,rb)),p3=V3.add(b,V3.scale(r0,rb));
   this.tri(p0,r0,p1,r1,p2,r1,col);this.tri(p0,r0,p2,r1,p3,r0,col);
  }
 }
 disk(cx,cz,rx,rz,y,col,segments=28){
  const center=[cx,y,cz];
  for(let i=0;i<segments;i++){const a0=2*PI*i/segments,a1=2*PI*(i+1)/segments;this.face(center,[cx+rx*Math.cos(a1),y,cz+rz*Math.sin(a1)],[cx+rx*Math.cos(a0),y,cz+rz*Math.sin(a0)],col);}
 }
 box(center,axes,size,col){
  const [right,up,back]=axes,[sx,sy,sz]=size;
  const point=(x,y,z)=>V3.add(center,V3.add(V3.scale(right,x*sx/2),V3.add(V3.scale(up,y*sy/2),V3.scale(back,z*sz/2))));
  const v=[point(-1,-1,-1),point(1,-1,-1),point(1,1,-1),point(-1,1,-1),point(-1,-1,1),point(1,-1,1),point(1,1,1),point(-1,1,1)];
  const faces=[[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
  for(const f of faces)this.quad(v[f[0]],v[f[1]],v[f[2]],v[f[3]],col);
 }
}
class LineBuilder{
 constructor(){this.p=[];this.c=[];}
 line(a,b,col){this.p.push(...a,...b);this.c.push(...col,...col);}
}
function addMannequin(mesh,x,z,height,shirt,skin='#c6b7a2',pants='#53616b'){
 const h=height,torso=color(shirt),skinC=color(skin),pantsC=color(pants),shoe=color('#26343a');
 const point=(dx,y,dz=0)=>[x+dx,y*h,z+dz];
 mesh.sphere(point(0,.93),[.105*h,.135*h,.095*h],skinC,20,24);
 mesh.cylinder(point(0,.82),point(0,.77),.052*h,.052*h,skinC);
 mesh.cylinder(point(0,.75),point(0,.51),.13*h,.09*h,torso);
 mesh.sphere(point(0,.76),[.16*h,.075*h,.105*h],torso,12,20);
 mesh.cylinder(point(0,.52),point(0,.47),.09*h,.10*h,pantsC);
 for(const side of [-1,1]){
  const shoulder=point(side*.14,.75),elbow=point(side*.205,.60,side*.015),wrist=point(side*.23,.49,side*.025);
  mesh.sphere(shoulder,[.055*h,.058*h,.055*h],torso,10,14);
  mesh.cylinder(shoulder,elbow,.047*h,.037*h,torso);
  mesh.sphere(elbow,[.041*h,.041*h,.041*h],skinC,10,14);
  mesh.cylinder(elbow,wrist,.035*h,.03*h,skinC);
  mesh.sphere(wrist,[.035*h,.04*h,.035*h],skinC,10,14);
  const hip=point(side*.055,.48),knee=point(side*.07,.27),ankle=point(side*.075,.07);
  mesh.cylinder(hip,knee,.071*h,.052*h,pantsC);
  mesh.sphere(knee,[.055*h,.058*h,.055*h],pantsC,10,14);
  mesh.cylinder(knee,ankle,.05*h,.035*h,pantsC);
  mesh.sphere(point(side*.09,.035,.025),[.09*h,.035*h,.13*h],shoe,10,16);
 }
}
function makeScene(config){
 const solid=new MeshBuilder(),translucent=new MeshBuilder(),lines=new LineBuilder(),camera=physicalCamera(config);
 const pale=color('#dce8e2'),grid=color('#b8c9c1'),green=color('#087b5a');
 const groundSize=Math.max(10,camera.d+5);
 solid.quad([-groundSize,0,-groundSize],[-groundSize,0,groundSize],[groundSize,0,groundSize],[groundSize,0,-groundSize],pale);
 for(let i=-10;i<=10;i++){
  const t=i*.5;
  lines.line([-5,.006,t],[5,.006,t],color(i===0?'#91aaa0':'#bdcdc6'));
  lines.line([t,.006,-5],[t,.006,Math.max(5,camera.d+2)],color(i===0?'#91aaa0':'#bdcdc6'));
 }
 const models=personLayout(config);
 for(let i=0;i<models.length;i++){
  const p=models[i],x=p.x;
  translucent.disk(x,p.z,.34,.2,.008,color('#536c62',.13));
  addMannequin(solid,x,p.z,camera.subjectH,['#0b7a5a','#496f86','#9c7754','#687f75','#7b6488'][i%5]);
 }
 const eye=camera.eye,forward=camera.forward,right=camera.right,up=camera.up,back=V3.scale(forward,-1);
 const bodyCenter=V3.sub(eye,V3.scale(forward,.27));
 solid.box(bodyCenter,[right,up,back],[.38,.25,.27],color('#263b3d'));
 solid.cylinder(V3.add(bodyCenter,V3.scale(forward,.12)),V3.add(eye,V3.scale(forward,.06)),.115,.10,color('#70817d'),24);
 solid.cylinder(V3.sub(eye,V3.scale(forward,.02)),V3.add(eye,V3.scale(forward,.10)),.075,.07,color('#112527'),24);
 solid.sphere(V3.add(eye,V3.scale(forward,.105)),[.065,.065,.025],color('#4e9a89'),12,20);
 const tripodTop=V3.sub(eye,V3.scale(up,.14));
 for(const foot of [[-.34,0,.22],[.34,0,.22],[0,0,-.34]]){
  const end=[eye[0]+foot[0],.025,eye[2]+foot[2]];
  solid.cylinder(tripodTop,end,.025,.012,color('#445654'),10);
 }
 const depth=V3.length(V3.sub(camera.target,eye)),halfW=depth*Math.tan(camera.fov.horizontalRadians/2),halfH=depth*Math.tan(camera.fov.verticalRadians/2);
 const center=camera.target;
 const corners=[
  V3.add(center,V3.add(V3.scale(right,-halfW),V3.scale(up,halfH))),
  V3.add(center,V3.add(V3.scale(right,halfW),V3.scale(up,halfH))),
  V3.add(center,V3.add(V3.scale(right,halfW),V3.scale(up,-halfH))),
  V3.add(center,V3.add(V3.scale(right,-halfW),V3.scale(up,-halfH)))
 ];
 const rayColor=color('#0b7a5a',.095);
 for(let i=0;i<4;i++){translucent.face(eye,corners[i],corners[(i+1)%4],rayColor);lines.line(eye,corners[i],green);lines.line(corners[i],corners[(i+1)%4],green);}
 lines.line([0,.01,camera.d],[0,.01,0],color('#557169'));
 lines.line([0,0,camera.d],[0,camera.eye[1],camera.d],color('#526c66'));
 return {solid,translucent,lines};
}

function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2),out=new Float32Array(16);
 out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=(2*far*near)/(near-far);
 return out;
}
function lookAt(eye,target){
 const z=V3.norm(V3.sub(eye,target)),x=V3.norm(V3.cross([0,1,0],z)),y=V3.cross(z,x);
 const out=new Float32Array(16);
 out[0]=x[0];out[1]=y[0];out[2]=z[0];out[3]=0;
 out[4]=x[1];out[5]=y[1];out[6]=z[1];out[7]=0;
 out[8]=x[2];out[9]=y[2];out[10]=z[2];out[11]=0;
 out[12]=-V3.dot(x,eye);out[13]=-V3.dot(y,eye);out[14]=-V3.dot(z,eye);out[15]=1;
 return out;
}
function multiply(a,b){
 const out=new Float32Array(16);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
 return out;
}
function shader(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s)||'Lỗi biên dịch shader';gl.deleteShader(s);throw new Error(message);}
 return s;
}
function program(gl,vertex,fragment){
 const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'Không tạo được chương trình WebGL');
 return p;
}
const meshVS='attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;uniform mat4 uMvp;uniform mat4 uView;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;void main(){vNormal=mat3(uView)*aNormal;vWorld=(uView*vec4(aPosition,1.0)).xyz;vColor=aColor;gl_Position=uMvp*vec4(aPosition,1.0);}';
const meshFS='precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec4 vColor;void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-0.38,0.86,0.42));float diffuse=max(dot(n,light),0.0);vec3 viewDir=normalize(-vWorld);vec3 halfDir=normalize(light+viewDir);float spec=pow(max(dot(n,halfDir),0.0),28.0)*0.14;float ambient=0.42;gl_FragColor=vec4(vColor.rgb*(ambient+diffuse*0.58)+spec,vColor.a);}';
const lineVS='attribute vec3 aPosition;attribute vec4 aColor;uniform mat4 uMvp;varying vec4 vColor;void main(){vColor=aColor;gl_Position=uMvp*vec4(aPosition,1.0);}';
const lineFS='precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}';
function buffer(gl,data){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);return b;}
function bindAttribute(gl,program,name,b,size){
 const loc=gl.getAttribLocation(program,name);if(loc<0)return;
 gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);
}
function uploadScene(gl,scene){
 const arrays={
  meshPos:scene.solid.p,meshNorm:scene.solid.n,meshColor:scene.solid.c,
  alphaPos:scene.translucent.p,alphaNorm:scene.translucent.n,alphaColor:scene.translucent.c,
  linePos:scene.lines.p,lineColor:scene.lines.c
 };
 const out={};
 for(const [key,data] of Object.entries(arrays)){out[key]=buffer(gl,data);out[key+'Count']=data.length/(key.endsWith('Color')?4:3);}
 return out;
}

export function createAngleSimulation3D(canvas,initialConfig,onError=()=>{},onOrbit=()=>{}){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false})||canvas.getContext('experimental-webgl',{antialias:true,alpha:false});
 if(!gl)throw new Error('WebGL không được hỗ trợ');
 const meshProgram=program(gl,meshVS,meshFS),lineProgram=program(gl,lineVS,lineFS);
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 let config={...initialConfig},yaw=Number.isFinite(Number(initialConfig.orbitYaw))?Number(initialConfig.orbitYaw):30,pitch=Number.isFinite(Number(initialConfig.orbitPitch))?Number(initialConfig.orbitPitch):28,sceneBuffers=null,pendingFrame=0,failed=false,disposed=false,resizeObserver=null,initializing=true;
 let start=null,activePointer=null;
 function draw(){
  if(disposed||failed)return;
  try{
   const rect=canvas.getBoundingClientRect(),dpr=clamp(window.devicePixelRatio||1,1,2);
   const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   gl.viewport(0,0,width,height);gl.clearColor(.94,.97,.95,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const target=[0,1.03,0],radius=Math.max(6,config.distance+5),e=pitch*PI/180,yawRad=yaw*PI/180;
   const eye=[target[0]+radius*Math.sin(yawRad)*Math.cos(e),target[1]+radius*Math.sin(e),target[2]+radius*Math.cos(yawRad)*Math.cos(e)];
   const view=lookAt(eye,target),proj=perspective(48*PI/180,width/height,.05,80),mvp=multiply(proj,view);
   if(!sceneBuffers){sceneBuffers=uploadScene(gl,makeScene(config));}
   gl.useProgram(meshProgram);
   bindAttribute(gl,meshProgram,'aPosition',sceneBuffers.meshPos,3);bindAttribute(gl,meshProgram,'aNormal',sceneBuffers.meshNorm,3);bindAttribute(gl,meshProgram,'aColor',sceneBuffers.meshColor,4);
   gl.uniformMatrix4fv(gl.getUniformLocation(meshProgram,'uMvp'),false,mvp);gl.uniformMatrix4fv(gl.getUniformLocation(meshProgram,'uView'),false,view);
   gl.depthMask(true);gl.drawArrays(gl.TRIANGLES,0,sceneBuffers.meshPosCount);
   if(sceneBuffers.alphaPosCount){
    bindAttribute(gl,meshProgram,'aPosition',sceneBuffers.alphaPos,3);bindAttribute(gl,meshProgram,'aNormal',sceneBuffers.alphaNorm,3);bindAttribute(gl,meshProgram,'aColor',sceneBuffers.alphaColor,4);
    gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,sceneBuffers.alphaPosCount);gl.depthMask(true);
   }
   gl.useProgram(lineProgram);bindAttribute(gl,lineProgram,'aPosition',sceneBuffers.linePos,3);bindAttribute(gl,lineProgram,'aColor',sceneBuffers.lineColor,4);
   gl.uniformMatrix4fv(gl.getUniformLocation(lineProgram,'uMvp'),false,mvp);
   gl.depthMask(false);gl.drawArrays(gl.LINES,0,sceneBuffers.linePosCount);gl.depthMask(true);
  }catch(error){failed=true;if(initializing)throw error;onError(error);}
 }
 function rebuild(){if(sceneBuffers){for(const k of ['meshPos','meshNorm','meshColor','alphaPos','alphaNorm','alphaColor','linePos','lineColor'])gl.deleteBuffer(sceneBuffers[k]);sceneBuffers=null;}draw();}
 function queueRebuild(){if(pendingFrame)return;pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;rebuild();});}
 function contextLost(e){e.preventDefault();failed=true;onError(new Error('WebGL context bị mất'));}
 function pointerDown(e){if(e.button!==undefined&&e.button!==0)return;activePointer=e.pointerId;start={x:e.clientX,y:e.clientY,yaw,pitch};try{canvas.setPointerCapture?.(e.pointerId);}catch{}e.preventDefault();}
 function pointerMove(e){if(activePointer!==e.pointerId||!start)return;yaw=clamp(start.yaw+(e.clientX-start.x)*.35,-160,160);pitch=clamp(start.pitch-(e.clientY-start.y)*.25,8,72);onOrbit(yaw,pitch);draw();}
 function pointerUp(e){if(activePointer===e.pointerId){activePointer=null;start=null;}}
 function keyDown(e){const step=e.shiftKey?12:6;if(e.key==='ArrowLeft')yaw-=step;else if(e.key==='ArrowRight')yaw+=step;else if(e.key==='ArrowUp')pitch=clamp(pitch-step,8,72);else if(e.key==='ArrowDown')pitch=clamp(pitch+step,8,72);else return;e.preventDefault();yaw=clamp(yaw,-160,160);onOrbit(yaw,pitch);draw();}
 canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('keydown',keyDown);
 if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(draw);resizeObserver.observe(canvas);}
 else window.addEventListener('resize',draw);
 try{draw();initializing=false;}catch(error){resizeObserver?.disconnect();window.removeEventListener('resize',draw);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('keydown',keyDown);gl.deleteProgram(meshProgram);gl.deleteProgram(lineProgram);throw error;}
 return {update(next){config={...next};queueRebuild();},orbit(dx,dy){yaw=clamp(yaw+dx,-160,160);pitch=clamp(pitch+dy,8,72);onOrbit(yaw,pitch);draw();},dispose(){disposed=true;if(pendingFrame)cancelAnimationFrame(pendingFrame);resizeObserver?.disconnect();window.removeEventListener('resize',draw);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('keydown',keyDown);if(sceneBuffers)for(const k of ['meshPos','meshNorm','meshColor','alphaPos','alphaNorm','alphaColor','linePos','lineColor'])gl.deleteBuffer(sceneBuffers[k]);gl.deleteProgram(meshProgram);gl.deleteProgram(lineProgram);}};
}
