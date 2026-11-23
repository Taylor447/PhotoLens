import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(root,'android','app','src','main','AndroidManifest.xml');
if(!fs.existsSync(manifestPath)){console.error('Android project not found. Run npx cap add android first.');process.exit(1);}
let manifest=fs.readFileSync(manifestPath,'utf8');
if(!manifest.includes('android.permission.CAMERA')) manifest=manifest.replace(/<manifest\b[^>]*>/,match=>`${match}\n    <uses-permission android:name="android.permission.CAMERA" />`);
if(!manifest.includes('android.hardware.camera')) manifest=manifest.replace(/<manifest\b[^>]*>/,match=>`${match}\n    <uses-feature android:name="android.hardware.camera" android:required="false" />`);
fs.writeFileSync(manifestPath,manifest,'utf8');
const res=path.join(root,'android','app','src','main','res');
const icon=path.join(root,'assets','icon.png');
for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
  const dir=path.join(res,`mipmap-${density}`);fs.mkdirSync(dir,{recursive:true});
  fs.copyFileSync(icon,path.join(dir,'ic_launcher.png'));fs.copyFileSync(icon,path.join(dir,'ic_launcher_round.png'));
  if(density==='xxxhdpi') fs.copyFileSync(icon,path.join(dir,'ic_launcher_foreground.png'));
}
const drawable=path.join(res,'drawable-nodpi');fs.mkdirSync(drawable,{recursive:true});fs.copyFileSync(path.join(root,'assets','splash.png'),path.join(drawable,'splash.png'));
const values=path.join(res,'values');fs.mkdirSync(values,{recursive:true});fs.writeFileSync(path.join(values,'photolens_colors.xml'),'<resources><color name="photolens_icon_background">#0d1720</color></resources>\n','utf8');
const adaptiveDir=path.join(res,'mipmap-anydpi-v26');fs.mkdirSync(adaptiveDir,{recursive:true});
const adaptive=`<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/photolens_icon_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>\n`;
fs.writeFileSync(path.join(adaptiveDir,'ic_launcher.xml'),adaptive,'utf8');fs.writeFileSync(path.join(adaptiveDir,'ic_launcher_round.xml'),adaptive,'utf8');
console.log('Android permissions, icon and splash resources prepared.');
