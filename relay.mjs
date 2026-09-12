import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createAuth} from './auth.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const allowed=new Set(['list','read','send','new','pending','answer','stop','release','keepalive']);
export function createRelay({browserToken,hostToken,authStorePath,authNow,authIdleMs}) {
  if(!browserToken || !hostToken || browserToken.length<24 || hostToken.length<24 || browserToken===hostToken) throw Error('需要两个不同的至少 24 位访问密钥');
  const jobs=new Map(); let lastSeen=0; let usage=null;
  const auth=createAuth({browserToken,storePath:authStorePath,now:authNow,idleMs:authIdleMs});
  const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
  const reply=(res,status,data)=>{if(!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}};
  async function body(req){let data='';for await(const c of req){data+=c;if(Buffer.byteLength(data)>131072)throw Error('请求过大')}return JSON.parse(data||'{}')}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/usage')return reply(res,200,usage||{remainingHours:null,note:'等待电脑同步 GitHub 用量'});
    if(url.pathname.startsWith('/auth/')){
      try{return reply(res,200,auth.handle(req,res,url.pathname,await body(req)))}catch(e){return reply(res,e.status||400,{error:e.message})}
    }
    const isHost=url.pathname.startsWith('/host/');
    if(url.pathname.startsWith('/api/')||isHost){
      if(!(isHost?equal(req.headers.authorization?.replace(/^Bearer /,''),hostToken):auth.authorize(req)))return reply(res,401,{error:'登录已过期或访问密钥不正确'});
      try{
        if(isHost)lastSeen=Date.now();
        if(req.method==='POST'&&url.pathname==='/host/usage'){const data=await body(req);usage=Object.fromEntries(['month','updatedAt','usedCoreHours','allowanceCoreHours','remainingHours','cores','source','note'].map(k=>[k,data[k]]));return reply(res,200,{ok:true})}
        if(req.method==='GET'&&url.pathname==='/api/status')return reply(res,200,{online:Date.now()-lastSeen<30000,pending:jobs.size});
        if(req.method==='GET'&&url.pathname==='/host/poll'){
          const queued=[...jobs.values()].filter(j=>!j.delivered&&Date.now()-j.created<40000).slice(0,8);
          queued.forEach(j=>j.delivered=true);return reply(res,200,{jobs:queued.map(({id,op,args})=>({id,op,args}))});
        }
        if(req.method==='POST'&&url.pathname==='/host/result'){
          const data=await body(req),j=jobs.get(data.id);if(j){clearTimeout(j.timer);jobs.delete(j.id);reply(j.res,200,data.error?{error:data.error}:{result:data.result})}return reply(res,200,{ok:true});
        }
        if(req.method==='POST'&&url.pathname==='/api/request'){
          if(Date.now()-lastSeen>=30000)return reply(res,503,{error:'电脑连接程序离线，请先启动它'});
          const data=await body(req);if(!allowed.has(data.op))return reply(res,400,{error:'不支持的操作'});
          if(jobs.size>=32)return reply(res,429,{error:'请求较多，请稍后重试'});
          const id=randomUUID(); const job={id,op:data.op,args:data.args||{},res,created:Date.now(),delivered:false};
          job.timer=setTimeout(()=>{jobs.delete(id);reply(res,504,{error:job.delivered?'电脑已接收，但结果超时。请先刷新记录确认，避免重复发送。':'请求尚未交给电脑，已取消。'})},45000);
          jobs.set(id,job);return;
        }
        return reply(res,404,{error:'接口不存在'});
      }catch(e){return reply(res,400,{error:e.message})}
    }
    if(req.method!=='GET')return reply(res,405,{error:'方法不支持'});
    const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
    const file=files[url.pathname];if(!file)return reply(res,404,{error:'页面不存在'});
    try{res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(path.join(root,'public',file)))}catch{reply(res,500,{error:'页面文件读取失败'})}
  });
  server.on('close',()=>{for(const j of jobs.values()){clearTimeout(j.timer);reply(j.res,503,{error:'中转服务已关闭'})}jobs.clear()});
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createRelay({browserToken:process.env.POCKET_BROWSER_TOKEN,hostToken:process.env.POCKET_HOST_TOKEN,authStorePath:path.join(root,'.local','auth.json')});
  server.listen(Number(process.env.PORT||8787),process.env.BIND||'127.0.0.1',()=>console.log(`Pocket Codex 中转已启动，端口 ${server.address().port}`));
}

