const ROUGHNESS = {
  silk:.29,satin:.31,leather:.48,'faux-leather':.52,velvet:.88,denim:.91,
  linen:.94,cotton:.83,wool:.96,nylon:.58,polyester:.62,'technical-fabric':.65,
  viscose:.56,twill:.87,jersey:.82,canvas:.92,chiffon:.38,fleece:.97,technical:.64,knit:.91,lace:.79,tulle:.76
};
const MATERIAL_SURFACE = Object.freeze({
  cotton:'woven',linen:'linen',denim:'twill',wool:'boucle',silk:'silk',leather:'pebbled',
  polyester:'smooth',nylon:'smooth',viscose:'silk',satin:'silk',twill:'twill',jersey:'knit',
  canvas:'heavy-woven',chiffon:'silk',velvet:'pile',fleece:'pile',technical:'smooth',
  knit:'knit',lace:'open-weave',tulle:'open-weave'
});
const SURFACE_PROFILES = Object.freeze({
  woven:{id:'woven',normalScale:.22,roughnessVariation:14},
  linen:{id:'linen',normalScale:.31,roughnessVariation:20},
  twill:{id:'twill',normalScale:.27,roughnessVariation:15},
  boucle:{id:'boucle',normalScale:.24,roughnessVariation:22},
  silk:{id:'silk',normalScale:.055,roughnessVariation:5},
  pebbled:{id:'pebbled',normalScale:.19,roughnessVariation:17},
  smooth:{id:'smooth',normalScale:.075,roughnessVariation:6},
  knit:{id:'knit',normalScale:.25,roughnessVariation:19},
  'heavy-woven':{id:'heavy-woven',normalScale:.29,roughnessVariation:18},
  pile:{id:'pile',normalScale:.18,roughnessVariation:24},
  'open-weave':{id:'open-weave',normalScale:.2,roughnessVariation:16}
});

export function fabricSurfaceProfile(materialId){
  const id=MATERIAL_SURFACE[materialId];
  return id?SURFACE_PROFILES[id]:null;
}

const TAU=Math.PI*2;
const HEIGHT_FIELDS=new Map();
function surfaceHeight(profile,u,v){
  const wave=(x,y,phase=0)=>Math.sin(TAU*(x*u+y*v)+phase);
  switch(profile){
    case 'woven':return wave(18,0)*wave(0,18)*.48+wave(36,36)*.12;
    case 'linen':return wave(12,0)*wave(0,13)*.58+wave(25,17)*.16;
    case 'twill':return wave(12,12)*.55+wave(24,-24)*.2+wave(0,18)*.12;
    case 'boucle':return wave(7,0)*wave(0,8)*.44+wave(13,11)*.28+wave(19,-17)*.12;
    case 'silk':return wave(0,22)*.34+wave(0,7)*.12+wave(2,0)*.025;
    case 'pebbled':return wave(7,5)*wave(3,8)*.4+wave(14,-9)*.18;
    case 'knit':return wave(8,0)*.32+wave(0,8)*.32+wave(8,8)*.16;
    case 'heavy-woven':return wave(10,0)*wave(0,10)*.5+wave(20,20)*.22;
    case 'pile':return wave(0,11)*.42+wave(11,11)*.26+wave(0,23)*.1;
    case 'open-weave':return wave(10,0)*wave(0,10)*.35+wave(20,20)*.15;
    default:return wave(17,0)*.08+wave(0,5)*.04;
  }
}

function surfaceHeightField(profile){
  if(HEIGHT_FIELDS.has(profile))return HEIGHT_FIELDS.get(profile);
  const size=128,field=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)field[y*size+x]=surfaceHeight(profile,x/size,y/size);
  HEIGHT_FIELDS.set(profile,field);
  return field;
}

function paintSurfaceMap(ctx,profile,kind){
  const size=128,image=ctx.createImageData(size,size),strength=2.25;
  const field=surfaceHeightField(profile),height=(x,y)=>field[((y%size+size)%size)*size+(x%size+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,h=height(x,y);
    if(kind==='normal'){
      let nx=-(height(x+1,y)-height(x-1,y))*strength;
      let ny=(height(x,y+1)-height(x,y-1))*strength;
      const length=Math.hypot(nx,ny,1);nx/=length;ny/=length;const nz=1/length;
      image.data[i]=Math.round((nx*.5+.5)*255);
      image.data[i+1]=Math.round((ny*.5+.5)*255);
      image.data[i+2]=Math.round((nz*.5+.5)*255);
    }else{
      const variation=SURFACE_PROFILES[profile].roughnessVariation;
      const value=Math.max(0,Math.min(255,Math.round(238+h*variation)));
      image.data[i]=image.data[i+1]=image.data[i+2]=value;
    }
    image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
}

function tile(size,draw){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const context=canvas.getContext('2d');
  draw(context);
  return canvas;
}

function texture(T,paint,{color=false,repeatX=1,repeatY=1}={}){
  // Draw a 128 px motif, then tile it without resampling into a 1024 px texture.
  const motif=tile(128,paint);
  const map=new T.CanvasTexture(tile(1024,ctx=>{
    ctx.fillStyle=ctx.createPattern(motif,'repeat');
    ctx.fillRect(0,0,1024,1024);
  }));
  map.wrapS=map.wrapT=T.RepeatWrapping;
  map.repeat.set(repeatX,repeatY);
  if(color)map.colorSpace=T.SRGBColorSpace;
  return map;
}

function paintPattern(ctx,id){
  ctx.fillStyle='#fcfcfc';ctx.fillRect(0,0,128,128);
  ctx.fillStyle='#929292';ctx.strokeStyle='#929292';ctx.lineWidth=6;
  const circle=(x,y,size)=>{ctx.beginPath();ctx.arc(x,y,size,0,2*Math.PI);ctx.fill();};
  if(/stripe/.test(id)){
    const count=id==='pinstripe'||id==='thin-stripe'?8:id==='wide-stripe'?2:4;
    const step=128/count, width=id==='pinstripe'?2:step*.28;
    for(let i=0;i<count;i++)if(id==='horizontal-stripe')ctx.fillRect(0,i*step,128,width);else ctx.fillRect(i*step,0,width,128);
  }else if(/gingham|plaid|check|windowpane|pixel-grid|houndstooth/.test(id)){
    const width=id==='windowpane'?3:id==='gingham'?12:8;
    for(let i=0;i<128;i+=32){
      ctx.fillRect(i,0,width,128);ctx.fillRect(0,i,128,width);
    }
    if(id==='checker'||id==='houndstooth')for(let y=0;y<4;y++)for(let x=0;x<4;x++)if((x+y)%2===0)ctx.fillRect(x*32,y*32,32,32);
  }else if(/dot|polka|speckle/.test(id)){
    const cells=/micro|small/.test(id)?8:4,period=128/cells,radius=/large/.test(id)?6:/micro/.test(id)?1.6:3;
    for(let y=0;y<cells;y++)for(let x=0;x<cells;x++)circle((x+.5)*period,(y+.5)*period,radius);
  }else if(/floral|botanical|tropical|embroidered|lace/.test(id)){
    const count=id==='floral-small'?4:2;
    for(let y=0;y<count;y++)for(let x=0;x<count;x++){
      const cx=(x+.5)*128/count,cy=(y+.5)*128/count,scale=2/count;
      for(let a=0;a<6;a++)circle(cx+Math.cos(a*Math.PI/3)*9*scale,cy+Math.sin(a*Math.PI/3)*9*scale,4.4*scale);
      circle(cx,cy,3.2*scale);
    }
  }else if(/chevron|wave|argyle|diamond|geometric|ikat/.test(id)){
    for(let y=-32;y<=128;y+=32){
      ctx.beginPath();
      for(let x=0;x<=128;x+=4){
        const value=id==='wave'?Math.sin(x*Math.PI/32)*8:Math.abs((x%64)-32)*.40;
        ctx.lineTo(x,y+value);
      }
      ctx.stroke();
    }
  }else if(/camo|marble|brush|abstract|paisley|batik/.test(id)){
    let seed=[...id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),7);
    const next=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<22;i++){
      const x=next()*128,y=next()*128,r=next()*11+3;
      ctx.fillStyle=i%2?'#9a9a9a':'#c1c1c1';
      for(const dx of [-128,0,128])for(const dy of [-128,0,128])circle(x+dx,y+dy,r);
    }
  }else if(id==='color-block'||id==='gradient'){
    if(id==='gradient'){
      const g=ctx.createLinearGradient(0,0,128,0);
      g.addColorStop(0,'white');g.addColorStop(.5,'#8e8e8e');g.addColorStop(1,'white');ctx.fillStyle=g;
    }
    ctx.fillRect(0,0,id==='gradient'?128:64,128);
  }else{
    for(let y of [32,96])for(let x of [32,96]){
      ctx.beginPath();
      if(id==='star'){
        for(let i=0;i<10;i++){const angle=i*Math.PI/5-Math.PI/2,r=i%2?4:10;ctx.lineTo(x+Math.cos(angle)*r,y+Math.sin(angle)*r);}
      }else if(id==='moon'){
        ctx.arc(x,y,10,0,Math.PI*2);ctx.moveTo(x+11,y-3);ctx.arc(x+4,y-3,8,0,Math.PI*2,true);
      }else{
        ctx.arc(x-6,y+2,5,0,Math.PI*2);ctx.arc(x,y-1,7,0,Math.PI*2);ctx.arc(x+6,y+3,5,0,Math.PI*2);
      }
      ctx.fill();
    }
  }
}

export function createMaterialFactory(T){
  const maps=new Map(),materials=new Set();
  function getMap(key,paint,opts){
    if(!maps.has(key))maps.set(key,texture(T,paint,opts));
    return maps.get(key);
  }
  function material({color='#9ba5a2',materialId,patternId},shell=true){
    const tint=/^#[0-9a-f]{6}$/i.test(color)?color:'#647d69';
    const gloss=ROUGHNESS[materialId]??.84;
    const mat=new T.MeshStandardMaterial({color:tint,roughness:shell?gloss:1,metalness:0,side:shell?T.DoubleSide:T.FrontSide});
    if(shell&&materialId){
      const surface=fabricSurfaceProfile(materialId);
      if(surface){
        mat.normalMap=getMap('normal:'+surface.id,ctx=>paintSurfaceMap(ctx,surface.id,'normal'));
        mat.normalScale.set(surface.normalScale,surface.normalScale);
        mat.roughnessMap=getMap('roughness:'+surface.id,ctx=>paintSurfaceMap(ctx,surface.id,'roughness'));
      }
    }
    if(shell&&patternId&&patternId!=='solid')mat.map=getMap('albedo:'+patternId,ctx=>paintPattern(ctx,patternId),{color:true});
    materials.add(mat);
    return mat;
  }
  return {material,dispose(){for(const x of maps.values())x.dispose();for(const x of materials)x.dispose();}};
}
