export const MATCH_WINDOW_MS=7*86400000;
export const APPLIED_WINDOW_MS=14*86400000;
export const visibleJobsSql="SELECT * FROM jobs WHERE (status='new' AND found_at>?) OR (status='applied' AND applied_at>=?) ORDER BY posted_at DESC, found_at DESC, id ASC";
export function visibleJob(job:{status:string;found_at:number;applied_at:number|null},now=Date.now()){
 return job.status==='new'?job.found_at>now-MATCH_WINDOW_MS:job.status==='applied'&&job.applied_at!==null&&job.applied_at>=now-APPLIED_WINDOW_MS;
}
