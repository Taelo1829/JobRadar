import { db, setting, vapid, validPush, scan } from '../../../lib/radar';
import { getChatGPTUser } from '../../chatgpt-auth';
import { env } from 'cloudflare:workers';
export async function GET() {
  if(!await getChatGPTUser())return Response.json({error:'Sign in to continue'},{status:401});
  const [w,j,s]=await Promise.all([db().prepare('SELECT * FROM watches ORDER BY company').all(),db().prepare("SELECT * FROM jobs WHERE status='new' OR (status='applied' AND applied_at>=?) ORDER BY found_at DESC").bind(Date.now()-14*86400000).all(),setting('schedule')]);
  const checks=await db().prepare("SELECT * FROM source_checks WHERE source IN ('jsearch','headcount')").all<any>();
  return Response.json({watches:w.results.map((watch:any)=>({...watch,sourceChecks:checks.results.filter(c=>c.watch_id===watch.id)})),jobs:j.results,schedule:env.SCHEDULER_ENABLED==='true'?'active':'pending',searchConfigured:!!(env.JSEARCH_API_KEY||env.HEADCOUNT_API_KEY),indexedConfigured:!!env.JSEARCH_API_KEY,pushError:await setting('pushError')},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request) {
  if(!await getChatGPTUser())return Response.json({error:'Sign in to continue'},{status:401});
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});
  try {
    const b:any=await req.json();
    if(b.action==='watch') {
      const company=String(b.company||'').trim(),role=String(b.role||'').trim();if(!company||!role||company.length>100||role.length>120)throw new Error('Enter a company and job role');if(b.board)throw new Error('Custom career boards are no longer supported');
      const exists=await db().prepare('SELECT id FROM watches WHERE lower(company)=lower(?) AND lower(role)=lower(?)').bind(company,role).first();if(exists)throw new Error('You are already tracking this company and role');
      const n=await db().prepare('SELECT count(*) AS n FROM watches').first<any>();if(n.n>=20)throw new Error('You can track up to 20 searches');
      const id=crypto.randomUUID();await db().prepare('INSERT INTO watches(id,company,role,board,message) VALUES(?,?,?,?,?)').bind(id,company,role,'','Checking for initial matches…').run();
      try {const initial=await scan(id);return Response.json({id,initial});}
      catch {return Response.json({id,initial:{newJobs:0,message:'Search saved. The first check could not finish; use Check now to retry. Future scheduled checks remain active.'}});}
    }
    if(b.action==='remove')await db().batch([db().prepare('DELETE FROM source_checks WHERE watch_id=?').bind(b.id),db().prepare('DELETE FROM watches WHERE id=?').bind(b.id)]);
    else if(b.action==='status') { if(!['new','applied','dismissed'].includes(b.status))throw new Error('Invalid status');await db().prepare('UPDATE jobs SET status=?,applied_at=? WHERE id=?').bind(b.status,b.status==='applied'?Date.now():null,b.id).run(); }
    else if(b.action==='subscribe') { if(!validPush(b.endpoint)){let host='unknown';try{host=new URL(b.endpoint).hostname;}catch{}throw new Error('Notifications are unavailable with this browser provider ('+host+'). Open Job Radar in Chrome, Edge, Firefox or Safari to enable push alerts.');}await db().prepare('INSERT OR IGNORE INTO subscriptions(endpoint,created_at) VALUES(?,?)').bind(b.endpoint,Date.now()).run(); }
    else if(b.action==='subscriptionStatus')return Response.json({registered:!!(await db().prepare('SELECT endpoint FROM subscriptions WHERE endpoint=?').bind(String(b.endpoint||'')).first())});
    else if(b.action==='unsubscribe')await db().prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(b.endpoint).run();
    else if(b.action==='pushKey')return Response.json({key:(await vapid()).publicKey});
    else throw new Error('Unknown action');return Response.json({ok:true});
  }catch(e:any){return Response.json({error:e.message},{status:400});}
}
