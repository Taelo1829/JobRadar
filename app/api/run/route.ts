import { scan } from '../../../lib/radar';
// Relies on Sites' owner-private dispatch boundary, including service access.
export async function POST(req:Request) {const body:any=await req.json().catch(()=>({}));return Response.json(await scan(typeof body.watchId==='string'?body.watchId:undefined)); }
