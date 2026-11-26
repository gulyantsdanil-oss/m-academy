import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const path=new URL('../scripts/bootstrap.mjs',import.meta.url);
const source=readFileSync(path,'utf8');
const base={
 PILOT_ADMIN_EMAIL:'admin@example.test',
 PILOT_TEACHER_EMAIL:'teacher@example.test',
 PILOT_TEST_STUDENT_EMAIL:'student@example.test',
 PILOT_SCHOOL_NAME:'M-academy TEST SCHOOL',
 PILOT_CLASS:'9Т',PILOT_YEAR:'2026-2027'
};
function run(env,flags=[]){
 return spawnSync(process.execPath,[path.pathname,...flags],{
  encoding:'utf8',env:{...process.env,...base,...env},timeout:15000
 });
}
test('bootstrap dry run does not depend on service credentials',()=>{
 const r=run({SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''});
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/DRY RUN/);
 assert.match(r.stdout,/TEST SCHOOL/);
 assert.doesNotMatch(r.stdout,/TEST PILOT READY/);
});
test('bootstrap rejects actual school names and duplicate pilot account emails',()=>{
 const prod=run({PILOT_SCHOOL_NAME:'School 1'});
 assert.notEqual(prod.status,0);
 assert.match(prod.stderr,/TEST\/ТЕСТ/);
 const duplicate=run({PILOT_ADMIN_EMAIL:base.PILOT_TEACHER_EMAIL});
 assert.notEqual(duplicate.status,0);
 assert.match(duplicate.stderr,/three different/);
});
test('bootstrap never creates pilot without explicit flags and service credentials',()=>{
 const missing=run({SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},['--apply']);
 assert.notEqual(missing.status,0);
 assert.match(missing.stderr,/confirm-test-only/);
 const noKey=run({SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},['--apply','--confirm-test-only']);
 assert.notEqual(noKey.status,0);
 assert.match(noKey.stderr,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('bootstrap preflights duplicate school before first write',()=>{
 assert.match(source,/\.from\('schools'\)\.select\('id'\)\.eq\('name',schoolName\)/);
 assert.match(source,/Test school already exists/);
 assert.ok(source.indexOf("const existing=await db.from('schools')")<source.indexOf("const inserted=await db.from('schools')"));
});
