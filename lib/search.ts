// Search results are discovery hints only. Import only an employer-matching JobPosting.
export const normalCompany=(s:string)=>s.toLowerCase().replace(/\b(incorporated|inc|limited|ltd|llc|corporation|corp|pty)\b/g,'').replace(/[^a-z0-9]/g,'');
export function publicUrl(value:string) {
  const u=new URL(value);const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||/^\d/.test(host)||host.includes(':')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.localhost')||host==='localhost')throw new Error('Unsupported source URL');
  return u;
}
export function extractJobs(html:string,source:string,company:string,role:string,now=Date.now()) {
  const jobs:any[]=[];const visit=(value:any)=>{
    if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}
    const type=Array.isArray(value['@type'])?value['@type']:[value['@type']];
    if(type.includes('JobPosting')&&normalCompany(value.hiringOrganization?.name||'')===normalCompany(company)&&role.toLowerCase().split(/\s+/).filter(Boolean).every(word=>String(value.title||'').toLowerCase().includes(word))) {
      if(value.validThrough&&Date.parse(value.validThrough)<now)return;
      const locations=Array.isArray(value.jobLocation)?value.jobLocation:[value.jobLocation];
      const location=locations.map((l:any)=>[l?.address?.addressLocality,l?.address?.addressRegion,l?.address?.addressCountry].filter(Boolean).join(', ')).filter(Boolean).join(' / ')||(value.jobLocationType==='TELECOMMUTE'?'Remote':'Location not listed');
      jobs.push({title:value.title,url:source,location,description:value.description||''});
    }
    if(value['@graph'])visit(value['@graph']);
  };
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(match[1]));}catch{}
  return jobs;
}
async function readPage(url:string) {
  for(let n=0;n<4;n++){
    const safe=publicUrl(url);const response=await fetch(safe,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html','User-Agent':'JobRadar/1.0 (job opportunity tracker)'}});
    if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw new Error('Invalid redirect');url=new URL(location,safe).href;continue;}
    if(!response.ok)throw new Error('Source unavailable');
    const reader=response.body?.getReader();if(!reader)throw new Error('Empty source');let html='',size=0;const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('Source too large');}html+=decoder.decode(value,{stream:true});}html+=decoder.decode();return {html,url:safe.href};
  }throw new Error('Too many redirects');
}
export async function discoverJobs(company:string,role:string,key:string) {
  const query=`"${company.replace(/"/g,'')}" "${role.replace(/"/g,'')}" job careers`;
  const response=await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(query)+'&count=10',{headers:{'X-Subscription-Token':key,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Search provider returned ${response.status}`);const result:any=await response.json();let failed=0;const jobs:any[]=[];
  for(const hit of (result.web?.results||[]).slice(0,10))try{const page=await readPage(hit.url);jobs.push(...extractJobs(page.html,page.url,company,role));}catch{failed++;}
  return {jobs,failed};
}
