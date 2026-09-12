import {stopCloud} from './cloud-control.mjs';
import {Codex} from './codex.mjs';
export class Connections {
  constructor(factory=()=>new Codex()){this.factory=factory;this.reader=factory();this.writers=new Map();this.sent=new Map();this.leases=new Map();}
  async start(){await this.reader.start();this.timer=setInterval(()=>{for(const [id,w]of this.writers)if(Date.now()-(this.leases.get(id)||0)>90000)this.release(id).catch(e=>console.error('释放连接失败：'+e.message));},5000);}
  async release(id){const w=this.writers.get(id);if(!w)return {released:true};w.leaving=true;if(w.sending.size){return {released:false,stopping:true};}try{if(w.active.has(id))await w.execute('stop',{threadId:id});}finally{w.close();if(this.writers.get(id)===w)this.writers.delete(id);this.leases.delete(id);}return {released:true};}
  async execute(op,a={}){
    if(op==='cloudStop'){const result=await stopCloud();for(const id of [...this.writers.keys()])await this.release(id);return result;}
    if(op==='release')return this.release(a.threadId);
    if(op==='keepalive'){this.leases.set(a.threadId,Date.now());return {ok:true};}
    if(op==='pending')return [...this.writers.values()].flatMap(w=>[...w.requests.values()].map(({key,method,params})=>({key,method,params})));
    if(op==='answer'){const w=[...this.writers.values()].find(w=>w.requests.has(a.key));if(!w)throw Error('此请求已失效');return w.execute(op,a);}
    if(op==='stop'){return this.release(a.threadId);}
    if(op==='send'){
      if(this.sent.has(a.requestId))return this.sent.get(a.requestId);
      const existing=this.writers.get(a.threadId);if(existing&&(existing.active.size||existing.sending.size))throw Error('手机任务正在运行，请等待完成或先停止');
      const w=existing||this.factory();this.writers.set(a.threadId,w);this.leases.set(a.threadId,Date.now());
      w.onCompleted=()=>{setTimeout(()=>{if(this.writers.get(a.threadId)===w){w.close();this.writers.delete(a.threadId);}},0);};
      try{if(!existing)await w.start();const result=await w.execute(op,a);w.empty=false;this.sent.set(a.requestId,result);if(this.sent.size>1000)this.sent.delete(this.sent.keys().next().value);if(w.leaving)await this.release(a.threadId);return result;}
      catch(e){w.close();this.writers.delete(a.threadId);if(/active writer/i.test(e.message))throw Error('电脑端正在占用这条会话。请先在电脑完成或离开该会话，再从手机发送；本次消息未自动重试。');throw e;}
    }
    if(op==='new'){const w=this.factory();try{await w.start();const r=await w.execute(op,a);w.empty=true;this.writers.set(r.id,w);this.leases.set(r.id,Date.now());return r;}catch(e){w.close();throw e;}}
    const owner=op==='read'?this.writers.get(a.threadId):null;if(owner?.empty)return {id:a.threadId,messages:[],cursor:null,hasMore:false,status:'unknown',turns:0};const result=await (owner||this.reader).execute(op,a);if(op==='read')result.status=owner?.active.has(a.threadId)?'working':'unknown';return result;
  }
  close(){clearInterval(this.timer);this.reader.close();for(const w of this.writers.values())w.close();}
}

