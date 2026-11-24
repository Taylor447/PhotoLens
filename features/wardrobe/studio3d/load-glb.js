import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader,DRACO_GLTF_CONFIG} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export function createLocalGlbLoader(renderer,signal){
  const gltf=new GLTFLoader(),draco=new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG).setWorkerLimit(1);
  const ktx=new KTX2Loader().setWorkerLimit(1).detectSupport(renderer);
  gltf.setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
  const dispose=()=>{draco.dispose();ktx.dispose();};
  signal?.addEventListener('abort',dispose,{once:true});
  return {parse:bytes=>gltf.parseAsync(bytes,''),dispose};
}
