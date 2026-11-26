import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../../supabase/migrations/',import.meta.url);
const initial=readFileSync(new URL('20261123090000_initial.sql',base),'utf8');
const submissions=readFileSync(new URL('20261123100000_atomic_submissions.sql',base),'utf8');
const policy=(name)=>new RegExp('create\\s+policy\\s+'+name+'\\s+on\\s+public\\.','i');

test('All sensitive tables have row level security enabled',()=>{
 const names=['schools','memberships','classes','class_teachers','class_students',
 'curriculum_plans','lesson_drafts','ksp_documents','assignments',
 'assignment_questions','assignment_keys','submissions','submission_answers','submission_grades'];
 for(const name of names){
  assert.match(initial,new RegExp('alter\\s+table\\s+public\\.'+name+'\\s+enable\\s+row\\s+level\\s+security','i'),name);
 }
});
test('Only teacher can access answer key policies; no membership self-provisioning',()=>{
 assert.match(initial,policy('keys_teacher_all'));
 assert.doesNotMatch(initial,/create\s+policy\s+\S*student\S*\s+on\s+public\.assignment_keys/i);
 assert.doesNotMatch(initial,/grant\s+insert\s+on\s+public\.memberships\s+to\s+authenticated/i);
 assert.doesNotMatch(initial,/grant\s+update\s+on\s+public\.memberships\s+to\s+authenticated/i);
});
test('RLS checks both teacher and student class membership',()=>{
 assert.match(initial,/function\s+app_private\.is_teacher_of/i);
 assert.match(initial,/function\s+app_private\.is_student_of/i);
 assert.match(initial,/function\s+app_private\.has_role/i);
 assert.match(initial,policy('assignments_student_select'));
 assert.match(initial,policy('submission_student_select'));
});
test('Students cannot write grades or answer keys directly',()=>{
 assert.doesNotMatch(initial,/grant\s+update\s*\(\s*score[^)]*\)\s+on\s+public\.submission_grades\s+to\s+anon/i);
 assert.doesNotMatch(initial,/grant\s+insert\s+on\s+public\.assignment_keys\s+to\s+anon/i);
 assert.match(initial,policy('grades_teacher_all'));
});
test('Student submission must be atomic and validates class, publication and questions',()=>{
 assert.match(submissions,/function\s+public\.submit_assignment_answers/i);
 assert.match(submissions,/security\s+definer/i);
 assert.match(submissions,/app_private\.is_student_of/i);
 assert.match(submissions,/published\s*=\s*true/i);
 assert.match(submissions,/jsonb_each_text/i);
 assert.match(submissions,/revoke\s+insert\s+on\s+public\.submissions\s*,\s*public\.submission_answers\s+from\s+authenticated/i);
});
test('User accounts are never open self-registration in pilot',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
 assert.match(page,/shouldCreateUser\s*:\s*false/);
});
