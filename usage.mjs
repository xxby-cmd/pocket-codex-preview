import {spawnSync} from 'node:child_process';
export async function readUsage(){
  const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,GCM_INTERACTIVE:'Never'}});
  const token=credential.stdout?.split(/\r?\n/).find(x=>x.startsWith('password='))?.slice(9);
  if(!token)throw Error('本机 GitHub 登录不可用');
  async function get(path){const r=await fetch('https://api.github.com'+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('GitHub 用量读取失败 '+r.status);return r.json();}
  const user=await get('/user');const now=new Date();const month=now.toISOString().slice(0,7);
  const report=await get(`/users/${encodeURIComponent(user.login)}/settings/billing/usage/summary?year=${now.getUTCFullYear()}&month=${now.getUTCMonth()+1}&product=codespaces`);
  let usedCoreHours=0;for(const row of report.usageItems||[]){if(!row.sku.startsWith('codespaces_compute'))continue;const cores=Number(row.sku.match(/_d(\d+)$/)?.[1]);if(!cores||row.unitType!=='hours')throw Error('GitHub 计算用量单位未知');usedCoreHours+=row.grossQuantity*cores;}
  const allowance=user.plan?.name==='free'?120:user.plan?.name==='pro'?180:null;
  return {month,updatedAt:now.toISOString(),usedCoreHours,allowanceCoreHours:allowance,remainingHours:allowance===null?null:Math.max(0,allowance-usedCoreHours)/2,cores:2,source:'github',note:'按 2 核换算；GitHub 账单数据可能延迟，存储额度另算'};
}
