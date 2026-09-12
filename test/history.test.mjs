import test from 'node:test';
import assert from 'node:assert/strict';
import {historyPage} from '../history.mjs';
import {Connections} from '../connections.mjs';
test('history is byte bounded and reconstructs huge Unicode messages without loss',()=>{
 const text='长消息😀\n'.repeat(30000);const thread={id:'t',turns:Array.from({length:5},(_,i)=>({id:'t'+i,items:[{id:'i'+i,type:'agentMessage',text:i===3?text:'turn '+i}]}))};
 let page=historyPage(thread),rows=[...page.messages];assert.ok(new Set(page.messages.map(m=>m.turnId)).size<=2);
 while(page.cursor){assert.ok(Buffer.byteLength(JSON.stringify({id:'job',result:page}))<131072);page=historyPage(thread,page.cursor);rows.unshift(...page.messages);}
 assert.equal(rows.filter(x=>x.turnId==='t3').map(x=>x.text).join(''),text);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);assert.equal(rows[0].text,'turn 0');
});
test('phone completion and leaving close only the dedicated writer',async()=>{
 const created=[];class Fake{constructor(){this.active=new Map();this.sending=new Set();this.requests=new Map();created.push(this)}async start(){}close(){this.closed=true}async execute(op,a){if(op==='send'){this.active.set(a.threadId,'turn');return {turnId:'turn'}}if(op==='stop'){this.stopped=true;this.active.delete(a.threadId)}if(op==='read')return {messages:[]}}}
 const pool=new Connections(()=>new Fake());await pool.start();try{await pool.execute('send',{threadId:'one',requestId:'a'});await pool.execute('release',{threadId:'one'});assert.equal(created[1].closed,true);assert.equal(created[1].stopped,true);assert.ok(!created[0].closed);await pool.execute('send',{threadId:'two',requestId:'b'});created[2].onCompleted();await new Promise(r=>setTimeout(r,10));assert.equal(created[2].closed,true);assert.equal(pool.writers.size,0);}finally{pool.close()}
});
