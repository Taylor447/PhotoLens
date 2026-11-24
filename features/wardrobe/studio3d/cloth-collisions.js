import {bodyRayExits, buildCollider} from './geometry.js';
import {countSurfaceCrossings, prepareSurface} from './surface-crossings.js';

function worldPoints(positions,{origin,axes}){
  const points=[];
  for(let i=0;i<positions.length;i+=3){
    points.push(origin.map((coordinate,axis)=>coordinate
      +positions[i]*axes[0][axis]+positions[i+1]*axes[1][axis]+positions[i+2]*axes[2][axis]));
  }
  return points;
}

export function createClothCollisionGuard({body,garments,cloth}){
  const colliders=buildCollider(body.map(part=>({...part,bone:'Root'})),new Map([['Root',{toWorld:p=>p}]]));
  const fixed=[
    ...body.map(part=>({...part,garment:-1})),
    ...garments
  ].map(({points,indices,garment})=>({garment,surface:prepareSurface(points,indices)}));
  const moving=cloth.map(mesh=>({
    ...mesh,
    surface:prepareSurface(worldPoints(mesh.positions,mesh.transform),mesh.indices)
  }));
  return (key,positions)=>{
    const piece=moving[key];
    const points=worldPoints(positions,piece.transform);
    if(points.some(point=>bodyRayExits(point,colliders).length))return false;
    const proposed=prepareSurface(points,piece.indices);
    for(const other of [...fixed,...moving]){
      // A garment may share a seam between its bodice and lower cloth section.
      if(other.garment!==piece.garment&&countSurfaceCrossings(proposed,other.surface,1))return false;
    }
    piece.surface=proposed;
    return true;
  };
}
