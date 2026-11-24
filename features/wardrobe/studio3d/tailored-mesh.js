const TAU = Math.PI * 2;
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
const lerp = (a,b,t) => a+(b-a)*t;
const norm = v => {const scale=Math.hypot(...v)||1; return v.map(x=>x/scale);};
const sub = (a,b) => a.map((value,i)=>value-b[i]);
const cross = ([ax,ay,az],[bx,by,bz]) => [ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];

export function surfaceNormals({points,indices}){
  const normals = points.map(()=>[0,0,0]);
  for(let i=0;i<indices.length;i+=3){
    const ids=indices.slice(i,i+3), [a,b,c]=ids.map(id=>points[id]);
    const n=cross(sub(b,a),sub(c,a));
    for(const id of ids)for(let axis=0;axis<3;axis++)normals[id][axis]+=n[axis];
  }
  return normals.map(normal=>Math.hypot(...normal)>1e-8?norm(normal):[0,1,0]);
}

export function tailoringSurface(body){
  const normals=surfaceNormals(body);
  return body.points.map((point,i)=>{
    const skin=body.skin[i];
    const weight=prefix=>skin.reduce((sum,[bone,w])=>sum+(prefix.test(bone)?w:0),0);
    return {point,skin,normal:normals[i],arm:weight(/^(UpperArm|Forearm|Hand)_/),leg:weight(/^(Thigh|Shin|Foot)_/),
      head:weight(/^Head$/)};
  });
}

function mixSkin(a,b,t){
  const total=new Map();
  for(const [skin,scale] of [[a,1-t],[b,t]])for(const [bone,w] of skin)
    total.set(bone,(total.get(bone)||0)+w*scale);
  const largest=[...total].filter(([,w])=>w>1e-7).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const denominator=largest.reduce((sum,[,w])=>sum+w,0);
  return largest.map(([bone,w])=>[bone,w/denominator]);
}

function waistToShoulder(sample,cut,layout){
  const {point:[x,y,z],arm,head}=sample;
  const {m,waist,shoulder,pelvis,neckTop}=layout;
  const hem=waist-(waist-pelvis)*cut.hem*cut.length;
  const {neck,sleeve,closure}=cut;
  const front=z>0;
  const across=clamp(Math.abs(x)/(m.neck*.26),0,1);
  const dip=front ? {crew:5,shirt:4,square:10,v:17,high:0}[neck]||0 : 2.2;
  const scoop=neck==='square'?Math.min(1,(1-across)*3.4):neck==='v'?1-across:1-across*across;
  const neckline=neck==='high' ? lerp(shoulder,neckTop,.60)
    : shoulder+4.2-dip*scoop;
  const neckCut=Math.min(neckline-y,(.35-head)*26);
  const opening=front&&(closure==='open'||closure==='lapels')
    ? Math.abs(x)-(closure==='lapels'?Math.max(.9,(y-waist)*.21):1.5) : Infinity;
  const trunk=Math.min(y-hem,neckCut,opening,(.47-arm)*35);
  if(sleeve==='sleeveless')return trunk;
  const sleeveEnd=shoulder-m.sleeve*({short:.34,long:.95,wide:.73}[sleeve]||.34);
  const sleeveCut=Math.min(y-sleeveEnd,(arm-.12)*35,neckCut);
  return Math.max(trunk,sleeveCut);
}

function trouserCut({point:[,y],arm,leg},cut,{ankle,crotch,waist}){
  const bottom=lerp(crotch,ankle,clamp(cut.inseam*cut.length,.24,1));
  const top=lerp(crotch,waist,cut.rise);
  const crotchEdge=(leg-.12)*38;
  return Math.min(top-y,y-bottom,(.18-arm)*40,Math.max(y-crotch,crotchEdge));
}

function localStyling(sample,cut,layout,lower){
  const [x,y,z]=sample.point;
  const {shoulder,waist,crotch,ankle}=layout;
  if(lower){
    const shin=clamp((crotch-y)/(crotch-ankle),0,1);
    const cuff=cut.cuffs ? Math.max(0,(shin-.84)*6) : 0;
    const ridges=cut.armor&&shin>.4 ? .45*Math.cos(shin*TAU*6) : 0;
    return cut.taper*2.1*shin-cuff+ridges;
  }
  const trunk=1-sample.arm, middle=clamp((y-waist)/(shoulder-waist),0,1);
  if(z<=0)return 0;
  let relief=0;
  if(cut.closure==='armor')relief=.72+.58*Math.cos(middle*TAU*3);
  if(cut.closure==='placket'||cut.closure==='zip')relief=.65*Math.max(0,1-Math.abs(x)/1.9);
  if(cut.closure==='diagonal')relief=.65*Math.max(0,1-Math.abs(x-(middle-.52)*12)/2);
  if(cut.pockets&&middle<.33&&Math.abs(x)>6&&Math.abs(x)<13)relief+=.55;
  return relief*trunk;
}

function cutMesh(body,surface,values,positions){
  const points=[],skin=[],indices=[],uv=[],byVertex=new Map(),byEdge=new Map();
  const add=(point,influences,tex)=>{
    const index=points.length;
    points.push(point);skin.push(influences);uv.push(...tex);
    return index;
  };
  const texcoord=index=>[.5+surface[index].point[0]/80,surface[index].point[1]/105];
  function source(id){
    if(!byVertex.has(id))byVertex.set(id,add(positions[id],surface[id].skin,texcoord(id)));
    return byVertex.get(id);
  }
  function edge(a,b){
    const t=values[a]/(values[a]-values[b]);
    if(t<1e-8)return source(a);
    if(t>1-1e-8)return source(b);
    const key=Math.min(a,b)+':'+Math.max(a,b);
    if(!byEdge.has(key)){
      byEdge.set(key,add(positions[a].map((v,i)=>lerp(v,positions[b][i],t)),
        mixSkin(surface[a].skin,surface[b].skin,t),texcoord(a).map((v,i)=>lerp(v,texcoord(b)[i],t))));
    }
    return byEdge.get(key);
  }
  for(let i=0;i<body.indices.length;i+=3){
    const face=body.indices.slice(i,i+3), polygon=[];
    for(let j=0;j<3;j++){
      const a=face[j],b=face[(j+1)%3];
      if(values[a]>=0)polygon.push(source(a));
      if((values[a]>=0)!==(values[b]>=0))polygon.push(edge(a,b));
    }
    for(let j=1;j+1<polygon.length;j++)if(new Set([polygon[0],polygon[j],polygon[j+1]]).size===3)
      indices.push(polygon[0],polygon[j],polygon[j+1]);
  }
  return {points,indices,skin,uv,bone:'Root',cloth:false};
}

export function cutCoverage(surface,cut,layout,lower){
  return surface.map(s=>lower?trouserCut(s,cut,layout):waistToShoulder(s,cut,layout));
}

export function tailoredMesh(body,surface,cut,layout,{lower=false,values}={}){
  const positions=surface.map(sample=>{
    const {point,normal}=sample;
    const ease=cut.width+localStyling(sample,cut,layout,lower);
    const [x,y,z]=point;
    const {shoulder,m,chestRx,chestRz}=layout;
    // A layer needs less ease in the narrow gap between the torso and sleeve.
    const innerArm=(.6<sample.arm&&normal[0]*Math.sign(x)<0);
    const sideTorso=(sample.arm<=.6&&Math.abs(x)>chestRx*.69);
    const belowShoulder=clamp((shoulder-y)/7,0,1);
    const aboveCuff=clamp((y-shoulder+m.sleeve*.76)/8,0,1);
    const sideDepth=clamp((chestRz*.91-Math.abs(z))/4,0,1);
    const pinch=lower||(!innerArm&&!sideTorso)?0:belowShoulder*aboveCuff*sideDepth;
    const vertical=lower?0:clamp((y-layout.chest)/8,0,1)*(1-.60*pinch);
    return point.map((v,axis)=>v+normal[axis]*ease*(axis===0?1-.88*pinch:axis===1?vertical:1));
  });
  return cutMesh(body,surface,values,positions);
}
