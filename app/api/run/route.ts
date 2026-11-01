import { scan } from '../../../lib/radar';
// Relies on Sites' owner-private dispatch boundary, including service access.
export async function POST() { return Response.json(await scan()); }
