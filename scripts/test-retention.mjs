import assert from 'node:assert/strict';
import {Miniflare} from 'miniflare';
import {visibleJobsSql,visibleJob,MATCH_WINDOW_MS,APPLIED_WINDOW_MS} from '../lib/job-retention.ts';
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});
try{
 const db=await mf.getD1Database('DB'),now=Date.now();
 await db.prepare('CREATE TABLE jobs(id TEXT PRIMARY KEY,status TEXT,found_at INTEGER,applied_at INTEGER,posted_at INTEGER)').run();
 const rows=[
  {id:'fresh',status:'new',found_at:now-MATCH_WINDOW_MS+1,applied_at:null},
  {id:'exactly-seven',status:'new',found_at:now-MATCH_WINDOW_MS,applied_at:null},
  {id:'expired',status:'new',found_at:now-MATCH_WINDOW_MS-1,applied_at:null},
  {id:'applied-old-post',status:'applied',found_at:now-30*86400000,applied_at:now-86400000},
  {id:'applied-expired',status:'applied',found_at:now-30*86400000,applied_at:now-APPLIED_WINDOW_MS-1},
  {id:'dismissed',status:'dismissed',found_at:now,applied_at:null}
 ];
 for(const r of rows)await db.prepare('INSERT INTO jobs(id,status,found_at,applied_at) VALUES(?,?,?,?)').bind(r.id,r.status,r.found_at,r.applied_at).run();
 const query=()=>db.prepare(visibleJobsSql).bind(now-MATCH_WINDOW_MS,now-APPLIED_WINDOW_MS).all();
 const ids=(await query()).results.map(r=>r.id).sort();
 assert.deepEqual(ids,['applied-old-post','fresh']);assert.deepEqual(rows.filter(r=>visibleJob(r,now)).map(r=>r.id).sort(),ids);
 await db.prepare("INSERT OR IGNORE INTO jobs(id,status,found_at,applied_at) VALUES('expired','new',?,NULL)").bind(now).run();
 assert.ok(!(await query()).results.some(r=>r.id==='expired'));
 await db.prepare("UPDATE jobs SET posted_at=? WHERE id='applied-old-post'").bind(now-1000).run();
 assert.equal((await query()).results[0].id,'applied-old-post');
 console.log('PASS: 7-day boundary, applied retention, dismissed exclusion, server/client parity, expired matches do not return on duplicate discovery.');
}finally{await mf.dispose();}
