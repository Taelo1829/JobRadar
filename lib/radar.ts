import { env } from 'cloudflare:workers';
import { discoverJobs } from './search';
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
  const result=await db().prepare('INSERT OR IGNORE INTO jobs(id,watch_id,company,title,location,url,description,found_at,status) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,w.id,w.company,String(j.title).slice(0,300),String(j.location||'Location not listed').slice(0,300),url,plain(String(j.description||'View the original posting for the full description.')).slice(0,50000),Date.now(),'new').run();return result.meta.changes||0;
}
async function boardJobs(provider:string,slug:string) {
  const url=provider==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`:provider==='lever'?`https://api.lever.co/v0/postings/${slug}?mode=json`:`https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  const r=await fetch(url,{signal:AbortSignal.timeout(15000)}); if(!r.ok)throw new Error(`${provider}: ${r.status}`); const data:any=await r.json();
  if(provider==='greenhouse'&&!Array.isArray(data.jobs)||provider==='lever'&&!Array.isArray(data)||provider==='ashby'&&!Array.isArray(data.jobs))throw new Error('Invalid board response');
  return (provider==='lever'?data:data.jobs).map((j:any)=>({title:j.title||j.text,url:j.absolute_url||j.hostedUrl||j.jobUrl,location:j.location?.name||j.categories?.location||j.location,description:provider==='lever'?[j.descriptionPlain||j.description,...(j.lists||[]).map((l:any)=>l.text+'\n'+plain(l.content)),j.additionalPlain||j.additional].filter(Boolean).join('\n\n'):j.content||j.descriptionHtml||j.description}));
}
export function parseBoard(board:string) {
  const u=new URL(board); const slug=u.pathname.split('/').filter(Boolean)[0];if(!slug||!/^[a-zA-Z0-9_-]+$/.test(slug))throw new Error('Invalid board address');
  const provider=['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)?'greenhouse':u.hostname==='jobs.lever.co'?'lever':u.hostname==='jobs.ashbyhq.com'?'ashby':null;
  if(!provider)throw new Error('Use a Greenhouse, Lever or Ashby board URL');return {provider,slug};
}
export async function scan() {
  const lock=await db().prepare("INSERT INTO settings(key,value) VALUES('scanLock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?").bind(String(Date.now()+600000),Date.now()).run();if(!lock.meta.changes)return {newJobs:0,message:'A check is already running'};
  let count=0;
  try {
    const watches=await db().prepare('SELECT * FROM watches').all<any>();
    for(const w of watches.results) {
      try {
        if(!w.board) {
          if(!env.BRAVE_SEARCH_API_KEY) {await db().prepare('UPDATE watches SET message=? WHERE id=?').bind('Search service not configured · add a career board for direct checks',w.id).run();continue;}
          const discovered=await discoverJobs(w.company,w.role,env.BRAVE_SEARCH_API_KEY);let found=0;
          for(const job of discovered.jobs)found+=await insertJob(w,job);count+=found;
          await db().prepare('UPDATE watches SET last_check=?,message=? WHERE id=?').bind(Date.now(),`${discovered.jobs.length} verified matches · ${found} new${discovered.failed?' · some pages unavailable':''}`,w.id).run();continue;
        }
        const b=parseBoard(w.board);const jobs=await boardJobs(b.provider,b.slug); let found=0;for(const j of jobs) found+=await insertJob(w,j);count+=found;
        await db().prepare('UPDATE watches SET last_check=?,message=? WHERE id=?').bind(Date.now(),`${jobs.filter((j:any)=>matches(j.title,w.role)).length} matching roles · ${found} new`,w.id).run();
      } catch(e:any) { await db().prepare('UPDATE watches SET message=? WHERE id=?').bind('Check failed · '+e.message,w.id).run(); }
    }await notifyNew(count); await setSetting('lastRun',JSON.stringify({completedAt:Date.now(),newJobs:count})); return {newJobs:count};
  } finally { await setSetting('scanLock','0'); }
}
