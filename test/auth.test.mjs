import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createAuth} from '../auth.mjs';
const initial='b'.repeat(32),newPassword='my-new-long-password-2026';
function client(auth){const jar={};const req=()=>({method:'POST',headers:{'x-pocket-client':'browser','content-type':'application/json',cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ')}});return {jar,req,call(route,data={}){const headers={};const result=auth.handle(req(),{getHeader:k=>headers[k],setHeader:(k,v)=>headers[k]=v},route,data);for(const c of headers['Set-Cookie']||[]){assert.match(c,/Secure; HttpOnly; SameSite=Strict/);const [name,value]=c.split(';')[0].split('=');if(value)jar[name]=value;else delete jar[name]}return result},ok:()=>auth.authorize(req())}}
test('idle timeout ignores polling; trusted browser restores, forgotten browser cannot',()=>{
 let time=1000;const a=createAuth({browserToken:initial,now:()=>time});const c=client(a);
 c.call('/auth/login',{password:initial,remember:true});assert.equal(c.ok(),true);
 time+=299999;assert.equal(c.ok(),true);time+=1;assert.equal(c.ok(),false);
 c.call('/auth/restore');assert.equal(c.ok(),true);time+=250000;c.call('/auth/activity');time+=100000;assert.equal(c.ok(),true);
 c.call('/auth/logout');assert.equal(c.ok(),false);assert.throws(()=>c.call('/auth/restore'),/重新输入/);
 const d=client(a);d.call('/auth/login',{password:initial,remember:false});time+=300000;assert.equal(d.ok(),false);assert.throws(()=>d.call('/auth/restore'),/重新输入/);
});
test('rotation persists across restarts and revokes other sessions and trusted devices',t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'pocket-auth-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const storePath=path.join(dir,'auth.json');
 const a=createAuth({browserToken:initial,storePath});const c=client(a),d=client(a);
 c.call('/auth/login',{password:initial,remember:true});d.call('/auth/login',{password:initial,remember:true});
 c.call('/auth/password',{currentPassword:initial,newPassword,remember:true});assert.equal(c.ok(),true);assert.equal(d.ok(),false);assert.throws(()=>d.call('/auth/restore'),/重新输入/);assert.throws(()=>d.call('/auth/login',{password:initial}),/重新输入/);
 assert.equal(a.authorize({headers:{authorization:`Bearer ${initial}`}}),false);
 const stored=readFileSync(storePath,'utf8');assert.ok(!stored.includes(newPassword));for(const v of Object.values(c.jar))assert.ok(!stored.includes(v));
 const restarted=createAuth({browserToken:initial,storePath});const e=client(restarted);Object.assign(e.jar,c.jar);e.call('/auth/restore');assert.equal(e.ok(),true);assert.throws(()=>e.call('/auth/password',{currentPassword:initial,newPassword:'long-but-incorrect-new'}),/重新输入/);
 e.call('/auth/revoke',{currentPassword:newPassword});const f=client(createAuth({browserToken:initial,storePath}));Object.assign(f.jar,c.jar);assert.throws(()=>f.call('/auth/restore'),/重新输入/);
});
test('CSRF protection, weak passwords, and login throttling',()=>{
 const a=createAuth({browserToken:initial});const c=client(a);assert.throws(()=>a.handle({method:'POST',headers:{}},{},'/auth/login',{password:initial}),/来源/);
 c.call('/auth/login',{password:initial});assert.throws(()=>c.call('/auth/password',{currentPassword:initial,newPassword:'123'}),/16/);
 for(let i=0;i<8;i++)assert.throws(()=>c.call('/auth/login',{password:'wrong'}),/重新输入/);
 assert.throws(()=>c.call('/auth/login',{password:initial}),/尝试次数/);
});
