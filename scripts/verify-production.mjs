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
 await api('/api/run',{});
 const status=await api('/api/automation');assert.ok(status.lastRun.completedAt>Date.now()-60000);
}finally{if(id)await api('/api/data',{action:'remove',id});}
console.log('PASS: live default links, authentication, search save/read/remove, backend checks and service worker. Temporary search removed.');
