import {normalCompany,publicUrl} from './search';
import {postingDate,isSouthAfrica} from './jsearch';
const value=(field:any)=>field?.state==='known'?field.value:undefined;
export function headcountJobs(rows:any[],company:string,role:string){
 const jobs:any[]=[];
 for(const row of rows){
  const locations=(row.locations||[]).map(value).filter((l:any)=>l&&isSouthAfrica(l.country));
  if(!locations.length)continue;
  const title=value(row.title),employer=value(row.employer_name);
  if(row.currentness!=='current'||typeof title!=='string'||typeof employer!=='string'||normalCompany(employer)!==normalCompany(company))continue;
  if(!role.toLowerCase().split(/\s+/).filter(Boolean).every(w=>title.toLowerCase().includes(w)))continue;
  for(const posting of row.postings||[]){
   if(value(posting.location)?.country&&!isSouthAfrica(value(posting.location).country))continue;
   if(posting.posting_status!=='listed'||['closed','broken'].includes(posting.latest_application_check?.result))continue;
   try{
    const url=publicUrl(value(posting.posting_url)||value(posting.application_url)).href;
    let description=value(row.description)||'';
    if(posting.attribution?.required){description+='\n\n'+String(posting.attribution.text||'');if(posting.attribution.link)description+='\n'+publicUrl(posting.attribution.link).href;}
    const location=locations.map((l:any)=>[l.city,l.region,l.country].filter(Boolean).join(', ')).filter(Boolean).join(' / ');
    jobs.push({title,url,description,location:location||'Location not listed',posted_at:postingDate({job_posted_at_datetime_utc:posting.source_posted_at})});break;
   }catch{}
  }
 }
 return jobs;
}
export async function searchHeadcount(company:string,role:string,key:string,fetcher:typeof fetch=fetch){
 const url=new URL('https://api.headcountlabs.com/v1/jobs');
 url.search=new URLSearchParams({company,title:role,country:'ZA',currentness:'current',limit:'25'}).toString();
 const r=await fetcher(url,{headers:{Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(30000),redirect:'manual'});
 if(!r.ok){await r.body?.cancel();throw new Error(`Headcount Labs unavailable (HTTP ${r.status})`);}
 const data:any=await r.json();if(!Array.isArray(data.data))throw new Error('Headcount Labs returned an unreadable response');
 return {jobs:headcountJobs(data.data,company,role),message:'Headcount Labs API results; first page only'};
}
