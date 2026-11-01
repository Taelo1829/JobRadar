import { db, insertJob, notifyNew, setSetting, parseBoard } from '../../../lib/radar';
// Owner-private Site only. The cloud task uses dispatch-issued service access.
export async function GET() { return Response.json({watches:(await db().prepare('SELECT * FROM watches').all()).results},{headers:{'Cache-Control':'no-store'}}); }
export async function POST(req:Request) {
  try {
    const b:any=await req.json();if(b.schedule) { if(b.schedule!=='active')throw new Error('Invalid schedule');await setSetting('schedule','active');return Response.json({ok:true}); }
    const w=await db().prepare('SELECT * FROM watches WHERE id=?').bind(b.watchId).first<any>();if(!w)throw new Error('Search not found');
    if(b.board) { parseBoard(b.board);await db().prepare('UPDATE watches SET board=? WHERE id=?').bind(b.board,w.id).run(); }
    if(!Array.isArray(b.jobs)||b.jobs.length>100)throw new Error('Expected up to 100 verified jobs');let added=0;for(const j of b.jobs)added+=await insertJob(w,j);
    await db().prepare('UPDATE watches SET last_check=?,message=? WHERE id=?').bind(Date.now(),String(b.message||`${b.jobs.length} matches from web search · ${added} new`).slice(0,500),w.id).run();await notifyNew(added);return Response.json({added});
  }catch(e:any){return Response.json({error:e.message},{status:400});}
}
