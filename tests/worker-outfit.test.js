import test from 'node:test';
import assert from 'node:assert/strict';
import {validStructuredInput,validStructuredOutput} from '../worker/src/index.js';
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
