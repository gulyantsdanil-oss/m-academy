import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const health=readFileSync(new URL('../app/api/health/route.ts',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../scripts/http-smoke.mjs',import.meta.url),'utf8');
const config=readFileSync(new URL('../next.config.mjs',import.meta.url),'utf8');
const ci=readFileSync(new URL('../../../.github/workflows/pilot-ci.yml',import.meta.url),'utf8');

test('liveness route returns only public fixed fields and disables caching',()=>{
 assert.match(health,/force-dynamic/);
 assert.match(health,/Cache-Control.*no-store/);
 assert.match(health,/status:'ok',service:'m-academy-pilot'/);
 assert.doesNotMatch(health,/process\.env|createClient|SERVICE_ROLE_KEY|cookies\(/);
});
test('production smoke tests key pages with unauthenticated pilot',()=>{
 for(const route of ['/api/health','/auth-check','/admin/roster','/curriculum','/lessons','/classes','/results','/help']){
  assert.ok(smoke.includes(route),'missing smoke route '+route);
 }
 assert.match(smoke,/assert\.equal\(res\.status,200/);
 assert.match(ci,/Smoke test production Next\.js server and routes/);
 assert.match(ci,/node scripts\/http-smoke\.mjs/);
});
test('undeployed school pilot has protective HTTP headers',()=>{
 assert.match(config,/X-Content-Type-Options/);
 assert.match(config,/X-Frame-Options/);
 assert.match(config,/X-Robots-Tag/);
 assert.match(config,/noindex, nofollow/);
});
