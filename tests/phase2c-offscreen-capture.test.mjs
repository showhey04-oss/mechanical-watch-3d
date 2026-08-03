import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const indexSource=await readFile(new URL('../index.html',import.meta.url),'utf8');
const harnessSource=await readFile(new URL('./y-stack-audit-capture.js',import.meta.url),'utf8');
const desktopSource=await readFile(new URL('./y-stack-audit-capture-desktop.html',import.meta.url),'utf8');
const mobileSource=await readFile(new URL('./y-stack-audit-capture-mobile.html',import.meta.url),'utf8');
const captureSource=indexSource.slice(indexSource.indexOf('async function captureAuditViewportPng'),indexSource.indexOf('function dimensionObjectTransform'));

test('Phase 2C capture renders to an explicit offscreen WebGL target',()=>{
 assert.match(indexSource,/captureAuditViewportPng\(\{width,height,cameraPreset='side'\}=\{\}\)/);
 assert.match(indexSource,/new THREE\.WebGLRenderTarget\(targetWidth,targetHeight/);
 assert.match(indexSource,/renderer\.readRenderTargetPixels\(auditTarget,0,0,targetWidth,targetHeight,pixels\)/);
 assert.match(indexSource,/actual Three\.js scene rendered to offscreen WebGLRenderTarget/);
 assert.doesNotMatch(indexSource,/captureAuditCanvasPng/);
});

test('Phase 2C capture restores renderer state and never mutates the live camera, controls, model, or mechanism',()=>{
 for(const token of ['previousTarget','previousViewport','previousScissor','previousScissorTest','captureCamera','controlsTarget','renderTarget','desiredZoomDistance','transformSignature','modelWorldSignature','mechanismState'])assert.match(indexSource,new RegExp(token));
 assert.match(indexSource,/finally\{/);
 assert.match(indexSource,/renderer\.setRenderTarget\(previousTarget\)/);
 assert.match(captureSource,/captureCamera=camera\.clone\(\)/);
 assert.match(captureSource,/renderer\.render\(scene,captureCamera\)/);
 assert.doesNotMatch(captureSource,/camera\.position\.copy\(position\)/);
 assert.match(indexSource,/stateInvariant=\{\.\.\.checks,all:Object\.values\(checks\)\.every\(Boolean\)\}/);
});

test('Phase 2C capture vertically flips pixels and encodes a temporary 2D PNG',()=>{
 assert.match(indexSource,/targetHeight-1-y/);
 assert.match(indexSource,/new ImageData\(flipped,targetWidth,targetHeight\)/);
 assert.match(indexSource,/canvas\.toBlob\(/);
 assert.doesNotMatch(captureSource,/renderer\.setSize\(/);
 assert.doesNotMatch(captureSource,/renderer\.setPixelRatio\(/);
});

test('dedicated harnesses request formal target dimensions without live-canvas resampling',()=>{
 assert.match(desktopSource,/width:1280,height:720/);
 assert.match(mobileSource,/width:390,height:844/);
 assert.match(harnessSource,/captureAuditViewportPng\(\{width,height,cameraPreset:'side'\}\)/);
 assert.match(harnessSource,/TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION/);
 assert.match(harnessSource,/liveCanvasResamplingAdopted:false/);
 assert.doesNotMatch(harnessSource,/drawImage\(/);
 assert.doesNotMatch(harnessSource,/canvas\.width=width/);
});

test('capture metadata stays small while PNG bytes are exposed as individual 24KB chunks',()=>{
 assert.match(harnessSource,/const CHUNK_BYTES=24_000/);
 assert.match(harnessSource,/publishChunk\(chunks,captureId,chunkCount\+\+,offset/);
 assert.match(harnessSource,/window\.phase2cCaptureMetadata=metadata/);
 assert.doesNotMatch(harnessSource,/pngBase64/);
});
