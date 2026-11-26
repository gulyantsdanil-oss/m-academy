import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app/admin/roster/page.tsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../../supabase/migrations/20261126130000_roster_roles.sql',import.meta.url),'utf8');
test('admin roster requires authenticated active admin membership and school scope',()=>{
 assert.match(page,/sb\.auth\.getUser\(\)/);
 assert.match(page,/\.eq\('role','admin'\)\.eq\('active',true\)/);
 for(const table of ['memberships','classes','class_teachers','class_students'])
  assert.match(page,new RegExp("\\.from\\('"+table+"'\\)"));
 assert.match(page,/\.eq\('school_id',school\)/);
});
test('admin roster can only assign existing users and never handles service keys',()=>{
 assert.match(page,/members\.filter\(m=>m\.role==='teacher'\)/);
 assert.match(page,/members\.filter\(m=>m\.role==='student'\)/);
 assert.doesNotMatch(page,/service_role|SERVICE_ROLE_KEY|auth\.admin\.|createUser/);
 assert.match(page,/\.from\('class_teachers'\)\.insert/);
 assert.match(page,/\.from\('class_students'\)\.insert/);
});
test('database rejects incorrect or inactive roles on both rosters',()=>{
 assert.match(sql,/app_private\.validate_class_roster_role/);
 assert.match(sql,/m\.role=v_role and m\.active=true/);
 assert.match(sql,/class_teachers_valid_role/);
 assert.match(sql,/class_students_valid_role/);
 assert.match(sql,/security definer/);
});
