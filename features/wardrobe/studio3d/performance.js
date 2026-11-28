export function createRenderSampler({startedAt=0,sampleWindowMs=1000,idleAfterMs=1000,minFrames=5}={}){
 let windowStartedAt=null,windowFrames=0,lastFrameAt=null,fps=null,firstFrameMs=null;
 return {
  recordFrame(timestamp){
   const time=Number(timestamp);
   if(!Number.isFinite(time))return;
   if(firstFrameMs===null)firstFrameMs=Math.max(0,time-startedAt);
   if(windowStartedAt===null)windowStartedAt=time;
   windowFrames++;
   lastFrameAt=time;
   const elapsed=time-windowStartedAt;
   if(elapsed>=sampleWindowMs){
    fps=windowFrames>=minFrames?windowFrames*1000/elapsed:null;
    windowStartedAt=time;
    windowFrames=0;
   }
  },
  snapshot(now){
   const time=Number(now);
   const active=lastFrameAt!==null&&Number.isFinite(time)&&time-lastFrameAt<=idleAfterMs;
   return {active,fps:active?fps:null,firstFrameMs};
  }
 };
}
