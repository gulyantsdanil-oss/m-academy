import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const migrations=new URL('../../supabase/migrations/',import.meta.url);
const sql=readFileSync(new URL('20261123_teacher_materials.sql',migrations),'utf8');
const teacher=readFileSync(new URL('../components/TeacherMaterials.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
test('Server storage limits document size and requires object data',()=>{
 assert.match(sql,/octet_length\s*\(\s*p_content::text\s*\)\s*>\s*500000/i);
 assert.match(sql,/jsonb_typeof\(p_content\)\s*<>\s*'object'/i);
 for(const name of ['curriculum_plans','lesson_drafts','ksp_documents'])
  assert.match(sql,new RegExp('alter table public\\.'+name,'i'));
});
test('Teacher documents have compare-and-swap updates, no silent overwrites',()=>{
 assert.match(sql,/p_expected_revision\s+integer/i);
 for(const name of ['curriculum_plans','lesson_drafts','ksp_documents']){
  assert.match(sql,new RegExp('update public\\.'+name,'i'));
 }
 assert.match(sql,/d\.revision\s*=\s*p_expected_revision/i);
 assert.match(sql,/revision\s*=\s*d\.revision\s*\+\s*1/i);
 assert.match(sql,/Document not found, access denied, or stale revision/i);
});
test('No direct content writes for the authenticated client',()=>{
 assert.match(sql,/revoke update\s*\(content,revision,updated_at\)/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/app_private\.is_teacher_of\(d\.class_id\)/i);
 assert.match(sql,/teacher_id\s*=\s*v_uid/i);
 assert.match(sql,/grant execute on function public\.save_teacher_material/i);
});
test('UI uses revision RPC, not unrestricted update',()=>{
 assert.match(teacher,/\.rpc\('save_teacher_material'/);
 assert.match(teacher,/p_expected_revision:revision/);
 assert.doesNotMatch(teacher,/\.update\(\{content:/);
 assert.match(app,/TeacherMaterials/);
});
test('Legacy backup is previewed locally, never silently uploaded',()=>{
 assert.match(teacher,/local-backup-v1/);
 assert.match(teacher,/local-backup-v2/);
 assert.match(teacher,/await file\.text\(\)/);
 assert.match(teacher,/Перенести выбранное в редактор/);
 assert.match(teacher,/Содержимое загружено только в редактор/);
 assert.match(teacher,/setImports\(rows\.slice\(0,500\)\)/);
});

test('Teacher material editor exposes visual KSP stage and KTP topic fields',()=>{
 const form=readFileSync(new URL('../components/MaterialForm.tsx',import.meta.url),'utf8');
 assert.match(form,/fieldsKsp/);
 assert.match(form,/Действия педагога/);
 assert.match(form,/Действия ученика/);
 assert.match(form,/Оценивание/);
 assert.match(form,/Ресурсы/);
 assert.match(form,/rowsKtp/);
 assert.match(form,/Добавить тему/);
 assert.match(teacher,/MaterialForm/);
 assert.match(teacher,/showJson/);
});
