import {readdirSync,readFileSync,readlinkSync,realpathSync} from 'node:fs';
import path from 'node:path';
const target=realpathSync('relay.mjs');
for(const pid of readdirSync('/proc').filter(p=>/^\d+$/.test(p))){
 try{const args=readFileSync(`/proc/${pid}/cmdline`,'utf8').split('\0');
 if(!['node','nodejs'].includes(path.basename(args[0]))||!args[1])continue;
 const cwd=readlinkSync(`/proc/${pid}/cwd`);
 if(realpathSync(path.resolve(cwd,args[1]))===target)console.log(pid);
 }catch{}
}
