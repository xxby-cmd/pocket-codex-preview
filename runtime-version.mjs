import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
export function runtimeVersion(){
 const hash=createHash('sha256');
 for(const name of ['runtime-version.mjs','relay.mjs','auth.mjs','public/index.html','public/app.js','public/style.css']){hash.update(name+'\0');hash.update(readFileSync(path.join(root,name)));}
 return hash.digest('hex');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(runtimeVersion());
