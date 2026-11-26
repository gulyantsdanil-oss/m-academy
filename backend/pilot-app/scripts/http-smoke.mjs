#!/usr/bin/env node
// Black-box probe of a running production build. Never uses school accounts.
import assert from 'node:assert/strict';
const root=(process.argv[2]||'http://127.0.0.1:3117').replace(/\/+$/,'');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let alive=false;
for(let i=0;i<60;i++){
 try{
  const res=await fetch(root+'/api/health',{redirect:'manual',signal:AbortSignal.timeout(2000)});
  if(res.ok){alive=true;break}
 }catch{}
 await delay(500);
}
assert.ok(alive,'Next.js did not start a working liveness endpoint');
const health=await fetch(root+'/api/health',{redirect:'manual'});
assert.equal(health.status,200);
assert.match(health.headers.get('cache-control')||'',/no-store/i);
const raw=await health.text();
assert.deepEqual(JSON.parse(raw),{status:'ok',service:'m-academy-pilot'});
assert.doesNotMatch(raw,/supabase|secret|token|email|school_id/i);
for(const route of ['/','/auth-check','/admin/roster','/curriculum','/lessons','/classes','/results','/help']){
 const res=await fetch(root+route,{redirect:'manual',signal:AbortSignal.timeout(10000)});
 assert.equal(res.status,200,route+' HTTP '+res.status);
 const body=await res.text();
 assert.match(body,/<html/i,route+' should render HTML');
 assert.match(body,/M-academy/i,route+' title missing');
 console.log('OK',route,'HTTP',res.status);
}
console.log('Pilot production HTTP smoke passed: health + 8 server-rendered routes');
