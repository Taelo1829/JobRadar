import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
fs.mkdirSync('outputs/source-tests',{recursive:true});
for(const name of ['search','job-sources','source-scanner','jsearch']){
 const source=fs.readFileSync(`lib/${name}.ts`,'utf8').replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
 fs.writeFileSync(`outputs/source-tests/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
const {indexedJobs,searchIndexedJobs,postingDate}=await import('../outputs/source-tests/jsearch.mjs');
const {detailLinks,scanSource,sourcePage}=await import('../outputs/source-tests/source-scanner.mjs');
const job={employer_name:'Example Ltd',job_title:'Software Engineer',job_apply_link:'https://example.com/jobs/1',job_description:'Build tools'};
assert.equal(indexedJobs([job],'Example','engineer').length,1);
for(const altered of [{employer_name:'Other'},{job_title:'Designer'},{job_apply_link:'javascript:alert(1)'},{job_offer_expiration_datetime_utc:'2000-01-01'}])assert.equal(indexedJobs([{...job,...altered}],'Example','engineer').length,0);
let calls=0;
const result=await searchIndexedJobs('Example','engineer','test',async(u,options)=>{calls++;assert.equal(new URL(u).searchParams.get('num_pages'),'1');assert.equal(options.headers['x-api-key'],'test');return Response.json({data:{jobs:[job],cursor:'next'}});});
assert.equal(result.jobs.length,1);assert.equal(calls,1);
await assert.rejects(()=>searchIndexedJobs('Example','engineer','test',async()=>new Response('',{status:429})),/quota/);
await assert.rejects(()=>searchIndexedJobs('Example','engineer','test',async()=>Response.json({data:{}})),/unreadable/);
const link='https://www.pnet.co.za/jobs--Engineer--123-inline.html';
assert.deepEqual(detailLinks(`<a href="${link}">job</a><a href="https://evil.example/jobs--Engineer--456.html">bad</a>`,'pnet'),[link]);
const schema={ '@type':'JobPosting',title:'Software Engineer',hiringOrganization:{name:'Example'},description:'first\nsecond',validThrough:'2099-01-01'};
const html='<script type="application/ld+json">'+JSON.stringify(schema).replace('first\\nsecond','first\nsecond')+'</script>';
const direct=await scanSource('pnet','Example','engineer',async u=>new Response(String(u)===link?html:`<a href="${link}">job</a>`));
assert.equal(direct.jobs.length,1);assert.equal(direct.status,'ok');
await assert.rejects(()=>sourcePage(link,'pnet',async()=>new Response('',{status:302,headers:{Location:'https://evil.example'}})),/unsupported host/);
assert.equal((await scanSource('pnet','Example','engineer',async()=>new Response('<title>Unrecognized site</title>'))).status,'unavailable');
console.log('PASS: direct and indexed imports, employer/title/expiry/URL filtering, malformed publisher JSON, quota errors, redirect restrictions and coverage reporting.');

const now=Date.UTC(2026,10,2);
assert.equal(postingDate({job_posted_at_datetime_utc:'2026-10-20T10:00:00Z'},now),Date.UTC(2026,9,20,10));
assert.equal(postingDate({job_posted_at_timestamp:1792440000},now),1792440000000);
assert.equal(postingDate({job_posted_at_datetime_utc:'bad',job_posted_at_timestamp:1792440000},now),1792440000000);
for(const j of [{},{job_posted_at:'3 days ago'},{job_posted_at_timestamp:0},{job_posted_at_datetime_utc:'2099-01-01'},{job_posted_at_timestamp:1792440000000}])assert.equal(postingDate(j,now),null);
assert.equal(indexedJobs([{...job,job_posted_at_datetime_utc:'2026-10-20T10:00:00Z'}],'Example','engineer',now)[0].posted_at,Date.UTC(2026,9,20,10));
console.log('PASS: posting-date mapping, timestamp fallback, missing/invalid/future dates.');
