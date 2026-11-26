import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app/results/page.tsx',import.meta.url),'utf8');
test('results authenticate and load active memberships',()=>{
 assert.match(source,/api\.auth\.getUser\(\)/);
 assert.match(source,/\.from\('memberships'\)/);
 assert.match(source,/\.eq\('user_id',uid\)\.eq\('active',true\)/);
 assert.match(source,/m\.role==='teacher'\|\|m\.role==='student'/);
});
test('results query is tenant- and teacher-scoped',()=>{
 assert.match(source,/\.eq\('school_id',schoolId\)\.eq\('teacher_id',userId\)/);
 assert.match(source,/\.eq\('school_id',schoolId\)\.eq\('published',true\)/);
 assert.match(source,/\.from\('submissions'\)/);
 assert.match(source,/\.from\('submission_grades'\)/);
 assert.match(source,/\.eq\('school_id',schoolId\)/);
 assert.match(source,/offset\+=60/);
});
test('results do not expose answer keys or allow grades to be written',()=>{
 assert.doesNotMatch(source,/\.from\('assignment_keys'\)/);
 assert.doesNotMatch(source,/\.from\('submission_grades'\)\.update/);
 assert.doesNotMatch(source,/\.from\('submission_grades'\)\.insert/);
});
