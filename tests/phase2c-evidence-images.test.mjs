import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../docs/evidence/movement-dial-y-stack-phase2c/',import.meta.url);
const names=['desktop-side.png','mobile-390-side.png','annotated-side-y-datums.png','base-movement-envelope.png','hand-fitting-envelope.png','complete-display-envelope.png','y-layer-stack-diagram.png'];
const dimensions=bytes=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
test('Phase 2C evidence images are distinct decoded PNGs with required viewport dimensions',async()=>{
 const images=await Promise.all(names.map(async name=>({name,bytes:await readFile(new URL(name,root))})));
 for(const image of images){assert.deepEqual([...image.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(image.bytes.length>0)}
 assert.deepEqual(dimensions(images[0].bytes),{width:1280,height:720});assert.deepEqual(dimensions(images[1].bytes),{width:390,height:844});
 const annotated=images.slice(2).map(image=>createHash('sha256').update(image.bytes).digest('hex'));
 assert.equal(new Set(annotated).size,annotated.length);
 assert.notEqual(createHash('sha256').update(images[0].bytes).digest('hex'),createHash('sha256').update(images[1].bytes).digest('hex'));
});
