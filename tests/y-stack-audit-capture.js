const CHUNK_BYTES=24_000;
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const sha256Hex=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
const bytesToBase64=bytes=>{
 let binary='';
 for(let offset=0;offset<bytes.length;offset+=0x8000)binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
 return btoa(binary);
};

function publishChunk(root,captureId,index,byteStart,bytes){
 const node=document.createElement('script');
 node.type='application/octet-stream';
 node.dataset.capture=captureId;
 node.dataset.index=String(index);
 node.dataset.byteStart=String(byteStart);
 node.dataset.byteLength=String(bytes.byteLength);
 node.textContent=bytesToBase64(bytes);
 root.append(node);
}

async function waitForDiagnostics(frame){
 await new Promise((resolve,reject)=>{
  frame.addEventListener('load',resolve,{once:true});
  frame.addEventListener('error',()=>reject(new Error('iframe load failed')),{once:true});
 });
 const deadline=performance.now()+20_000;
 while(performance.now()<deadline){
  if(frame.contentDocument?.readyState==='complete'&&frame.contentWindow?.watchModelDiagnostics)return frame.contentWindow.watchModelDiagnostics;
  await sleep(50);
 }
 throw new Error('same-origin iframe diagnostics registration timed out');
}

export async function runCapture({captureId,width,height,readyKey}){
 const frame=document.getElementById('auditApp'),output=document.getElementById('captureResult'),log=document.getElementById('captureLog'),chunks=document.getElementById('phase2cCaptureChunks');
 const fail=error=>{
  const message=error?.stack||error?.message||String(error);
  document.body.dataset.auditStatus='failed';
  document.body.dataset.captureStage='failed';
  document.body.dataset.captureError=message;
  output.textContent=JSON.stringify({ok:false,error:message},null,2);
  log.textContent=message;
 };
 try{
  document.body.dataset.auditStatus='running';
  document.body.dataset.captureStage='waiting-for-iframe';
  document.body.dataset.captureError='';
  document.body.dataset[readyKey]='false';
  frame.src=`../index.html?dimensionAudit=1&theme=navy&camera=side&time=10%3A10%3A30&paused=1&opacity=1&panel=collapsed&capture=${encodeURIComponent(captureId)}`;
  const diagnostics=await waitForDiagnostics(frame);
  await diagnostics.waitForFrames(8);
  const sourceCanvas=frame.contentDocument.querySelector('canvas');
  if(!sourceCanvas)throw new Error('runtime WebGL canvas not found');
  const sourceRect=sourceCanvas.getBoundingClientRect(),liveCanvasMetadata={
   frameInnerWidth:frame.contentWindow.innerWidth,
   frameInnerHeight:frame.contentWindow.innerHeight,
   canvasClientWidth:sourceRect.width,
   canvasClientHeight:sourceRect.height,
   canvasDrawingBufferWidth:sourceCanvas.width,
   canvasDrawingBufferHeight:sourceCanvas.height,
   liveAspect:sourceCanvas.width/sourceCanvas.height,
  };
  document.body.dataset.captureStage='rendering-offscreen';
  const capture=await diagnostics.captureAuditViewportPng({width,height,cameraPreset:'side'});
  if(!capture?.blob||capture.blob.type!=='image/png')throw new Error('capture API did not return a PNG Blob');
  const bytes=new Uint8Array(await capture.blob.arrayBuffer());
  if(bytes.length<8||!bytes.subarray(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index]))throw new Error('capture PNG signature mismatch');
  const pngSha256=await sha256Hex(bytes);
  document.body.dataset.captureStage='publishing-chunks';
  chunks.replaceChildren();
  let chunkCount=0;
  for(let offset=0;offset<bytes.length;offset+=CHUNK_BYTES)publishChunk(chunks,captureId,chunkCount++,offset,bytes.subarray(offset,Math.min(offset+CHUNK_BYTES,bytes.length)));
  const evidenceAspect=width/height,environmentLimitation={
   classification:'TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION',
   productDefect:false,
   liveCanvasResamplingAdopted:false,
   requestedIframeViewport:{width,height},
   observedLiveDrawingBuffer:{width:liveCanvasMetadata.canvasDrawingBufferWidth,height:liveCanvasMetadata.canvasDrawingBufferHeight},
   liveAspect:liveCanvasMetadata.liveAspect,
   evidenceAspect,
  };
  const metadata={
   captureId,
   source:capture.metadata.source,
   cameraPreset:capture.metadata.cameraPreset,
   renderTargetWidth:capture.metadata.renderTargetWidth,
   renderTargetHeight:capture.metadata.renderTargetHeight,
   mimeType:capture.blob.type,
   pngByteLength:bytes.byteLength,
   pngSha256,
   chunkBytes:CHUNK_BYTES,
   chunkCount,
   stateInvariant:capture.metadata.stateInvariant,
   liveCanvasMetadata,
   environmentLimitation,
   parentUrl:location.href,
   iframeUrl:frame.contentWindow.location.href,
   parentOrigin:location.origin,
   iframeOrigin:frame.contentWindow.location.origin,
   iframeReadyState:frame.contentDocument.readyState,
  };
  output.textContent=JSON.stringify({ok:true,metadata},null,2);
  output.dataset.status='passed';
  log.textContent=JSON.stringify({captureId,pngByteLength:bytes.byteLength,pngSha256,chunkCount,stateInvariant:metadata.stateInvariant,environmentLimitation},null,2);
  document.body.dataset[readyKey]='true';
  document.body.dataset.captureStage='complete';
  document.body.dataset.auditStatus='passed';
  window.phase2cCaptureMetadata=metadata;
  return metadata;
 }catch(error){
  fail(error);
  return null;
 }
}
