import test from 'node:test';
import assert from 'node:assert/strict';
import {stopCloud,codespaceFromRelay} from '../cloud-control.mjs';
test('stop targets only the configured relay and calls the GitHub stop API',async()=>{
 let called;const result=await stopCloud({relay:'https://my-space-8787.app.github.dev',token:'test-only',fetchImpl:async(url,options)=>{called={url,options};return {ok:true};}});
 assert.equal(called.url,'https://api.github.com/user/codespaces/my-space/stop');assert.equal(called.options.method,'POST');assert.equal(result.accepted,true);assert.ok(!JSON.stringify(result).includes('test-only'));
 assert.throws(()=>codespaceFromRelay('https://evil.example/my-space-8787.app.github.dev'));
 await assert.rejects(stopCloud({relay:'https://my-space-8787.app.github.dev',token:'test-only',fetchImpl:async()=>({ok:false,status:403})}),/403/);
});
