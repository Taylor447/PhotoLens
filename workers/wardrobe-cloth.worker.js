import {CLOTH_MAX_DISPLACEMENT_CM} from '../features/wardrobe/studio3d/cloth-motion.js';
import {createClothCollisionGuard} from '../features/wardrobe/studio3d/cloth-collisions.js';

const TICK_MS=50;
let meshes=[], timer=null, time=0;

function integrate(mesh, wind) {
  const {rest, current, previous, rows, stride}=mesh;
  for(let i=0;i<current.length/3;i++){
    const row=Math.floor(i/stride);
    if(row===rows-1)continue;
    for(let axis=0;axis<3;axis++){
      const index=i*3+axis, value=current[index];
      const breeze=axis===2?wind*.13*Math.sin(rest[i*3]*.12+time*2):axis===1?-.045:0;
      current[index]+= (value-previous[index])*.74+(rest[index]-value)*.24+breeze;
      previous[index]=value;
    }
  }
  for(let step=0;step<3;step++)for(const [left,right,length] of mesh.links){
    const a=left*3,b=right*3,dx=current[b]-current[a],dy=current[b+1]-current[a+1],dz=current[b+2]-current[a+2];
    const distance=Math.hypot(dx,dy,dz);
    if(distance<1e-6)continue;
    const pinned=right>=stride*(rows-1), ratio=(distance-length)/distance*(pinned?1:.5);
    current[a]+=dx*ratio;current[a+1]+=dy*ratio;current[a+2]+=dz*ratio;
    if(!pinned){current[b]-=dx*ratio;current[b+1]-=dy*ratio;current[b+2]-=dz*ratio;}
  }
  for(let row=0;row<rows-1;row++){
    const first=row*stride*3, end=first+(stride-1)*3;
    for(let axis=0;axis<3;axis++)current[end+axis]=current[first+axis];
  }
  return Float32Array.from(current,(value,i)=>rest[i]+Math.max(
    -CLOTH_MAX_DISPLACEMENT_CM,Math.min(CLOTH_MAX_DISPLACEMENT_CM,value-rest[i])
  ));
}

function setup({key,positions,rows,stride}){
  const rest=Float32Array.from(positions), links=[];
  function link(a,b){
    links.push([a,b,Math.hypot(rest[a*3]-rest[b*3],rest[a*3+1]-rest[b*3+1],rest[a*3+2]-rest[b*3+2])]);
  }
  for(let row=0;row<rows-1;row++)for(let col=0;col<stride-1;col++){
    const i=row*stride+col;
    link(i,i+1);link(i,i+stride);
  }
  return {key,rest,current:rest.slice(),previous:rest.slice(),accepted:rest.slice(),revision:0,rows,stride,links};
}
self.onmessage=({data})=>{
  clearInterval(timer);
  if(data?.type!=='start')return;
  time=0;
  const accept=createClothCollisionGuard({body:data.body,garments:data.garments,cloth:data.meshes});
  meshes=data.meshes.map(setup);
  const wind=Math.min(1,Math.max(.18,Number(data.windKmh||0)/35));
  timer=setInterval(()=>{
    time+=TICK_MS/1000;
    const frames=meshes.map(mesh=>{
      const proposed=integrate(mesh,wind);
      if(accept(mesh.key,proposed)){
        mesh.accepted=proposed;
        mesh.revision++;
      }else{
        mesh.current.set(mesh.accepted);
        mesh.previous.set(mesh.accepted);
      }
      // Send the full accepted batch so the renderer can drop late messages safely.
      return {key:mesh.key,positions:mesh.accepted.slice(),revision:mesh.revision};
    });
    self.postMessage(frames,frames.map(frame=>frame.positions.buffer));
  },TICK_MS);
};
