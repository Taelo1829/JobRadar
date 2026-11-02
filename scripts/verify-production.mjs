import fs from 'node:fs';
import assert from 'node:assert/strict';
const {url}=JSON.parse(fs.readFileSync('cloudflare-deployment.json','utf8'));
const password=fs.readFileSync('.env.local','utf8').match(/^APP_PASSWORD=(.+)$/m)[1];
const headers={Authorization:'Basic '+Buffer.from('owner:'+password).toString('base64'),Origin:url,'Content-Type':'application/json'};
async function api(path,body){const r=await fetch(url+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});assert.equal(r.status,200,path);return r.json();}
assert.equal((await fetch(url)).status,401);
const page=await fetch(url,{headers});assert.equal(page.status,200);const html=await page.text();
for(const name of ['LinkedIn Jobs','Indeed South Africa','PNet','CareerJunction'])assert.ok(html.includes(name),name);
assert.equal((await fetch(url+'/sw.js',{headers})).status,200);
let id;
try {
 const created=await api('/api/data',{action:'watch',company:'Temporary verification '+crypto.randomUUID(),role:'Verification only',board:''});id=created.id;assert.ok(id);
 const state=await api('/api/data');assert.ok(state.watches.some(w=>w.id===id));assert.equal(state.schedule,'active');
 assert.equal(state.indexedConfigured,true);
 const scan=await api('/api/run',{});assert.ok(!scan.message.includes('could not complete'),scan.message);
 const checked=(await api('/api/data')).watches.find(w=>w.id===id);
 assert.equal(checked.sourceChecks.length,4);
 console.log('Live source checks:',JSON.stringify(checked.sourceChecks.map(c=>({source:c.source,status:c.status,message:c.message}))));
 for(const source of ['linkedin','indeed'])assert.equal(checked.sourceChecks.find(c=>c.source===source).status,'partial');
 const status=await api('/api/automation');assert.ok(status.lastRun.completedAt>Date.now()-60000);
}finally{if(id)await api('/api/data',{action:'remove',id});}
console.log('PASS: live source status, authentication, search save/read/remove, JSearch, backend fan-out and service worker. Temporary search removed.');
