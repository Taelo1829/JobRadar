import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const file='.env.local';
let password=fs.existsSync(file)?fs.readFileSync(file,'utf8').match(/^APP_PASSWORD=(.+)$/m)?.[1]:null;
if(!password){password=crypto.randomBytes(24).toString('base64url');fs.appendFileSync(file,'\n# Private Job Radar login. Username: owner\nAPP_PASSWORD='+password+'\n',{mode:0o600});}
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','dist/server/wrangler.standalone.json'],{stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify({APP_PASSWORD:password}));
child.on('exit',code=>{process.exitCode=code??1;});
