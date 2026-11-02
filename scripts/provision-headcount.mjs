import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
const vars=Object.assign({},...['.env','.env.local'].filter(f=>fs.existsSync(f)).map(f=>parseEnv(fs.readFileSync(f,'utf8'))));
const key=vars.HEADCOUNT_API_KEY||vars.HEADCOUNTLABS_API_KEY||vars.HeadCount_API_KEY;
if(!key)throw new Error('Headcount API key is missing from the local environment');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','dist/server/wrangler.standalone.json'],{stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify({HEADCOUNT_API_KEY:key}));
child.on('exit',code=>{process.exitCode=code??1;});
