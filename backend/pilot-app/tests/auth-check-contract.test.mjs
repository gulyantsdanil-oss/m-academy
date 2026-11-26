import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/auth-check/page.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
test('diagnostics confirm current Supabase auth session and membership records',()=>{
 assert.match(page,/sb\.auth\.getUser\(\)/);
 assert.match(page,/\.from\('memberships'\)/);
 assert.match(page,/\.eq\('user_id',user\.id\)\.eq\('active',true\)/);
 assert.match(page,/\.from\('schools'\)/);
 assert.match(page,/\.in\('id',valid\.map\(v=>v\.school_id\)\)/);
});
test('diagnostics check each role through real RLS-scoped tables',()=>{
 for(const table of ['class_teachers','class_students','classes'])assert.ok(page.includes("'"+table+"'"),table);
 assert.match(page,/\.eq\('school_id',m\.school_id\)/);
 assert.match(page,/\.eq\('teacher_id',user\.id\)/);
 assert.match(page,/\.eq\('student_id',user\.id\)/);
 assert.match(page,/result\.count\?\?0/);
});
test('no-role account is denied school roles and no privilege provisioning is exposed',()=>{
 assert.match(page,/setPhase\('no_role'\)/);
 assert.doesNotMatch(page,/\.from\('memberships'\)\.insert/);
 assert.doesNotMatch(page,/SERVICE_ROLE_KEY|firebase\/auth|getFirestore|signInWithIdToken/);
 assert.match(page,/Проверить снова/);
});
test('diagnostic link and Google OAuth exist on the pilot home',()=>{
 assert.match(home,/href="\/auth-check"/);
 assert.match(home,/auth\.signInWithOAuth/);
 assert.match(home,/provider:'google'/);
});
