import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('Phase 2C Y-stack harness owns same-origin diagnostic serialization without sandboxing the iframe',async()=>{
 const [html,script]=await Promise.all([
  readFile(new URL('./y-stack-audit-harness.html',import.meta.url),'utf8'),
  readFile(new URL('./y-stack-audit-harness.js',import.meta.url),'utf8'),
 ]);
 assert.match(html,/id="phase2cStatus"/);
 assert.match(html,/id="phase2cSummary"/);
 assert.match(html,/id="phase2cAuditResult"/);
 assert.match(html,/<iframe id="auditApp"[^>]*>/);
 assert.doesNotMatch(html,/<iframe[^>]*sandbox/);
 assert.match(script,/frame\.contentDocument\?\.readyState==='complete'/);
 assert.match(script,/frame\.contentWindow\?\.watchModelDiagnostics/);
 assert.match(script,/getYDatumMap\(\)/);
 assert.match(script,/getYEnvelopeBreakdown\(\)/);
 assert.match(script,/getYLayerStack\(\)/);
 assert.match(script,/getOfficialHeightDatumAssessment\(\)/);
 assert.match(script,/document\.body\.dataset\.auditReady/);
 assert.match(script,/document\.body\.dataset\.auditStatus/);
 assert.match(script,/innerWidth:frame\.contentWindow\.innerWidth/);
 assert.match(script,/innerHeight:frame\.contentWindow\.innerHeight/);
});
