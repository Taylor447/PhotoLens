import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {validStructuredInput,validStructuredOutput} from '../worker/src/index.js';
const candidates=[{id:'g-1',category:'tops',color:'#112233',style:'minimal',pattern:'solid',material:'cotton',season:'all'},{id:'g-2',category:'bottoms',color:'#eeeeee',style:'minimal',pattern:'solid',material:'linen',season:'summer'}];
const body={genre:'portrait',backgroundColor:'#56736f',temperatureC:20,precipitationMm:0,windKmh:8,candidates};
test('outfit compose validates unique candidate IDs and field shapes',()=>{
 assert.equal(validStructuredInput('/outfit/compose',body),true);assert.equal(validStructuredInput('/outfit/compose',{...body,candidates:[...candidates,candidates[0]]}),false);
 assert.equal(validStructuredInput('/outfit/compose',{...body,candidates:[{...candidates[0],color:'unknown'}]}),false);
});
test('outfit compose accepts only unique IDs in the candidates list',()=>{
 assert.equal(validStructuredOutput('/outfit/compose',{itemIds:['g-1','g-2'],reason:'Màu có độ tương phản.'},body),true);
 assert.equal(validStructuredOutput('/outfit/compose',{itemIds:['outside'],reason:'Tự tạo món.'},body),false);
 assert.equal(validStructuredOutput('/outfit/compose',{itemIds:['g-1','g-1'],reason:'Trùng.'},body),false);
});

test('outfit compose rejects private data and unknown properties at either level',()=>{
 assert.equal(validStructuredInput('/outfit/compose',{...body,measurements:{waist:50}}),false);
 assert.equal(validStructuredInput('/outfit/compose',{...body,candidates:[{...candidates[0],photo:'bytes'}]}),false);
 assert.equal(validStructuredInput('/outfit/compose',{...body,candidates:[{...candidates[0],category:'unknown'}]}),false);
 assert.equal(validStructuredInput('/outfit/compose',{...body,windKmh:-1}),false);
});

test('HTTP Worker retries invalid model JSON at most twice and forwards only validated facts',async t=>{
 let calls=[];
 t.mock.method(globalThis,'fetch',async (_url,opts)=>{
  calls.push(JSON.parse(opts.body));
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({itemIds:['external'],reason:'Outside inventory'})}]}}]});
 });
 const endpoint='https://worker.example/outfit/compose',origin='https://allowed.example';
 const env={ALLOWED_ORIGINS:origin,GEMINI_MODEL:'test-model',GEMINI_API_KEY:'test-only',PHOTO_AI_LIMITER:{limit:async()=>({success:true})}};
 const send=payload=>worker.fetch(new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}),env);
 assert.equal((await send({...body,image:'secret'})).status,400);
 assert.equal(calls.length,0);
 assert.equal((await send(body)).status,502);
 assert.equal(calls.length,3);
 for(const entry of calls){
  const actual=JSON.parse(entry.contents[0].parts[0].text.split('payload facts: ')[1]);
  assert.deepEqual(actual,body);
 }
});
