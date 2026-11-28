export const MEASURE_KEYS=['shoulders','chest','waist','hips','sleeve','inseam','neck'];
const ALIASES={
 shoulders:['shoulders','shoulderWidthCm','shoulderCm','shoulderWidth'],
 chest:['chest','chestCircumferenceCm','chestCm','chestCircumference'],
 waist:['waist','waistCircumferenceCm','waistCm','waistCircumference'],
 hips:['hips','hipCircumferenceCm','hipCm','hipCircumference'],
 sleeve:['sleeve','sleeveLengthCm','armLengthCm','sleeveLength'],
 inseam:['inseam','inseamLengthCm','legLengthCm','inseamLength'],
 neck:['neck','neckCircumferenceCm','neckCm','neckCircumference']
};
export const MEASURE_LABELS={shoulders:'Vai',chest:'Ngực',waist:'Eo',hips:'Hông',sleeve:'Dài tay',inseam:'Ống trong',neck:'Vòng cổ'};
const cm=value=>{const n=typeof value==='number'||typeof value==='string'&&value.trim()?Number(value):NaN;return Number.isFinite(n)&&n>0&&n<=300?n:null;};
export function normalizeMeasures(value){
 if(!value||typeof value!=='object')return null;const out={};
 for(const [key,aliases] of Object.entries(ALIASES)){for(const name of aliases){const n=cm(value[name]);if(n!==null){out[key]=n;break;}}}
 return Object.keys(out).length?out:null;
}
export function normalizeSizeTable(table){
 if(!Array.isArray(table))return [];
 return table.slice(0,32).map(row=>({size:String(row?.size||'').trim().slice(0,32),measurementsCm:normalizeMeasures(row?.measurementsCm),measurementSource:String(row?.measurementSource||'').trim().slice(0,200)})).filter(row=>row.size&&row.measurementsCm);
}
export function calculateFit(body={},garment={}){
 const b=normalizeMeasures(body),g=normalizeMeasures(garment?.measurementsCm);
 if(!b||!g)return{available:false,details:[],message:'Chưa có đủ số đo do người dùng tự nhập và số đo trang phục.'};
 const details=MEASURE_KEYS.filter(key=>b[key]!=null&&g[key]!=null).map(key=>{
  const easeCm=Number((g[key]-b[key]).toFixed(1));
  return {key,label:MEASURE_LABELS[key],bodyCm:b[key],garmentCm:g[key],easeCm,status:easeCm<0?'tight':easeCm>0?'loose':'equal'};
 });
 return{available:Boolean(details.length),details,message:details.length?'Chênh lệch cm giữa các mốc cùng tên; không bảo đảm độ vừa khi mặc thực tế.':'Chưa có dữ liệu đo tương ứng.'};
}
export function chooseSize(body={},table=[]){
 const b=normalizeMeasures(body);if(!b)return{size:null,scoreCm:null,details:[],reason:'Chưa có số đo cơ thể do người dùng tự nhập.'};
 const rows=normalizeSizeTable(table).map(row=>{const fit=calculateFit(b,row);return{...row,fit,matched:fit.details.length,scoreCm:fit.details.reduce((sum,x)=>sum+Math.abs(x.easeCm),0)};}).filter(row=>row.matched>0);
 rows.sort((a,b)=>b.matched-a.matched||a.scoreCm-b.scoreCm||a.size.localeCompare(b.size,'vi'));
 const best=rows[0];if(!best)return{size:null,scoreCm:null,details:[],reason:'Chưa có bảng size hoặc số đo tương ứng.'};
 return{size:best.size,scoreCm:Number(best.scoreCm.toFixed(1)),details:best.fit.details,reason:'Ước tính số học từ '+best.matched+' mốc có cùng tên; kiểm tra số đo sản phẩm và thử thực tế.'};
}

export function parseSizeRows(input, source){
 const lines=String(input||'').trim().split(/\r?\n/).filter(line=>line.trim());
 if(!lines.length)return [];
 const measurementSource=String(source||'').trim().slice(0,200);
 if(!measurementSource)throw new Error('Ghi nguồn số đo trước khi lưu bảng size.');
 if(lines.length>32)throw new Error('Bảng size giới hạn 32 dòng.');
 const seen=new Set();
 return lines.map((line,index)=>{
  const [rawSize,...values]=line.split(';').map(x=>x.trim());
  const size=rawSize.slice(0,32);
  const measurementsCm={};
  if(!size||seen.has(size.toLowerCase())||values.length>MEASURE_KEYS.length)throw new Error('Kiểm tra tên hoặc số cột của size ở dòng '+(index+1)+'.');
  seen.add(size.toLowerCase());
  for(const [i,value] of values.entries()){
   if(!value)continue;
   const number=cm(value.replace(',','.'));
   if(number===null)throw new Error('Số đo ở dòng '+(index+1)+' phải lớn hơn 0 và không quá 300 cm.');
   measurementsCm[MEASURE_KEYS[i]]=number;
  }
  if(!Object.keys(measurementsCm).length)throw new Error('Dòng '+(index+1)+' cần ít nhất một số đo.');
  return {size,measurementsCm,measurementSource};
 });
}
