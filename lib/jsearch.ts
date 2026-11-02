import {normalCompany,publicUrl} from './search';

export function postingDate(job:any,now=Date.now()):number|null {
 const iso=typeof job.job_posted_at_datetime_utc==='string'&&/^\d{4}-\d{2}-\d{2}(T|$)/.test(job.job_posted_at_datetime_utc)?Date.parse(job.job_posted_at_datetime_utc):NaN;
 const seconds=typeof job.job_posted_at_timestamp==='number'?job.job_posted_at_timestamp:NaN;
 for(const value of [iso,seconds*1000])if(Number.isFinite(value)&&value>0&&value<=now)return value;
 return null;
}
export function indexedJobs(rows:any[],company:string,role:string,now=Date.now()) {
 const jobs:any[]=[];
 for(const j of rows){
  if(normalCompany(String(j.employer_name||''))!==normalCompany(company))continue;
  if(!role.toLowerCase().split(/\s+/).filter(Boolean).every(w=>String(j.job_title||'').toLowerCase().includes(w)))continue;
  if(j.job_offer_expiration_datetime_utc&&Date.parse(j.job_offer_expiration_datetime_utc)<now)continue;
  try{const url=publicUrl(j.job_apply_link).href;jobs.push({title:j.job_title,url,posted_at:postingDate(j,now),description:j.job_description||'',location:j.job_location||[j.job_city,j.job_state,j.job_country].filter(Boolean).join(', ')||(j.job_is_remote?'Remote':'Location not listed')});}catch{}
 }
 return jobs;
}
export async function searchIndexedJobs(company:string,role:string,key:string,fetcher:typeof fetch=fetch){
 const url=new URL('https://api.openwebninja.com/jsearch/search-v2');
 url.search=new URLSearchParams({query:`${role} at ${company} in South Africa`,country:'za',num_pages:'1'}).toString();
 const r=await fetcher(url,{headers:{'x-api-key':key,Accept:'application/json'},signal:AbortSignal.timeout(30000),redirect:'manual'});
 if(!r.ok){await r.body?.cancel();throw new Error(r.status===429?'JSearch quota or rate limit reached':r.status===401||r.status===403?'JSearch key or subscription needs attention':`JSearch unavailable (HTTP ${r.status})`);}
 const data:any=await r.json();const rows=Array.isArray(data.data)?data.data:data.data?.jobs;
 if(!Array.isArray(rows))throw new Error('JSearch returned an unreadable response');
 return {jobs:indexedJobs(rows,company,role),message:'Indexed results via JSearch · first page only; coverage varies by publisher'};
}

