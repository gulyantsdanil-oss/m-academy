import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {analyzeDeployment} from '../scripts/oauth-preflight-lib.mjs';
const good={siteUrl:'https://academy.example.kz/',supabaseUrl:'https://demo-project.supabase.co/',publicKey:'sb_publishable_abcD123456'};
test('preflight accepts independent HTTPS app and Supabase origins and calculates correct URLs',()=>{
 const out=analyzeDeployment(good);
 assert.equal(out.ok,true,JSON.stringify(out.issues));
 assert.equal(out.callback,'https://demo-project.supabase.co/auth/v1/callback');
 assert.equal(out.returnTo,'https://academy.example.kz/');
});
test('rejects GitHub Pages and insecure public app origins',()=>{
 assert.equal(analyzeDeployment({...good,siteUrl:'https://test.github.io/'}).ok,false);
 assert.equal(analyzeDeployment({...good,siteUrl:'http://academy.example.kz/'}).ok,false);
 assert.equal(analyzeDeployment({...good,siteUrl:'http://localhost:3000/'}).ok,false);
});
test('rejects URL credentials and attacker-supplied query or paths',()=>{
 for(const siteUrl of ['https://user:password@academy.example.kz/','https://academy.example.kz/?next=https://evil.example/',
  'https://academy.example.kz/auth/callback','javascript:alert(1)']){
  assert.equal(analyzeDeployment({...good,siteUrl}).ok,false,siteUrl);
 }
});
test('rejects service-role keys, permits legacy anon JWT and hides key in output',()=>{
 assert.equal(analyzeDeployment({...good,publicKey:'sb_secret_testkey'}).ok,false);
 const makeJwt=role=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.equal(analyzeDeployment({...good,publicKey:makeJwt('service_role')}).ok,false);
 assert.equal(analyzeDeployment({...good,publicKey:makeJwt('anon')}).ok,true);
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:good.supabaseUrl,NEXT_PUBLIC_SUPABASE_ANON_KEY:good.publicKey};
 const out=spawnSync(process.execPath,['scripts/oauth-preflight.mjs','--site-url='+good.siteUrl],{
  cwd:process.cwd(),encoding:'utf8',env,timeout:15000
 });
 assert.equal(out.status,0,out.stderr);
 assert.doesNotMatch(out.stdout+out.stderr,/sb_publishable_abcD123456/);
 assert.match(out.stdout,/auth\/v1\/callback/);
});
