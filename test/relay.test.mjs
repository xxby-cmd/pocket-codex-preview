import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelay} from '../relay.mjs';
test('relay isolates host and phone credentials and forwards a correlated response',async t=>{
const browserToken='b'.repeat(32),hostToken='h'.repeat(32);const s=createRelay({browserToken,hostToken});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());const base=`http://127.0.0.1:${s.address().port}`;
const req=(route,token,data)=>fetch(base+route,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
assert.equal((await req('/host/poll',browserToken)).status,401);
assert.equal((await req('/api/status',hostToken)).status,401);
assert.equal((await req('/api/request',browserToken,{op:'read'})).status,503);
await req('/host/poll',hostToken);
assert.equal((await req('/api/request',browserToken,{op:'exec',args:{command:'invalid'}})).status,400);
const result=req('/api/request',browserToken,{op:'list'});
let jobs=[];for(let i=0;i<30&&!jobs.length;i++){await new Promise(r=>setTimeout(r,10));jobs=(await(await req('/host/poll',hostToken)).json()).jobs}
assert.equal(jobs.length,1);assert.equal(jobs[0].op,'list');assert.equal((await(await req('/host/poll',hostToken)).json()).jobs.length,0);
await req('/host/result',hostToken,{id:jobs[0].id,result:{threads:[]}});assert.deepEqual(await(await result).json(),{result:{threads:[]}});
assert.equal((await fetch(base+'/.env')).status,404);
});
test('browser cookies authenticate HTTP APIs without exposing a bearer key',async t=>{
 const s=createRelay({browserToken:'b'.repeat(32),hostToken:'h'.repeat(32)});await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>s.close());const base=`http://127.0.0.1:${s.address().port}`;
 const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Pocket-Client':'browser'},body:JSON.stringify({password:'b'.repeat(32),remember:true})});assert.equal(login.status,200);
 const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.match(cookie,/__Host-pocket-device=/);const headers={Cookie:cookie,'X-Pocket-Client':'browser'};
 assert.equal((await fetch(base+'/api/status',{headers})).status,200);
 assert.equal((await fetch(base+'/api/status',{headers:{Cookie:cookie}})).status,401);
 assert.equal((await fetch(base+'/host/poll',{headers})).status,401);
 const csrf=await fetch(base+'/auth/password',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({currentPassword:'b'.repeat(32),newPassword:'malicious-password-123'})});assert.equal(csrf.status,403);
});
