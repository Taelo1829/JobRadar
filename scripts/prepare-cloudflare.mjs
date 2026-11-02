import fs from 'node:fs';
import path from 'node:path';
const deployment=JSON.parse(fs.readFileSync('cloudflare-deployment.json','utf8'));
const databaseId=process.argv[2]||deployment.database_id;
if(!databaseId||!/^[-a-f0-9]{36}$/.test(databaseId))throw new Error('Pass the real D1 database UUID returned by wrangler d1 create.');
const output=path.resolve('dist/server/wrangler.standalone.json');
const config=JSON.parse(fs.readFileSync('dist/server/wrangler.json','utf8'));
config.name=deployment.worker_name;config.account_id=deployment.account_id;config.workers_dev=true;
config.compatibility_flags=[...new Set([...config.compatibility_flags,'global_fetch_strictly_public'])];
config.d1_databases=[{binding:'DB',database_name:'job-radar',database_id:databaseId,migrations_dir:path.resolve('drizzle')}];
config.vars={...config.vars,STANDALONE:'true',SCHEDULER_ENABLED:'true',APP_ORIGIN:deployment.url};
config.triggers={crons:['0 6,11,18 * * *']}; // UTC = 08:00,13:00,20:00 Africa/Johannesburg
config.assets={...config.assets,binding:'ASSETS',run_worker_first:true};
fs.writeFileSync(output,JSON.stringify(config,null,2)+'\n');console.log(output);
