import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const supabase=readFileSync(new URL('../lib/supabase.ts',import.meta.url),'utf8');
test('Google sign-in is delegated to configured Supabase OAuth provider',()=>{
 assert.match(home,/auth\.signInWithOAuth\(\{/);
 assert.match(home,/provider:'google'/);
 assert.match(home,/new URL\('\/',window\.location\.origin\)\.toString\(\)/);
 assert.match(home,/queryParams:\{prompt:'select_account'\}/);
 assert.match(home,/Войти через Google/);
});
test('existing passwordless sign-in stays invitation only',()=>{
 assert.match(home,/auth\.signInWithOtp/);
 assert.match(home,/shouldCreateUser:false/);
});
test('Google sign-in never grants roles from email, claims or ECO CLUB Firestore',()=>{
 assert.match(home,/\.from\('memberships'\)/);
 assert.match(home,/\.eq\('user_id',user\.id\)\.eq\('active',true\)/);
 assert.doesNotMatch(home,/\.from\('memberships'\)\.insert/);
 assert.doesNotMatch(home,/from\s+['\"](?:firebase|@firebase)|signInWithIdToken\(|getFirestore\(/i);
 assert.doesNotMatch(supabase,/SERVICE_ROLE|service_role/i);
});
test('OAuth error is displayed without persisting credentials or arbitrary redirect URL',()=>{
 assert.match(home,/setError\('Вход через Google недоступен:/);
 assert.doesNotMatch(home,/localStorage\.setItem/);
 assert.doesNotMatch(home,/window\.location\.search/);
});
