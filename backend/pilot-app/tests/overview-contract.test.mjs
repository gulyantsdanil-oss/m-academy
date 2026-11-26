import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const file=readFileSync(join(root,'app/overview/page.tsx'),'utf8');
test('overview requires authenticated user and active membership',()=>{
 assert.match(file,/auth\.getUser\(\)/);
 assert.match(file,/\.from\('memberships'\)/);
 assert.match(file,/\.eq\('user_id',auth\.user\.id\)/);
 assert.match(file,/\.eq\('active',true\)/);
});
test('each list is school-scoped',()=>{
 const sections=['classes','class_teachers','class_students','curriculum_plans','lesson_drafts','ksp_documents','assignments'];
 for(const name of sections){
  const line=file.split('\n').find(line=>line.includes(".from('"+name+"')"));
  assert.ok(line,'Missing table '+name);
  assert.match(line,/\.eq\('school_id',school\)/,'Missing school filter for '+name);
 }
});
test('teacher-only materials are filtered by teacher identity',()=>{
 for(const name of ['curriculum_plans','lesson_drafts','ksp_documents']){
  const line=file.split('\n').find(line=>line.includes(".from('"+name+"')"));
  assert.match(line,/role==='teacher'/);
  assert.match(line,/\.eq\('teacher_id',identity\)/);
 }
});
test('student overview does not query restricted keys or grade tables',()=>{
 assert.doesNotMatch(file,/\.from\('assignment_keys'\)/);
 assert.doesNotMatch(file,/\.from\('submission_grades'\)/);
 assert.doesNotMatch(file,/\.from\('submission_answers'\)/);
});
test('data displayed is restricted to accessible classes and no static demo impersonation',()=>{
 assert.match(file,/permitted\.has\(a\.class_id\)/);
 assert.match(file,/classes\.filter\(c=>permitted\.has\(c\.id\)\)/);
 assert.doesNotMatch(file,/setRole\(/);
});

test('v3.1 KTP import remains preview-only until explicit teacher save',()=>{
 const src=readFileSync(join(root,'components/TeacherMaterials.tsx'),'utf8');
 assert.match(src,/value\.version===1&&Array\.isArray\(value\.topics\)/);
 assert.match(src,/validMaterial\('ktp',data\)/);
 assert.match(src,/setEditor\(stringify\(chosen\.data\)\)/);
 assert.match(src,/setSelected\(''\)/);
 assert.match(src,/api\.from\(tableFor\(kind\)\)\.insert\(base\)/);
});
