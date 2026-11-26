import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const release=readFileSync(new URL('../../../.github/workflows/pilot-image-release.yml',import.meta.url),'utf8');
test('publishing requires explicit TEST-ONLY confirmation and main branch',()=>{
 assert.match(release,/workflow_dispatch:/);
 assert.match(release,/inputs\.confirmation == 'TEST-ONLY'/);
 assert.match(release,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(release,/^  push:/m);
 assert.doesNotMatch(release,/^  schedule:/m);
});
test('release only embeds public build variables and no service-role credentials',()=>{
 assert.match(release,/vars\.PILOT_SUPABASE_URL/);
 assert.match(release,/vars\.PILOT_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(release,/vars\.PILOT_SITE_URL/);
 assert.doesNotMatch(release,/SUPABASE_SERVICE_ROLE_KEY|FIREBASE_PRIVATE_KEY|sb_secret_/);
 assert.match(release,/node scripts\/oauth-preflight\.mjs/);
});
test('publishing is gated on actual Docker runtime and HTTP tests',()=>{
 const build=release.indexOf('docker build');
 const smoke=release.indexOf('scripts/http-smoke.mjs');
 const login=release.indexOf('docker/login-action@v3');
 const push=release.indexOf('docker push');
 assert.ok(build>0&&smoke>build&&login>smoke&&push>login);
 assert.match(release,/docker exec m-academy-staging-smoke id -u/);
 assert.match(release,/packages: write/);
 assert.match(release,/ghcr\.io/);
});
