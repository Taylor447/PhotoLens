import {Capacitor} from '@capacitor/core';

export function downloadFile(blob,name){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export async function shareFile(blob,name,title){
 if(Capacitor.isNativePlatform()){
  try{
   const [{Filesystem,Directory},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
   const stamp=Date.now().toString(36);
   const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=reject;
    reader.readAsDataURL(blob);
   });
   const saved=await Filesystem.writeFile({path:stamp+'-'+name,data,directory:Directory.Cache});
   await Share.share({title,files:[saved.uri],dialogTitle:'Chia sẻ ảnh'});
   return 'shared';
  }catch(error){
   if(error?.name==='AbortError'||/cancel/i.test(error?.message||''))return 'cancelled';
  }
 }else{
  const file=new File([blob],name,{type:blob.type});
  try{
   if(navigator.canShare?.({files:[file]})){
    await navigator.share({title,files:[file]});
    return 'shared';
   }
  }catch(error){if(error?.name==='AbortError')return 'cancelled';}
 }
 downloadFile(blob,name);
 return 'downloaded';
}
