import { db, setting } from '../../../lib/radar';
// Owner-private Site only. The cloud task uses dispatch-issued service access.
export async function GET() { return Response.json({watches:(await db().prepare('SELECT * FROM watches').all()).results,schedule:await setting('schedule')||'pending',lastRun:JSON.parse(await setting('lastRun')||'null')},{headers:{'Cache-Control':'no-store'}}); }
export async function POST() { return Response.json({error:'Jobs are imported only through the configured search API.'},{status:410}); }
