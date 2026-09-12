import {historyPage} from './history.mjs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
export class Codex {
  constructor(){this.id=0;this.calls=new Map();this.requests=new Map();this.loaded=new Set();this.active=new Map();this.sending=new Set();this.sent=new Map();}
  async start(){
    this.child=spawn(process.env.CODEX_BINARY||'codex',['app-server','--stdio'],{windowsHide:true});
    this.child.stderr.on('data',()=>{});
    this.child.on('error',e=>this.fail(e));this.child.on('exit',()=>this.fail(Error('Codex 连接程序已退出，请重启电脑连接程序')));
    createInterface({input:this.child.stdout}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}
      if(m.method&&m.id!==undefined){const key=randomUUID();this.requests.set(key,{key,id:m.id,method:m.method,params:m.params});return}
      if(m.id!==undefined&&this.calls.has(m.id)){const c=this.calls.get(m.id);this.calls.delete(m.id);clearTimeout(c.timer);m.error?c.reject(Error(m.error.message)):c.resolve(m.result)}
      if(m.method==='turn/started')this.active.set(m.params.threadId,m.params.turn.id);
      if(m.method==='turn/completed'){this.active.delete(m.params.threadId);this.onCompleted?.(m.params.threadId);for(const [k,r]of this.requests)if(r.params?.threadId===m.params.threadId)this.requests.delete(k)}
      if(m.method==='serverRequest/resolved')for(const [k,r]of this.requests)if(r.id===m.params.requestId)this.requests.delete(k);
    });
    await this.call('initialize',{clientInfo:{name:'pocket_codex',version:'0.1.0'}});this.write({method:'initialized',params:{}});
  }
  fail(e){this.dead=e;for(const c of this.calls.values()){clearTimeout(c.timer);c.reject(e)}this.calls.clear()}
  write(m){this.child.stdin.write(JSON.stringify(m)+'\n')}
  call(method,params){if(this.dead)return Promise.reject(this.dead);return new Promise((resolve,reject)=>{const id=++this.id;const timer=setTimeout(()=>{this.calls.delete(id);reject(Error('Codex 响应超时，请先查看记录，不要立即重复发送'))},35000);this.calls.set(id,{resolve,reject,timer});this.write({id,method,params})})}
  async execute(op,a={}){
    if(op==='list'){const r=await this.call('thread/list',{limit:40,cursor:a.cursor||null,sortKey:'updated_at',searchTerm:a.search||null,sourceKinds:['cli','vscode','appServer','exec','unknown'],useStateDbOnly:true});return {threads:r.data.map(t=>({id:t.id,name:t.name||t.preview?.slice(0,50)||'未命名对话',updatedAt:t.updatedAt})),cursor:r.nextCursor}}
    if(op==='pending')return [...this.requests.values()].map(({key,method,params})=>({key,method,params}));
    if(op==='answer'){
      const r=this.requests.get(a.key);if(!r)throw Error('该请求已处理或失效');let result;
      if(['item/commandExecution/requestApproval','item/fileChange/requestApproval'].includes(r.method)){
        if(!['accept','decline'].includes(a.decision))throw Error('无效的审批选择');result={decision:a.decision};
      }else if(r.method==='item/tool/requestUserInput'||r.method==='tool/requestUserInput'){
        const answers={};for(const q of r.params.questions||[]){const answer=a.answers?.[q.id];if(typeof answer!=='string'||!answer.trim())throw Error('请回答所有问题');answers[q.id]={answers:[answer]}}result={answers};
      }else{if(a.decision!=='decline')throw Error('初版暂不支持此类授权，请在电脑处理');this.write({id:r.id,error:{code:-32601,message:'手机端不支持此请求，用户已拒绝'}});this.requests.delete(a.key);return {ok:true}}
      this.write({id:r.id,result});this.requests.delete(a.key);return {ok:true};
    }
    if(op==='new'){const r=await this.call('thread/start',{approvalPolicy:'on-request'});this.loaded.add(r.thread.id);return {id:r.thread.id}}
    if(typeof a.threadId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(a.threadId))throw Error('无效的对话编号');
    if(op==='read'){const r=await this.call('thread/read',{threadId:a.threadId,includeTurns:true});return {...historyPage(r.thread,a.cursor??null),status:this.active.has(a.threadId)?'working':'unknown'}}
    if(op==='stop'){const turnId=this.active.get(a.threadId);if(!turnId)throw Error('此连接程序没有接管该对话的运行，不能停止桌面端任务');return this.call('turn/interrupt',{threadId:a.threadId,turnId})}
    if(op==='send'){
      if(typeof a.text!=='string'||!a.text.trim()||a.text.length>30000)throw Error('消息不能为空或超过 30000 字');
      if(typeof a.requestId!=='string'||a.requestId.length>100)throw Error('缺少消息编号');
      if(this.sent.has(a.requestId))return this.sent.get(a.requestId);
      if(this.sending.has(a.threadId)||this.active.has(a.threadId))throw Error('该对话正在处理消息，请等待完成');
      this.sending.add(a.threadId);
      try{
        if(!this.loaded.has(a.threadId)){await this.call('thread/resume',{threadId:a.threadId,approvalPolicy:'on-request'});this.loaded.add(a.threadId)}
        const r=await this.call('turn/start',{threadId:a.threadId,input:[{type:'text',text:a.text,text_elements:[]}]});
        this.active.set(a.threadId,r.turn.id);const result={turnId:r.turn.id};this.sent.set(a.requestId,result);if(this.sent.size>1000)this.sent.delete(this.sent.keys().next().value);return result;
      }finally{this.sending.delete(a.threadId)}
    }
    throw Error('操作不支持');
  }
  close(){this.child?.kill()}
}

