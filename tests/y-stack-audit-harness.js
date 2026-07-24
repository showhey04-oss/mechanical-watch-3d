const frame=document.getElementById('auditApp');
const status=document.getElementById('phase2cStatus');
const summary=document.getElementById('phase2cSummary');
const output=document.getElementById('phase2cAuditResult');
const downloads=document.getElementById('downloads');
const appBaseQuery='dimensionAudit=1&theme=navy&camera=side&time=10%3A10%3A30&paused=1&opacity=1&panel=collapsed&cache=phase2c-y-stack';
const viewports={desktop:{width:1280,height:720},mobile390:{width:390,height:844}};
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const json=value=>JSON.stringify(value,null,2);

function setStatus(value,ready=false){
 status.value=value;status.textContent=value;
 document.body.dataset.auditReady=String(ready);
 document.body.dataset.auditStatus=value;
}
function frameFacts(){
 const documentInFrame=frame.contentDocument;
 const href=frame.contentWindow?.location?.href||null;
 return {
  parentHref:location.href,parentOrigin:location.origin,iframeHref:href,
  iframeOrigin:href?new URL(href).origin:null,readyState:documentInFrame?.readyState||null,
  canvasCount:documentInFrame?.querySelectorAll('canvas').length||0,
  scripts:[...(documentInFrame?.scripts||[])].map(script=>script.src||'[inline]'),
  apiRegistered:Boolean(frame.contentWindow?.watchModelDiagnostics),
  dimensionAuditStatus:documentInFrame?.body?.dataset.dimensionAuditStatus||null,
 };
}
function diagnosticError(message,cause){
 const error=new Error(message);
 error.phase2cFacts={...frameFacts(),cause:cause?.stack||cause?.message||String(cause||'')};
 return error;
}
async function waitForFrameLoad(){
 await new Promise((resolve,reject)=>{
  frame.addEventListener('load',resolve,{once:true});
  frame.addEventListener('error',()=>reject(diagnosticError('iframe load failed')),{once:true});
 });
 const deadline=performance.now()+15000;
 while(performance.now()<deadline){
  if(frame.contentDocument?.readyState==='complete')return;
  await sleep(50);
 }
 throw diagnosticError('iframe document.readyState did not reach complete');
}
async function getDiagnostics(){
 const deadline=performance.now()+15000;
 while(performance.now()<deadline){
  if(frame.contentDocument?.readyState==='complete'){
   const diagnostics=frame.contentWindow?.watchModelDiagnostics;
   if(diagnostics)return diagnostics;
  }
  await sleep(50);
 }
 throw diagnosticError('watchModelDiagnostics was not registered in same-origin iframe');
}
function dimensionSignature(diagnostics){
 const report=diagnostics.getDimensionDiagnostics({includeScreenSpace:false});
 return report.transformInvariant;
}
function buildResult(viewport,diagnostics){
 const before=dimensionSignature(diagnostics);
 const datumMap=diagnostics.getYDatumMap();
 const envelopes=diagnostics.getYEnvelopeBreakdown();
 const layerStack=diagnostics.getYLayerStack();
 const officialHeightDatumAssessment=diagnostics.getOfficialHeightDatumAssessment();
 const after=dimensionSignature(diagnostics);
 const diagnosticsReport=diagnostics.getDimensionDiagnostics({includeScreenSpace:true});
 return {
  schemaVersion:1,kind:'phase2c-y-stack-runtime-measurement',measuredAt:new Date().toISOString(),
  viewport:{...viewport,innerWidth:frame.contentWindow.innerWidth,innerHeight:frame.contentWindow.innerHeight,devicePixelRatio:frame.contentWindow.devicePixelRatio},
  iframe:frameFacts(),datumMap,envelopes,layerStack,officialHeightDatumAssessment,
  transformInvariant:{unchanged:JSON.stringify(before)===JSON.stringify(after),before,after},
  diagnosticTransformInvariant:diagnosticsReport.transformInvariant,
  interference:diagnosticsReport.mechanismChecks.interference,
  screenSpace:diagnosticsReport.screenSpace,
 };
}
function createDownload(label,name,value){
 const link=document.createElement('a');
 link.href=URL.createObjectURL(new Blob([json(value)],{type:'application/json'}));
 link.download=name;link.textContent=label;downloads.append(link);
}
function render(result){
 output.textContent=json(result);output.dataset.status=result.ok?'passed':'failed';
 output.value=output.textContent;
 summary.textContent=json(result.ok?{viewport:result.value.viewport,iframe:result.value.iframe,envelopes:result.value.envelopes,transformInvariant:result.value.transformInvariant,interference:result.value.interference}:{error:result.error,facts:result.facts});
 downloads.replaceChildren();
 if(result.ok)createDownload('runtime result JSON','phase2c-runtime-result.json',result.value);
 setStatus(result.ok?'passed':'failed',true);
}
async function runViewport(name){
 const viewport=viewports[name];
 if(!viewport)throw new Error(`Unknown viewport: ${name}`);
 setStatus('running',false);downloads.replaceChildren();
 frame.width=viewport.width;frame.height=viewport.height;
 frame.style.width=`${viewport.width}px`;frame.style.height=`${viewport.height}px`;
 frame.src=`../index.html?${appBaseQuery}&run=${encodeURIComponent(String(Date.now()))}`;
 try{
  await waitForFrameLoad();
  const diagnostics=await getDiagnostics();
  const value=buildResult(viewport,diagnostics);
  const result={ok:value.transformInvariant.unchanged&&value.diagnosticTransformInvariant.unchanged&&value.interference.forbiddenCount===0,value};
  render(result);return result;
 }catch(error){
  const result={ok:false,error:error.stack||error.message||String(error),facts:error.phase2cFacts||frameFacts()};
  render(result);return result;
 }
}
function comparisonSummary(desktop,mobile){
 const compare=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
 return {
  schemaVersion:1,kind:'phase2c-y-stack-viewport-comparison',measuredAt:new Date().toISOString(),
  desktop,mobile,
  worldValuesMatch:{datumMap:compare(desktop.datumMap,mobile.datumMap),envelopes:compare(desktop.envelopes,mobile.envelopes),layerStack:compare(desktop.layerStack,mobile.layerStack),officialHeightDatumAssessment:compare(desktop.officialHeightDatumAssessment,mobile.officialHeightDatumAssessment),transformInvariant:desktop.transformInvariant.unchanged&&mobile.transformInvariant.unchanged},
  viewportDependentValuesChanged:JSON.stringify(desktop.screenSpace)!==JSON.stringify(mobile.screenSpace),
 };
}
async function runComparison(){
 const desktop=await runViewport('desktop');if(!desktop.ok)return desktop;
 const mobile=await runViewport('mobile390');if(!mobile.ok)return mobile;
 const value=comparisonSummary(desktop.value,mobile.value);
 const result={ok:Object.values(value.worldValuesMatch).every(Boolean)&&value.viewportDependentValuesChanged,value};
 render(result);if(result.ok)createDownload('desktop/mobile comparison JSON','phase2c-viewport-comparison.json',value);return result;
}
document.getElementById('runDesktop').addEventListener('click',()=>runViewport('desktop'));
document.getElementById('runMobile').addEventListener('click',()=>runViewport('mobile390'));
document.getElementById('runComparison').addEventListener('click',()=>runComparison());
window.phase2cYStackAuditHarness={runViewport,runComparison,frameFacts};
setStatus('idle',false);
