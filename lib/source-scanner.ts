import {extractJobs,parseStructuredJson} from './search';
import {jobSearchUrl} from './job-sources';
export const SOURCE_IDS=['pnet','careerjunction'] as const;
export const MAX_DETAILS=6;
const origins={pnet:'https://www.pnet.co.za',careerjunction:'https://www.careerjunction.co.za'};
export type SourceId=keyof typeof origins;
export function sourceSearchUrl(source:SourceId,company:string,role:string){
 if(source==='careerjunction'){const u=new URL('/jobs/results',origins[source]);u.searchParams.set('keywords',company+' '+role);return u.href;}
 return jobSearchUrl(source,company,role);
}
export function detailLinks(html:string,source:SourceId){
 const links=new Set<string>();
 for(const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi))try{
  const u=new URL(match[1].replace(/&amp;/g,'&'),origins[source]);
  if(u.origin!==origins[source])continue;
  if(source==='pnet'?!/^\/jobs--.+--\d+(?:-inline)?\.html$/.test(u.pathname):!/-job-\d+\.aspx$/.test(u.pathname))continue;
  u.search='';u.hash='';links.add(u.href);
 }catch{}
 return [...links];
}
export async function sourcePage(url:string,source:SourceId,fetcher:typeof fetch=fetch){
 for(let n=0;n<4;n++){
  const u=new URL(url);if(u.origin!==origins[source])throw new Error('Source redirected to an unsupported host');
  const r=await fetcher(u,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html','User-Agent':'JobRadar/1.0 (personal job opportunity tracker)'}});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw new Error('Invalid source redirect');url=new URL(location,u).href;continue;}
  if(!r.ok){await r.body?.cancel();throw new Error(`Source returned HTTP ${r.status}`);}
  const reader=r.body?.getReader();if(!reader)throw new Error('Empty source response');let html='',size=0;const decoder=new TextDecoder();
  while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>3000000){await reader.cancel();throw new Error('Source response too large');}html+=decoder.decode(chunk.value,{stream:true});}html+=decoder.decode();
  if(/<title[^>]*>[^<]*(access denied|security check|just a moment|captcha)/i.test(html))throw new Error('Source requires a browser security check');
  return {html,url:u.href};
 }throw new Error('Too many source redirects');
}
export async function scanSource(source:SourceId,company:string,role:string,fetcher:typeof fetch=fetch){
 const list=await sourcePage(sourceSearchUrl(source,company,role),source,fetcher);
 const all=detailLinks(list.html,source),links=all.slice(0,MAX_DETAILS);let unavailable=0;const jobs:any[]=[];
 if(!all.length){
  const empty=/no (?:jobs|results|vacancies|matching)|0 (?:jobs|results)|did not match|couldn.t find|no exact matches/i.test(list.html);
  return {jobs,status:empty?'ok':'unavailable',message:empty?'No matching results on the source search page':'No readable job links returned; source may have changed'};
 }
 for(const url of links)try{
  const page=await sourcePage(url,source,fetcher);
  const schemas=[...page.html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const readable=schemas.some(m=>{try{return JSON.stringify(parseStructuredJson(m[1])).includes('JobPosting');}catch{return false;}});
  if(!readable){unavailable++;continue;}
  jobs.push(...extractJobs(page.html,page.url,company,role));
 }catch{unavailable++;}
 return {jobs,status:unavailable||all.length>MAX_DETAILS?'partial':'ok',message:`${jobs.length} verified matches · checked ${links.length} listings${all.length>MAX_DETAILS?' (first page, limited sample)':''}${unavailable?` · ${unavailable} unavailable`:''}`};
}
