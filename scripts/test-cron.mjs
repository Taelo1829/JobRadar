import path from 'node:path';
import { Miniflare, Log, LogLevel } from 'miniflare';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const mf=new Miniflare({unsafeTriggerHandlers:true,modules:[{type:'ESModule',path:path.resolve('dist/server/index.js'),contents:fs.readFileSync('dist/server/index.js','utf8')},...fs.readdirSync('dist/server',{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js').map(p=>({type:'ESModule',path:path.resolve('dist/server',p),contents:fs.readFileSync('dist/server/'+p,'utf8')}))],modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{STANDALONE:'true',APP_PASSWORD:'test-only',SCHEDULER_ENABLED:'true'},log:new Log(LogLevel.DEBUG)});
try{
 const db=await mf.getD1Database('DB');
 const migration=fs.readFileSync('drizzle/0000_aberrant_shocker.sql','utf8');
 for(const sql of migration.split('--> statement-breakpoint'))await db.prepare(sql.trim()).run();
 const r=await mf.dispatchFetch('http://localhost/cdn-cgi/handler/scheduled?cron=0+6,11,18+*+*+*');
 console.log('Scheduled response:',r.status,await r.text());
 assert.equal(r.status,200);
 const run=await db.prepare("SELECT value FROM settings WHERE key='schedulerLastRun'").first();assert.ok(run);
 console.log('PASS: compiled native scheduled handler runs and persists completion in D1.');
}finally{await mf.dispose();}



