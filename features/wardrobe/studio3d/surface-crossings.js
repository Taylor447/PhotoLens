const CELL_CM=6;
const EPSILON=1e-6;
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const cell=y=>Math.floor(y/CELL_CM);
const overlap=(a,b)=>a.min.every((value,axis)=>value<=b.max[axis]&&a.max[axis]>=b.min[axis]);

export function prepareSurface(points,indices){
  const triangles=[],bands=new Map();
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<indices.length;i+=3){
    const vertices=indices.slice(i,i+3).map(index=>points[index]);
    const low=[0,1,2].map(axis=>Math.min(...vertices.map(p=>p[axis])));
    const high=[0,1,2].map(axis=>Math.max(...vertices.map(p=>p[axis])));
    for(let axis=0;axis<3;axis++){
      min[axis]=Math.min(min[axis],low[axis]);max[axis]=Math.max(max[axis],high[axis]);
    }
    const edges=vertices.map((p,j)=>subtract(vertices[(j+1)%3],p));
    const face={vertices,edges,edge2:subtract(vertices[2],vertices[0]),min:low,max:high};
    triangles.push(face);
    for(let y=cell(low[1]);y<=cell(high[1]);y++){
      if(!bands.has(y))bands.set(y,[]);
      bands.get(y).push(face);
    }
  }
  return {min,max,triangles,bands};
}

function crosses(a,b){
  for(let i=0;i<3;i++){
    const direction=a.edges[i], h=cross(direction,b.edge2);
    const det=dot(b.edges[0],h);
    if(Math.abs(det)<EPSILON)continue;
    const delta=subtract(a.vertices[i],b.vertices[0]), u=dot(delta,h)/det;
    if(u<-EPSILON||u>1+EPSILON)continue;
    const q=cross(delta,b.edges[0]),v=dot(q,direction)/det;
    if(v<-EPSILON||u+v>1+EPSILON)continue;
    // Shared hems can touch. Count an edge that passes through the other surface.
    const t=dot(b.edge2,q)/det;
    if(t>EPSILON&&t<1-EPSILON)return true;
  }
  return false;
}

export function countSurfaceCrossings(a,b,limit=Infinity){
  if(!overlap(a,b))return 0;
  let crossings=0;
  for(const face of a.triangles){
    for(let y=cell(face.min[1]);y<=cell(face.max[1]);y++){
      for(const other of b.bands.get(y)||[]){
        // Each pair is visited in its first shared band.
        if(cell(Math.max(face.min[1],other.min[1]))!==y||!overlap(face,other))continue;
        if(crosses(face,other)||crosses(other,face)){
          crossings++;
          if(crossings>=limit)return crossings;
        }
      }
    }
  }
  return crossings;
}

export function findFirstSurfaceConflict(candidateSurfaces,layers){
  for(const layer of layers)for(const candidate of candidateSurfaces)for(const surface of layer.surfaces)
    if(countSurfaceCrossings(candidate,surface,1))return layer.item;
  return null;
}
