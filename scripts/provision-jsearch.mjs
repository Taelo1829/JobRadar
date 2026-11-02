import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
const vars=parseEnv(fs.readFileSync('.env.local','utf8'));
const key=vars.JSEARCH_API_KEY||vars.JSearch_API_KEY;
if(!key)throw new Error('JSEARCH_API_KEY is missing from .env.local');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--config','dist/server/wrangler.standalone.json'],{stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify({JSEARCH_API_KEY:key}));
child.on('exit',code=>{process.exitCode=code??1;});
