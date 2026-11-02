import { env } from 'cloudflare:workers';
import { searchIndexedJobs } from './jsearch';
export function db() { if (!env.DB) throw new Error('Database unavailable'); return env.DB; }
export async function setting(key: string) { return (await db().prepare('SELECT value FROM settings WHERE key=?').bind(key).first<{value:string}>())?.value; }
export async function setSetting(key: string,value: string) { await db().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run(); }
export const b64 = (data: ArrayBuffer|Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(data))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export async function vapid() {
  let saved = await setting('vapid');
  if (!saved) {
    const keys = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']) as CryptoKeyPair;
    const value = JSON.stringify({privateKey:await crypto.subtle.exportKey('jwk',keys.privateKey),publicKey:b64(await crypto.subtle.exportKey('raw',keys.publicKey))});
    await db().prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind('vapid',value).run();saved = await setting('vapid');
  }return JSON.parse(saved!);
}
export function validPush(endpoint: string) {
  try { const u = new URL(endpoint); return u.protocol==='https:' && !u.port && (u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com')); } catch { return false; }
}
export async function notifyNew(count: number) {
  if(!count) return;
  await setSetting('notification', JSON.stringify({title:count===1?'A new opportunity is waiting':`${count} new opportunities`,body:'Open Job Radar to explore your latest matches.'}));
  const subs = await db().prepare('SELECT endpoint FROM subscriptions').all<{endpoint:string}>();if(!subs.results.length) return;
  const keys=await vapid();const privateKey=await crypto.subtle.importKey('jwk',keys.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  for(const sub of subs.results) {
    if(!validPush(sub.endpoint)) continue;
    try {
      const head=b64(new TextEncoder().encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
      const payload=b64(new TextEncoder().encode(JSON.stringify({aud:new URL(sub.endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'mailto:notifications@jobradar.example'})));
      const unsigned=head+'.'+payload;const sig=b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,new TextEncoder().encode(unsigned)));
      const r=await fetch(sub.endpoint,{method:'POST',headers:{Authorization:`vapid t=${unsigned}.${sig}, k=${keys.publicKey}`,TTL:'86400',Urgency:'normal'},signal:AbortSignal.timeout(10000)});
      if(r.status===404||r.status===410) await db().prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
      else if(!r.ok) await setSetting('pushError',`Push provider returned ${r.status}`);
    } catch { await setSetting('pushError','A push delivery failed; jobs are saved in your inbox.'); }
  }
}
export function plain(s: string) { return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<\/(p|div|li|h[1-6])>/gi,'\n\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').trim(); }
export const matches = (title: string,role: string) => role.toLowerCase().split(/\s+/).filter(Boolean).every(word=>title.toLowerCase().includes(word));
export function canonical(url: string) { const u=new URL(url); if(u.protocol!=='https:') throw new Error('Job links must use HTTPS'); for(const k of [...u.searchParams.keys()]) if(k.startsWith('utm_'))u.searchParams.delete(k); u.hash='';return u.href; }
export async function insertJob(w:any,j:any) {
  if(!j.title || !j.url || !matches(j.title,w.role))return 0;
  const url=canonical(j.url);const id=b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(w.company.toLowerCase().trim()+'|'+url)));
  const result=await db().prepare('INSERT OR IGNORE INTO jobs(id,watch_id,company,title,location,url,description,found_at,status,posted_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,w.id,w.company,String(j.title).slice(0,300),String(j.location||'Location not listed').slice(0,300),url,plain(String(j.description||'View the original posting for the full description.')).slice(0,50000),Date.now(),'new',j.posted_at??null).run();
  if(!result.meta.changes&&j.posted_at!=null)await db().prepare('UPDATE jobs SET posted_at=? WHERE id=? AND posted_at IS NULL').bind(j.posted_at,id).run();
  return result.meta.changes||0;
}
export async function scan(onlyId?:string):Promise<{newJobs:number;message?:string;failed?:number}> {
  // Each watch gets a separate invocation so one large watchlist cannot exhaust
  // the Worker's per-invocation external-request allowance.
  if(!onlyId&&env.APP_ORIGIN&&env.APP_PASSWORD){
    const watches=await db().prepare('SELECT id FROM watches').all<{id:string}>();let total=0,failed=0;
    for(const w of watches.results)try{
      const r=await fetch(new URL('/api/run',env.APP_ORIGIN),{method:'POST',headers:{Authorization:'Basic '+btoa('owner:'+env.APP_PASSWORD),'Content-Type':'application/json'},body:JSON.stringify({watchId:w.id}),signal:AbortSignal.timeout(240000)});
      if(!r.ok){await r.body?.cancel();failed++;continue;}const result:any=await r.json();total+=result.newJobs||0;failed+=result.failed||0;
    }catch{failed++;}
    await setSetting('lastRun',JSON.stringify({completedAt:Date.now(),newJobs:total,failed}));return {newJobs:total,failed,message:`${total} new jobs. ${failed?`${failed} searches could not complete. `:''}Checks complete.`};
  }
  const lockKey='scanLock:'+(onlyId||'all');
  const lock=await db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?").bind(lockKey,String(Date.now()+600000),Date.now()).run();if(!lock.meta.changes)return {newJobs:0,message:'A check is already running'};
  let count=0,failed=0;
  try {
    const watches=await db().prepare(onlyId?'SELECT * FROM watches WHERE id=?':'SELECT * FROM watches').bind(...(onlyId?[onlyId]:[])).all<any>();
    for(const w of watches.results) {
      let watchCount=0;
      try {
        if(!env.JSEARCH_API_KEY)throw new Error('Search connection needs setup');
        const result=await searchIndexedJobs(w.company,w.role,env.JSEARCH_API_KEY);
        for(const job of result.jobs)watchCount+=await insertJob(w,job);
        count+=watchCount;
        await db().prepare('UPDATE watches SET last_check=?,message=? WHERE id=?').bind(Date.now(),`${watchCount} new jobs found`,w.id).run();
        await db().prepare('INSERT INTO source_checks(id,watch_id,source,status,message,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,message=excluded.message,checked_at=excluded.checked_at').bind(w.id+':jsearch',w.id,'jsearch','ok',result.message,Date.now()).run();
      } catch {failed++;await db().prepare('UPDATE watches SET message=? WHERE id=?').bind('Search could not finish. Please try again later.',w.id).run();}
    }await notifyNew(count); await setSetting('lastRun',JSON.stringify({completedAt:Date.now(),newJobs:count,failed})); return {newJobs:count,failed,message:`${count} new jobs.${failed?' A search could not finish. Please try again later.':''}`};
  } finally { await setSetting(lockKey,'0'); }
}
