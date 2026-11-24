export const ring=(y,rx,rz,x=0,z=0)=>({x,y,z,rx,rz});
export const part=(bone,rings,cap=false,cloth=false)=>({bone,rings,cap,cloth});
const withCorners=(descriptor,shape)=>({...descriptor,shape});
const piece=(bone,y,rx,depth,height,x=0,z=0,shape=1)=>withCorners(part(bone,[
  ring(y-height/2,rx*.9,depth*.9,x,z),ring(y,rx,depth,x,z),ring(y+height/2,rx*.92,depth*.9,x,z)
],true),shape);

function footwear({m,ankle,hipRx,sideData},variant,ease){
  const profiles=[
    {top:1.1,sole:1.1,front:1.04,width:1.0},
    {top:3.5,sole:1.9,front:1.18,width:1.13},
    {top:11,sole:1.8,front:1.06,width:1.04},
    {top:.3,sole:.9,front:1.00,width:.96},
    {top:18,sole:2.35,front:1.18,width:1.22}
  ];
  const {top,sole,front,width}=profiles[variant],f=m.heightCm*.134;
  const rx=Math.min(14,Math.max(5.6,hipRx*.46))*.48*width+ease;
  return sideData.map(({suffix,legX})=>{
    const bone='Foot_'+suffix;
    const sections=[
      ring(.1-sole,rx*.94,f*.43*front,legX,f*.27),
      ring(.35,rx,f*.49*front,legX,f*.27),
      ring(ankle*.53+sole*.46,rx*.96,f*.45*front,legX,f*.26),
      ring(ankle+top*.44,rx*.77,f*.30,legX,f*.13),
      ring(ankle+top,rx*.72,f*.23,legX,0)
    ];
    const shoe=part(bone,sections,'bottom');
    return variant===3?[shoe,piece(bone,ankle+1,rx*.88,1.2,1.1,legX,f*.30)]:[shoe];
  }).flat();
}

function headwear({m,neckTop,headHeight},variant,ease){
  const h=m.heightCm,r=headHeight*.35+ease;
  const brow=neckTop+headHeight*.65;
  const styles=[
    [ring(brow-.5,r*1.73,r*1.60),ring(brow+.15,r*1.74,r*1.61),ring(brow+1,r,r*.97),ring(h+2,r*.82,r*.81)],
    [ring(brow,r*1.02,r*.91),ring(h-1,r*.91,r*.88),ring(h+1.9,r*.42,r*.38)],
    [ring(brow-1,r*2.17,r*2.11),ring(brow+.75,r*2.09,r*2.0),ring(h+10,.28,.28)],
    [ring(brow-.4,r*1.02,r),ring(brow+2,r*1.04,r),ring(h-2,r*.92,r*.89),ring(h+2.7,r*.40,r*.37)],
    [ring(brow-3,r*1.05,r*.93),ring(brow+2,r*1.19,r*1.07),ring(h-1,r*.89,r*.91),ring(h+5,r*.52,r*.53)]
  ];
  // Keep a brim or crown open below so it does not fill the head as a solid disc.
  const primary=part('Head',styles[variant],'top');
  const detail=variant===1
    ? [piece('Head',brow-1,r*.91,r*.74,.9,0,r*1.06,.69)]
    : variant===4?[piece('Head',h+2.7,1.2,r*.8,5.5,0,.2,.45)]:[];
  return [primary,...detail];
}

function bags({hipRx,hipRz,crotch,waist},variant,ease){
  const styles=[
    [9.5,4.5,13,.78], [12.5,4.7,22,.47], [10,5.2,18,.49],
    [7,3.6,10,.53], [11,5.4,16,.29]
  ];
  const [rx,depth,height,shape]=styles[variant];
  const x=hipRx+rx+1.8+ease,z=hipRz*.69,y=crotch-height*.18;
  const bag=piece('Pelvis',y,rx,depth,height,x,z,shape);
  const grip=part('Pelvis',[
    ring(y+height*.38,rx*.67,.7,x,z),ring(y+height*.70,rx*.48,.66,x,z),
    ring(y+height*.79,rx*.31,.65,x,z)
  ]);
  const front=piece('Pelvis',y+height*.21,rx*.52,.65,Math.min(3.5,waist-y),x,z+depth*.94,.42);
  return [bag,grip,front];
}

function glasses({headHeight,neckTop},variant,ease){
  const widths=[.166,.181,.165,.204,.196],heights=[.159,.14,.126,.10,.188],corners=[1,.48,.79,.57,.39];
  const x=headHeight*.166,y=neckTop+headHeight*(variant===4?.48:.52),z=headHeight*.39+ease;
  const rx=headHeight*widths[variant],height=headHeight*heights[variant];
  const lenses=[-1,1].map(sign=>piece('Head',y,rx,variant===3?1.45:.85,height,sign*x,z,corners[variant]));
  const bridge=piece('Head',y+.185*height,rx*.52,.9,.6,0,z+.1);
  return [...lenses,bridge];
}

function scarves({shoulder,neckTop,neckRx,neckRz,chest,waist},variant,ease){
  const top=[2,3,1,6,4][variant]+shoulder;
  const band=part('Neck',[
    ring(shoulder+.4,neckRx+ease+.2,neckRz+ease),
    ring(Math.min(neckTop-.4,top),neckRx+ease,neckRz+ease+.6)
  ]);
  if(variant===3)return [band];
  const tip=[chest-5,chest-1,waist+1,shoulder,chest-3][variant];
  return [band,part('Spine',[
    ring(tip,variant===1?.6:2.1,.8,variant===4?-3:3,neckRz+5+ease),
    ring((tip+shoulder)*.5,variant===1?4:2.8,1.15,2.5,neckRz+5+ease),
    ring(shoulder+1,3.4,1.1,1.5,neckRz+ease)
  ])];
}

function jewelry({neckRx,neckRz,shoulder,neckTop,headHeight,sideData,chestRz},variant,ease){
  const y=shoulder+.9;
  switch(variant){
    case 1: {
      const {armX,handY}=sideData[1];
      return [part('Hand_R',[ring(handY-.7,3.05+ease,3.0+ease,armX),ring(handY+.65,3.08+ease,3.0+ease,armX)])];
    }
    case 2: return [-1,1].map(sign=>piece('Head',neckTop+headHeight*.24,1.36,1.1,4,sign*(headHeight*.35+ease+1),1));
    case 3: return [piece('Spine',shoulder-13,3.0,1.1,4.5,-7,chestRz+ease+2,.6)];
    default:{
      const band=part('Neck',[ring(y,neckRx+ease,neckRz+ease),ring(y+1,neckRx+ease,neckRz+ease)]);
      return [band,piece('Neck',y-1,variant===4?3:1.8,1,variant===4?5.8:3.8,0,neckRz+ease+1,.61)];
    }
  }
}

function hair({m,headHeight,neckTop},variant,ease){
  const h=m.heightCm,r=headHeight*.33+ease;
  if(variant===0)return [part('Head',[ring(h-headHeight*.25,r,r*.95),ring(h-headHeight*.19,r*.94,r*.91)])];
  const y=h-2.2;
  if(variant===1)return [piece('Head',y,4.0,1.05,1.45,r*.48,r*.69,.48)];
  if(variant===2)return [piece('Head',y+2.3,1.27,1.12,8.3,r*.39,.8,.55)];
  if(variant===3)return [-1,1].map(sign=>piece('Head',h-2,3.4,1.45,4.25,sign*2.6,r*.78,.77));
  return [piece('Head',neckTop+headHeight*.86,2.0,1.6,6.8,-r*.50,r*.69,.44)];
}

export function accessoryShells(category,layout,variant,layerOffset){
  const ease=.95+Math.min(1.3,layerOffset*.35);
  switch(category){
    case 'shoes':return footwear(layout,variant,ease);
    case 'hats':return headwear(layout,variant,ease);
    case 'bags':
    case 'accessories':return bags(layout,variant,ease);
    case 'eyewear':return glasses(layout,variant,ease);
    case 'scarves':return scarves(layout,variant,ease);
    case 'jewelry':return jewelry(layout,variant,ease);
    case 'hair':return hair(layout,variant,ease);
    default:return [];
  }
}
