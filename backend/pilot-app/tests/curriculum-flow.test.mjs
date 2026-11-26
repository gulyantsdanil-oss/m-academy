import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(file)=>readFileSync(join(process.cwd(),file),'utf8');
const migration=read('../supabase/migrations/20261126_curriculum_flow.sql');
const curriculum=read('app/curriculum/page.tsx');
const builder=read('components/TeacherAssignmentBuilder.tsx');
test('canonical curriculum topics are restricted to teacher memberships and same-class plans',()=>{
 assert.match(migration,/create table if not exists public\.curriculum_topics/);
 assert.match(migration,/foreign key\(plan_id,school_id,class_id,teacher_id\)/);
 assert.match(migration,/references public\.curriculum_plans\(id,school_id,class_id,teacher_id\)/);
 assert.match(migration,/teacher_id=\(select auth\.uid\(\)\) and app_private\.is_teacher_of\(class_id\)/);
 assert.match(migration,/alter table public\.curriculum_topics enable row level security/);
});
test('lesson and assignment relation cannot cross class school or teacher',()=>{
 for(const table of ['lesson_drafts','assignments']){
  assert.match(migration,new RegExp('alter table public\\.'+table+'[\\s\\S]*?add column if not exists curriculum_topic_id uuid'));
  assert.match(migration,new RegExp('alter table public\\.'+table+'[\\s\\S]*?foreign key\\(curriculum_topic_id,school_id,class_id,teacher_id\\)'));
 }
 assert.match(migration,/unique\(id,school_id,class_id,teacher_id\)/);
});
test('client curriculum is scoped to authenticated teacher and supports stable IDs',()=>{
 assert.match(curriculum,/api\.auth\.getUser\(\)/);
 assert.match(curriculum,/\.eq\('role','teacher'\)/);
 assert.match(curriculum,/\.eq\('teacher_id',uid\)/);
 assert.match(curriculum,/\.from\('curriculum_topics'\)\.insert/);
 assert.match(curriculum,/curriculum_topic_id:t\.id/);
 assert.match(curriculum,/if\(hasLinks&&!matches\)/);
 assert.match(curriculum,/currentTopics\.some\(t=>t\.position>candidates\.rows\.length\)/);
});
test('assignment creation accepts canonical curriculum topic FK',()=>{
 assert.match(builder,/\.from\('curriculum_topics'\)/);
 assert.match(builder,/\.eq\('teacher_id',teacherId\)/);
 assert.match(builder,/curriculum_topic_id:topicId/);
});

test('teacher assignment publication is one invoker-rights SQL transaction',()=>{
 const publication=read('../supabase/migrations/20261126_atomic_assignment_publish.sql');
 assert.match(publication,/function public\.publish_teacher_assignment/);
 assert.match(publication,/security invoker/);
 assert.match(publication,/app_private\.is_teacher_of\(p_class\)/);
 assert.match(publication,/insert into public\.assignment_keys/);
 assert.match(publication,/update public\.assignments set published=true/);
 assert.match(publication,/grant execute on function public\.publish_teacher_assignment/);
 assert.match(builder,/\.rpc\('publish_teacher_assignment'/);
 assert.doesNotMatch(builder,/\.from\('assignment_keys'\)\.insert/);
});
