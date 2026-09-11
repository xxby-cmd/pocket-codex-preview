import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';

const digest=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const sessionName='__Host-pocket-session',deviceName='__Host-pocket-device';
export function createAuth({browserToken,storePath,now=Date.now,idleMs=300000}) {
  const password=value=>{const salt=secret();return {salt,hash:scryptSync(value,salt,32).toString('hex')}};
  let state=storePath&&existsSync(storePath)?JSON.parse(readFileSync(storePath,'utf8')):{password:password(browserToken),devices:{}};
  const sessions=new Map();let attempts=[];
  function save(next){if(storePath){mkdirSync(path.dirname(storePath),{recursive:true});writeFileSync(storePath+'.tmp',JSON.stringify(next),{mode:0o600});renameSync(storePath+'.tmp',storePath)}state=next}
  if(storePath&&!existsSync(storePath))save(state);
  function verify(value){if(typeof value!=='string'||value.length>256)return false;const actual=scryptSync(value,state.password.salt,32);return timingSafeEqual(actual,Buffer.from(state.password.hash,'hex'))}
  function limitedVerify(value){attempts=attempts.filter(t=>now()-t<300000);if(attempts.length>=8)throw Object.assign(Error('尝试次数较多，请 5 分钟后重试'),{status:429});const ok=verify(value);if(!ok)attempts.push(now());return ok}
  let legacyDigest=!state.legacyDisabled&&verify(browserToken)?digest(browserToken):null;
  function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')))}
  function setCookie(res,name,value,age){const previous=res.getHeader('Set-Cookie')||[];res.setHeader('Set-Cookie',[...previous,`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`])}
  function session(req){const key=digest(cookies(req)[sessionName]||'');const s=sessions.get(key);if(!s)return null;if(now()-s.active>=idleMs||now()>=s.expires){sessions.delete(key);return null}return s}
  function issue(req,res){const old=digest(cookies(req)[sessionName]||'');sessions.delete(old);for(const [key,s]of sessions)if(now()-s.active>=idleMs||now()>=s.expires)sessions.delete(key);if(sessions.size>=64)sessions.delete(sessions.keys().next().value);const value=secret();sessions.set(digest(value),{active:now(),expires:now()+43200000});setCookie(res,sessionName,value,43200)}
  function remember(req,res){const devices=Object.fromEntries(Object.entries(state.devices).filter(([,d])=>d.expires>now()));delete devices[digest(cookies(req)[deviceName]||'')];while(Object.keys(devices).length>=20)delete devices[Object.keys(devices)[0]];const value=secret();devices[digest(value)]={expires:now()+2592000000};save({...state,devices});setCookie(res,deviceName,value,2592000)}
  function forget(req,res){const devices={...state.devices};delete devices[digest(cookies(req)[deviceName]||'')];save({...state,devices});setCookie(res,deviceName,'',0)}
  return {
    // Only the original high-entropy key supports old clients until it is rotated.
    authorize(req){if(req.headers.authorization)return !!legacyDigest&&digest(req.headers.authorization.replace(/^Bearer /,''))===legacyDigest;return req.headers['x-pocket-client']==='browser'&&!!session(req)},
    handle(req,res,route,data){
      if(req.method!=='POST'||req.headers['x-pocket-client']!=='browser'||!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(Error('请求来源不正确'),{status:403});
      const denied=()=>{throw Object.assign(Error('请重新输入访问密钥'),{status:401})};
      if(route==='/auth/login'){
        if(!limitedVerify(data.password))return denied();
        if(data.remember)remember(req,res);else forget(req,res);
        issue(req,res);return {ok:true};
      }
      if(route==='/auth/restore'){
        if(session(req))return {ok:true};
        const d=state.devices[digest(cookies(req)[deviceName]||'')];if(!d||d.expires<=now())return denied();
        issue(req,res);return {ok:true};
      }
      if(route==='/auth/logout'){
        forget(req,res);sessions.delete(digest(cookies(req)[sessionName]||''));setCookie(res,sessionName,'',0);return {ok:true};
      }
      if(!session(req))return denied();
      if(route==='/auth/activity'){session(req).active=now();return {ok:true}}
      if(route==='/auth/password'||route==='/auth/revoke'){
        if(!limitedVerify(data.currentPassword))return denied();
        if(route==='/auth/password'){
          if(typeof data.newPassword!=='string'||data.newPassword.length<16||data.newPassword.length>128)throw Error('新密钥请使用 16–128 个字符，建议使用多个不相关的词');
          save({password:password(data.newPassword),devices:{},legacyDisabled:true});
        }else save({...state,devices:{},legacyDisabled:true});
        legacyDigest=null;sessions.clear();setCookie(res,deviceName,'',0);if(data.remember)remember(req,res);issue(req,res);return {ok:true};
      }
      throw Object.assign(Error('接口不存在'),{status:404});
    }
  };
}
