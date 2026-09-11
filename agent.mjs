import {Codex} from './codex.mjs';
const base=new URL(process.env.POCKET_RELAY_URL||'http://127.0.0.1:8787');
if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('公网连接必须使用 HTTPS');
const token=process.env.POCKET_HOST_TOKEN;if(!token)throw Error('请设置 POCKET_HOST_TOKEN');
const codex=new Codex();await codex.start();console.log('电脑已连接 Codex，正在连接中转服务');
let stopped=false;process.on('SIGINT',()=>{stopped=true;codex.close();process.exit()});process.on('SIGTERM',()=>{stopped=true;codex.close();process.exit()});
async function api(route,data){const r=await fetch(new URL(route,base),{method:data?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`中转服务返回 ${r.status}`);return r.json()}
let warned=false;
while(!stopped){
  try{const {jobs}=await api('/host/poll');if(warned)console.log('中转连接已恢复');warned=false;
    for(const job of jobs){(async()=>{let data;try{data={id:job.id,result:await codex.execute(job.op,job.args)}}catch(e){data={id:job.id,error:e.message}}try{await api('/host/result',data)}catch{console.error('结果回传失败，请在电脑核对；任务不会自动重发')}})()}
  }catch(e){if(!warned)console.error('连接中断：'+e.message);warned=true}
  await new Promise(r=>setTimeout(r,1000));
}
