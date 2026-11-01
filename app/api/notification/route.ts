import { setting } from '../../../lib/radar';
export async function GET() { return Response.json(JSON.parse(await setting('notification')||'{"title":"Job Radar","body":"New opportunities are ready to review."}'),{headers:{'Cache-Control':'no-store'}}); }
