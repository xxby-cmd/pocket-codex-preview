import {spawnSync} from 'node:child_process';
export function codespaceFromRelay(relay){
 const url=new URL(relay);const match=url.hostname.match(/^([a-z0-9-]+)-8787\.app\.github\.dev$/);
 if(url.protocol!=='https:'||!match)throw Error('当前连接地址不是受支持的 Codespaces 地址');
 return match[1];
}
export async function stopCloud({relay=process.env.POCKET_RELAY_URL,fetchImpl=fetch,token}={}){
 const name=codespaceFromRelay(relay);
 if(!token){const result=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,GCM_INTERACTIVE:'Never'}});token=result.stdout?.split(/\r?\n/).find(x=>x.startsWith('password='))?.slice(9);}
 if(!token)throw Error('电脑上的 GitHub 登录不可用，请到 GitHub 管理页停止');
 const r=await fetchImpl(`https://api.github.com/user/codespaces/${encodeURIComponent(name)}/stop`,{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error(`GitHub 未接受停止请求（${r.status}），请到 GitHub 管理页操作`);
 return {accepted:true,name,message:'GitHub 已接受停止请求，云端停止后页面将断开'};
}
