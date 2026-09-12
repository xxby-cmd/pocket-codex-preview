import {readUsage} from './usage.mjs';
import {Connections} from './connections.mjs';
import net from 'node:net';
import {createHash} from 'node:crypto';
const lock=net.createServer();
const key=createHash('sha256').update(import.meta.url).digest('hex').slice(0,20);
lock.on('error',()=>{console.error('电脑连接程序已经运行，无需重复启动');process.exit(0)});
await new Promise(r=>lock.listen(process.platform==='win32'?'\\\\.\\pipe\\pocket-'+key:'/tmp/pocket-'+key+'.sock',r));
const base=new URL(process.env.POCKET_RELAY_URL||'http://127.0.0.1:8787');
if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw Error('公网连接必须使用 HTTPS');
const token=process.env.POCKET_HOST_TOKEN;if(!token)throw Error('请设置 POCKET_HOST_TOKEN');
const codex=new Connections();await codex.start();console.log('电脑已连接 Codex，正在连接中转服务');
let stopped=false;process.on('SIGINT',()=>{stopped=true;codex.close();process.exit()});process.on('SIGTERM',()=>{stopped=true;codex.close();process.exit()});
async function api(route,data){const r=await fetch(new URL(route,base),{method:data?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`中转服务返回 ${r.status}`);if(!(r.headers.get('content-type')||'').includes('application/json'))throw Error('中转返回网页，请检查 Codespaces 已启动且 8787 为 Public');return r.json()}
let warned=false;
let lastUsage;setInterval(()=>{if(lastUsage)api('/host/usage',lastUsage).catch(()=>{})},60000).unref();
async function syncUsage(){try{lastUsage=await readUsage();await api('/host/usage',lastUsage)}catch(e){console.error('额度暂未更新：'+e.message)}}
syncUsage();setInterval(syncUsage,600000).unref();
while(!stopped){
  try{const {jobs}=await api('/host/poll');if(warned)console.log('中转连接已恢复');warned=false;
    for(const job of jobs){(async()=>{let data;try{data={id:job.id,result:await codex.execute(job.op,job.args)}}catch(e){data={id:job.id,error:e.message}}let delivered=false;for(let attempt=0;attempt<3&&!delivered;attempt++){try{await api('/host/result',data);delivered=true}catch(e){console.error('结果回传失败（'+job.op+'，'+Buffer.byteLength(JSON.stringify(data))+' 字节）：'+e.message);if(attempt<2)await new Promise(r=>setTimeout(r,1000))}}})()}
  }catch(e){if(!warned)console.error('连接中断：'+e.message);warned=true}
  await new Promise(r=>setTimeout(r,1000));
}



