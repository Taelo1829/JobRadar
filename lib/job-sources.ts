export const DEFAULT_JOB_SOURCES = [
  {id:'linkedin',name:'LinkedIn Jobs',url:'https://www.linkedin.com/jobs/'},
  {id:'indeed',name:'Indeed South Africa',url:'https://za.indeed.com/'},
  {id:'pnet',name:'PNet',url:'https://www.pnet.co.za/'},
  {id:'careerjunction',name:'CareerJunction',url:'https://www.careerjunction.co.za/'}
] as const;
export function jobSearchUrl(id:string,company='',role='') {
  const source=DEFAULT_JOB_SOURCES.find(s=>s.id===id);if(!source)throw new Error('Unknown job source');
  const terms=[company.trim(),role.trim()].filter(Boolean).join(' ');if(!terms)return source.url;
  if(id==='linkedin'){const u=new URL('https://www.linkedin.com/jobs/search/');u.searchParams.set('keywords',terms);u.searchParams.set('location','South Africa');return u.href;}
  if(id==='indeed'){const u=new URL('https://za.indeed.com/jobs');u.searchParams.set('q',terms);return u.href;}
  return source.url+'jobs/'+encodeURIComponent(terms.toLowerCase().replace(/\s+/g,'-'));
}
