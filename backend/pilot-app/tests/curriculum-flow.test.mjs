import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(file)=>readFileSync(join(process.cwd(),file),'utf8');
const migration=read('../supabase/migrations/20261126100000_curriculum_flow.sql');
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
 assert.match(curriculum,/\.rpc\('sync_curriculum_topics'/);
 assert.match(curriculum,/curriculum_topic_id:t\.id/);
 assert.match(curriculum,/if\(hasLinks&&!matches\)/);
 assert.match(curriculum,/currentTopics\.some\(t=>t\.position>candidates\.rows\.length\)/);
});
test('assignment creation accepts canonical curriculum topic FK',()=>{
 assert.match(builder,/\.from\('curriculum_topics'\)/);
 assert.match(builder,/\.eq\('teacher_id',teacherId\)/);
 assert.match(builder,/p_curriculum_topic:topicId/);
});

test('teacher assignment publication is one invoker-rights SQL transaction',()=>{
 const publication=read('../supabase/migrations/20261126120000_atomic_assignment_publish.sql');
 assert.match(publication,/function public\.publish_teacher_assignment/);
 assert.match(publication,/security invoker/);
 assert.match(publication,/app_private\.is_teacher_of\(p_class\)/);
 assert.match(publication,/insert into public\.assignment_keys/);
 assert.match(publication,/update public\.assignments set published=true/);
 assert.match(publication,/grant execute on function public\.publish_teacher_assignment/);
 assert.match(builder,/\.rpc\('publish_teacher_assignment'/);
 assert.doesNotMatch(builder,/\.from\('assignment_keys'\)\.insert/);
});

test('curriculum sync is transactional and refuses linked topic mutations',()=>{
 const sql=read('../supabase/migrations/20261126110000_atomic_curriculum_sync.sql');
 assert.match(sql,/security invoker/);
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock/);
 assert.match(sql,/Linked topic changed at position/);
 assert.match(sql,/on conflict\(plan_id,position\) do update/);
 assert.match(sql,/grant execute on function public\.sync_curriculum_topics/);
});
test('KSP editor can attach to a curriculum topic without auto changing existing documents',()=>{
 const editor=read('components/TeacherMaterials.tsx');
 assert.match(migration,/ksp_documents_curriculum_topic_fk/);
 assert.match(editor,/curriculum_topic_id:curriculumTopicId/);
 assert.match(editor,/disabled=\{!!selected\}/);
});

test('curriculum view includes linked KSP and legacy learning objectives',()=>{
 const form=read('components/MaterialForm.tsx');
 assert.match(curriculum,/\.from\('ksp_documents'\)/);
 assert.match(curriculum,/linkedKsp/);
 assert.match(curriculum,/row\.objectives/);
 assert.match(form,/\['goals','Цели обучения/);
 assert.match(form,/row\.goals\?\?row\.objectives/);
});
