import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../launcher/app.js',import.meta.url),'utf8');
function fixture(search=''){
 const nodes=new Map(), calls=[], storage=new Map([['pocketGithubToken','test-token'],['pocketAutoStart','1']]);let navigated='';
 const context={document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,{checked:false,value:'',disabled:false});return nodes.get(id)}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{search,pathname:'/',replace:url=>navigated=url,assign:url=>navigated=url},history:{replaceState(){}},URLSearchParams,AbortSignal,setTimeout:fn=>setTimeout(fn,0),fetch:async(url,options)=>{calls.push([url,options.method]);return {ok:true,status:200,json:async()=>url.endsWith('/ready')?{ready:true}:url.endsWith('/start')?{}:{codespaces:[{name:'glorious-waffle-x5jj6wwv7v7xc6xv4',state:'Shutdown'}]}}}};
 vm.runInNewContext(source,context);return {calls,nodes,get navigated(){return navigated}};
}
test('saved automatic authorization starts then waits for relay readiness before navigation',async()=>{const f=fixture();await new Promise(r=>setTimeout(r,20));assert(f.calls.some(([url,method])=>url.endsWith('/start')&&method==='POST'));assert(f.calls.some(([url])=>url.endsWith('/ready')));assert(f.navigated.endsWith('.app.github.dev/'));});
test('returning after stop does not automatically restart the cloud',async()=>{const f=fixture('?stopped=1');await new Promise(r=>setTimeout(r,20));assert(!f.calls.some(([,method])=>method==='POST'));assert.equal(f.navigated,'');});

test('manual repair stops before starting and waits for readiness',async()=>{const f=fixture('?stopped=1');await f.nodes.get('repair').onclick();const mutations=f.calls.filter(([,method])=>method==='POST').map(([url])=>url.split('/').pop());assert.deepEqual(mutations,['stop','start']);assert(f.navigated.endsWith('.app.github.dev/'));});
