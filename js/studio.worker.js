const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r,g,b] = [c,x,0];
  else if (h < 120) [r,g,b] = [x,c,0];
  else if (h < 180) [r,g,b] = [0,c,x];
  else if (h < 240) [r,g,b] = [0,x,c];
  else if (h < 300) [r,g,b] = [x,0,c];
  else [r,g,b] = [c,0,x];
  return [(r+m)*255,(g+m)*255,(b+m)*255];
}
function blurPixels(src, w, h) {
  const out = new Uint8ClampedArray(src.length);
  for (let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const i=(y*w+x)*4;
    for(let c=0;c<3;c++){
      let total=0,n=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy;
        if(xx>=0&&xx<w&&yy>=0&&yy<h){total+=src[(yy*w+xx)*4+c];n++;}
      }
      out[i+c]=total/n;
    }
    out[i+3]=src[i+3];
  }
  return out;
}
function lutSample(rgb, table, size) {
  if (!table || size < 2) return rgb;
  const p=rgb.map(v=>Math.max(0,Math.min(1,v))*(size-1));
  const lo=p.map(Math.floor), hi=p.map((v,i)=>Math.min(size-1,lo[i]+1)), t=p.map((v,i)=>v-lo[i]);
  const read=(r,g,b,c)=>table[((b*size+g)*size+r)*3+c];
  const out=[];
  for(let c=0;c<3;c++){
    const c00=read(lo[0],lo[1],lo[2],c)*(1-t[0])+read(hi[0],lo[1],lo[2],c)*t[0];
    const c10=read(lo[0],hi[1],lo[2],c)*(1-t[0])+read(hi[0],hi[1],lo[2],c)*t[0];
    const c01=read(lo[0],lo[1],hi[2],c)*(1-t[0])+read(hi[0],lo[1],hi[2],c)*t[0];
    const c11=read(lo[0],hi[1],hi[2],c)*(1-t[0])+read(hi[0],hi[1],hi[2],c)*t[0];
    out[c]=(c00*(1-t[1])+c10*t[1])*(1-t[2])+(c01*(1-t[1])+c11*t[1])*t[2];
  }
  return out;
}
function processPixels(buffer, w, h, s, lut, lutSize, curve) {
  const data=new Uint8ClampedArray(buffer);
  const base=(s.denoise>0||s.sharpen>0)?new Uint8ClampedArray(data):data;
  let blurred=null;
  if (s.denoise>0 || s.sharpen>0) blurred=blurPixels(base,w,h);
  const exposure=Math.pow(2,Number(s.exposure)||0);
  const contrast=Number(s.contrast)||0;
  const contrastFactor=(259*(contrast+255))/(255*(259-contrast));
  const temp=(Number(s.temperature)||0)*0.35, tint=(Number(s.tint)||0)*0.22;
  const sat=Number(s.saturation)||0, vibrance=Number(s.vibrance)||0;
  const hue=Number(s.hue)||0, hslSat=Number(s.hslSaturation)||0, hslLum=Number(s.hslLuminance)||0;
  const lutMix=(Number(s.lutStrength)||0)/100;
  const vignette=(Number(s.vignette)||0)/100, grain=(Number(s.grain)||0);
  const denoise=(Number(s.denoise)||0)/100, sharpen=(Number(s.sharpen)||0)/100;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const i=(y*w+x)*4;
    let r=base[i],g=base[i+1],b=base[i+2];
    if(blurred&&denoise>0){r=r*(1-denoise)+blurred[i]*denoise;g=g*(1-denoise)+blurred[i+1]*denoise;b=b*(1-denoise)+blurred[i+2]*denoise;}
    if(blurred&&sharpen>0){r+=(base[i]-blurred[i])*sharpen*1.8;g+=(base[i+1]-blurred[i+1])*sharpen*1.8;b+=(base[i+2]-blurred[i+2])*sharpen*1.8;}
    r=(r-127.5)*contrastFactor+127.5;g=(g-127.5)*contrastFactor+127.5;b=(b-127.5)*contrastFactor+127.5;
    r*=exposure;g*=exposure;b*=exposure;
    r+=temp+tint*.35;g-=tint*.45;b-=temp+tint*.35;
    let lum=(.2126*r+.7152*g+.0722*b)/255;
    const shadows=(Number(s.shadows)||0)/100, highlights=(Number(s.highlights)||0)/100;
    const shadowWeight=Math.max(0,1-lum*1.8), highlightWeight=Math.max(0,(lum-.42)*1.8);
    const lift=shadows*shadowWeight*72-highlights*highlightWeight*72;
    r+=lift;g+=lift;b+=lift;
    r+=Number(s.whites||0)*.42*Math.max(0,(lum-.65)*2.7);
    g+=Number(s.whites||0)*.42*Math.max(0,(lum-.65)*2.7);
    b+=Number(s.whites||0)*.42*Math.max(0,(lum-.65)*2.7);
    r+=Number(s.blacks||0)*.4*Math.max(0,(.38-lum)*2.6);
    g+=Number(s.blacks||0)*.4*Math.max(0,(.38-lum)*2.6);
    b+=Number(s.blacks||0)*.4*Math.max(0,(.38-lum)*2.6);
    let hsl=rgbToHsl(clamp(r)/255,clamp(g)/255,clamp(b)/255);
    hsl[0]=(hsl[0]+hue+360)%360;
    hsl[1]=Math.max(0,Math.min(1,hsl[1]*(1+sat/100+hslSat/100)+vibrance/100*(1-hsl[1])));
    hsl[2]=Math.max(0,Math.min(1,hsl[2]*(1+hslLum/100)));
    [r,g,b]=hslToRgb(hsl[0],hsl[1],hsl[2]);
    if(curve&&curve.length===256){r=curve[clamp(Math.round(r),0,255)];g=curve[clamp(Math.round(g),0,255)];b=curve[clamp(Math.round(b),0,255)];}
    if(lut&&lutSize>=2&&lutMix>0){const mapped=lutSample([r/255,g/255,b/255],lut,lutSize);r=r*(1-lutMix)+mapped[0]*255*lutMix;g=g*(1-lutMix)+mapped[1]*255*lutMix;b=b*(1-lutMix)+mapped[2]*255*lutMix;}
    if(vignette>0){const nx=(x/(Math.max(1,w-1))-.5)*2,ny=(y/(Math.max(1,h-1))-.5)*2;const edge=Math.min(1,(nx*nx+ny*ny)*.62);const factor=1-vignette*.68*edge;r*=factor;g*=factor;b*=factor;}
    if(grain>0){let n=(i*1664525+1013904223)>>>0;n=(n^(n>>>16))*2246822519>>>0;n=(n^(n>>>13))*3266489917>>>0;n=(n^(n>>>16))>>>0;const noise=(n/4294967295-.5)*grain;r+=noise;g+=noise;b+=noise;}
    data[i]=clamp(Math.round(r));data[i+1]=clamp(Math.round(g));data[i+2]=clamp(Math.round(b));data[i+3]=base[i+3];
  }
  return data.buffer;
}
self.onmessage = (event) => {
  const { id, buffer, width, height, settings, lut, lutSize, curve } = event.data;
  try {
    const result=processPixels(buffer,width,height,settings,lut?new Float32Array(lut):null,lutSize,curve?new Uint8Array(curve):null);
    self.postMessage({ id, buffer:result },[result]);
  } catch(error) {
    self.postMessage({ id, error: error && error.message ? error.message : 'Không xử lý được ảnh.' });
  }
};
