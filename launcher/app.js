const $=id=>document.getElementById(id);let token='',poll;
const defaultRelayUrl='https://glorious-waffle-x5jj6wwv7v7xc6xv4-8787.app.github.dev/';
const relayUrl=()=>localStorage.getItem('pocketRelayUrl')||defaultRelayUrl;
$('url').value=relayUrl();
function updateChatButton(){const configured=!!relayUrl();$('open').disabled=!configured;$('open').textContent=configured?'打开聊天页面':'聊天地址还在配置'}
updateChatButton();
const message=text=>$('notice').textContent=text;
async function github(path,method='GET'){const response=await fetch('https://api.github.com'+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},signal:AbortSignal.timeout(20000)});if(response.status===304)return null;if(!response.ok){let data;try{data=await response.json()}catch{}throw Error(`GitHub ${response.status}：${data?.message||'请求失败'}。请检查权限、额度或网络。`)}return response.status===204?null:response.json()}
const target=()=>{const name=$('spaces').value;if(!name)throw Error('请先选择已有的 Codespace');return '/user/codespaces/'+encodeURIComponent(name)};
async function refresh(){const data=await github(target());$('state').textContent='云环境状态：'+data.state;return data}
async function action(fn){const buttons=[...document.querySelectorAll('button')].map(el=>[el,el.disabled]);for(const [el] of buttons)el.disabled=true;message('处理中……');try{await fn()}catch(e){message(e.message)}finally{for(const [el,disabled] of buttons)el.disabled=disabled;updateChatButton()}}
$('auth').onsubmit=e=>{e.preventDefault();action(async()=>{token=$('token').value.trim();$('token').value='';const data=await github('/user/codespaces?per_page=100');$('spaces').replaceChildren();for(const cs of data.codespaces){const option=document.createElement('option');option.value=cs.name;option.textContent=cs.repository.full_name+' · '+cs.name;$('spaces').append(option)}$('controls').hidden=false;if(data.codespaces.length){await refresh();message('已验证 GitHub 授权。')}else message('账号下还没有 Codespace。请先创建项目环境；此页面不会自动创建或产生新的资源。')})};
$('start').onclick=()=>action(async()=>{if(!$('free').checked)throw Error('你的要求是零费用：请先核实免费额度和禁止超额付费设置。');await github(target()+'/start','POST');message('已发送启动请求。启动可能需要一段时间，环境启动后还需等待聊天服务就绪。');await refresh();clearInterval(poll);let count=0;poll=setInterval(async()=>{try{const cs=await refresh();if(cs.state==='Available'||++count>=24){clearInterval(poll);message(cs.state==='Available'?'云环境已运行，可以尝试进入聊天。':'仍在启动，请稍后手动刷新。')}}catch(e){clearInterval(poll);message(e.message)}},5000)});
$('refresh').onclick=()=>action(async()=>{await refresh();message('状态已更新。')});
$('stop').onclick=()=>action(async()=>{clearInterval(poll);await github(target()+'/stop','POST');message('已请求停止。正在执行的中转请求可能中断，存储额度仍会占用。');await refresh()});
$('logout').onclick=()=>{clearInterval(poll);token='';$('controls').hidden=true;$('spaces').replaceChildren();message('令牌已从页面内存中清除。')};
$('spaces').onchange=()=>{clearInterval(poll);action(refresh)};
$('saveUrl').onclick=()=>{try{const url=new URL($('url').value);if(url.protocol!=='https:'||url.username||url.password)throw Error('请输入不含账户密码的 HTTPS 地址');localStorage.setItem('pocketRelayUrl',url.href);updateChatButton();message('聊天地址已保存。是否可用还需实际打开验证。')}catch(e){message(e.message)}};
$('open').onclick=()=>{const url=relayUrl();if(url)window.open(url,'_blank','noopener,noreferrer')};
