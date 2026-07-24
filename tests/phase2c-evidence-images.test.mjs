import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

const root=new URL('../docs/evidence/movement-dial-y-stack-phase2c/',import.meta.url);
const names=['desktop-side.png','mobile-390-side.png','annotated-side-y-datums.png','base-movement-envelope.png','hand-fitting-envelope.png','complete-display-envelope.png','y-layer-stack-diagram.png'];
const dimensions=bytes=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
function decodePng(bytes){
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),bitDepth=bytes[24],colorType=bytes[25],interlace=bytes[28],channels=colorType===6?4:colorType===2?3:0;
 assert.equal(bitDepth,8);assert.equal(interlace,0);assert.ok(channels);
 const idat=[];for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);if(type==='IDAT')idat.push(bytes.subarray(offset+8,offset+8+length));offset+=12+length}
 const compressed=Buffer.concat(idat),filtered=inflateSync(compressed),stride=width*channels,data=Buffer.alloc(stride*height);
 for(let y=0,source=0;y<height;y++){const filter=filtered[source++],row=y*stride,previous=row-stride;for(let x=0;x<stride;x++,source++){const left=x>=channels?data[row+x-channels]:0,up=y?data[previous+x]:0,upperLeft=y&&x>=channels?data[previous+x-channels]:0,value=filtered[source];data[row+x]=(value+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upperLeft):NaN))&255}assert.ok(filter<=4)}
 return {width,height,channels,data};
}
test('Phase 2C evidence images are distinct decoded PNGs with required viewport dimensions',async()=>{
 const images=await Promise.all(names.map(async name=>({name,bytes:await readFile(new URL(name,root))})));
 for(const image of images){assert.deepEqual([...image.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(image.bytes.length>0)}
 assert.deepEqual(dimensions(images[0].bytes),{width:1280,height:720});assert.deepEqual(dimensions(images[1].bytes),{width:390,height:844});
 const annotated=images.slice(2).map(image=>createHash('sha256').update(image.bytes).digest('hex'));
 assert.equal(new Set(annotated).size,annotated.length);
 assert.notEqual(createHash('sha256').update(images[0].bytes).digest('hex'),createHash('sha256').update(images[1].bytes).digest('hex'));
});

test('raw Phase 2C images have authentic WebGL pixel distributions and browser SHA records',async()=>{
 const [desktop,mobile,reportBytes]=await Promise.all([
  readFile(new URL('desktop-side.png',root)),
  readFile(new URL('mobile-390-side.png',root)),
  readFile(new URL('reports/image-authenticity.json',root)),
 ]);
 const report=JSON.parse(reportBytes);
 for(const [bytes,entry] of [[desktop,report.desktop],[mobile,report.mobile390]]){
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert.equal(entry.source,'actual Three.js scene rendered to offscreen WebGLRenderTarget');
  assert.ok(entry.uniqueRgbCount>256);assert.ok(entry.dominantColorRatio<.96);assert.ok(entry.nonBackgroundPixelRatio>.02);assert.ok(entry.luminanceVariance>8);assert.equal(entry.authentic,true);
 }
 assert.equal(report.checks.rawImagesCreatedByGenerator,false);
 assert.equal(report.checks.annotatedImagesUseDesktopRuntimeBackground,true);
});

test('annotation generator reads raw captures and preserves most desktop runtime pixels',async()=>{
 const [generator,desktopBytes,...overlayBytes]=await Promise.all([
  readFile(new URL('./generate-phase2c-images.py',import.meta.url),'utf8'),
  readFile(new URL('desktop-side.png',root)),
  ...names.slice(2,6).map(name=>readFile(new URL(name,root))),
 ]);
 assert.match(generator,/load_runtime_png\(DESKTOP_PATH, \(1280, 720\)\)\.copy\(\)/);
 assert.match(generator,/pixel_metrics\(MOBILE_PATH, \(390, 844\)\)/);
 assert.doesNotMatch(generator,/desktop-side\.png["']\)\.save|mobile-390-side\.png["']\)\.save/);
 const desktop=decodePng(desktopBytes);
 for(const bytes of overlayBytes){
  const overlay=decodePng(bytes);assert.equal(overlay.width,desktop.width);assert.equal(overlay.height,desktop.height);
  let shared=0;for(let pixel=0;pixel<desktop.width*desktop.height;pixel++){const a=pixel*desktop.channels,b=pixel*overlay.channels;if(desktop.data[a]===overlay.data[b]&&desktop.data[a+1]===overlay.data[b+1]&&desktop.data[a+2]===overlay.data[b+2])shared++}
  assert.ok(shared/(desktop.width*desktop.height)>.5);
 }
});

test('Phase 2C evidence manifest is a closed-world byte and SHA inventory',async()=>{
 const manifest=JSON.parse(await readFile(new URL('evidence-manifest.json',root),'utf8'));
 const walk=async directory=>{const entries=await readdir(directory,{withFileTypes:true});const paths=[];for(const entry of entries){const url=new URL(entry.name+(entry.isDirectory()?'/':''),directory);if(entry.isDirectory())paths.push(...await walk(url));else if(entry.name!=='evidence-manifest.json')paths.push(url)}return paths};
 const files=await walk(root),actual=files.map(url=>decodeURIComponent(url.pathname.split('/movement-dial-y-stack-phase2c/')[1])).sort(),listed=manifest.files.map(entry=>entry.path).sort();
 assert.deepEqual(listed,actual);assert.deepEqual(manifest.missing,[]);assert.deepEqual(manifest.unexpected,[]);assert.deepEqual(manifest.shaMismatch,[]);
 for(const entry of manifest.files){const url=new URL(entry.path,root),bytes=await readFile(url);assert.equal((await stat(url)).size,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256)}
});
