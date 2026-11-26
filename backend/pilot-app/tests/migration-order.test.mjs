import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('../../supabase/migrations/',import.meta.url));
const expected=[
 '20261123090000_initial.sql',
 '20261123100000_atomic_submissions.sql',
 '20261123110000_teacher_materials.sql',
 '20261126100000_curriculum_flow.sql',
 '20261126110000_atomic_curriculum_sync.sql',
 '20261126120000_atomic_assignment_publish.sql'
];
test('migration names have unique sortable timestamps and strict dependency order',()=>{
 const found=readdirSync(dir).filter(s=>s.endsWith('.sql')).sort();
 assert.deepEqual(found,expected,'migration order or count diverged');
 assert.equal(new Set(found.map(x=>x.slice(0,14))).size,found.length);
 for(const x of found)assert.match(x,/^\d{14}_[a-z_]+\.sql$/);
});
test('base tables precede canonical topics, transactional APIs and privilege checks',()=>{
 const sql=expected.map(f=>readFileSync(new URL(f,new URL('../../supabase/migrations/',import.meta.url)),'utf8'));
 assert.match(sql[0],/create table if not exists public\.curriculum_plans/);
 assert.match(sql[2],/function public\.save_teacher_material/);
 assert.match(sql[3],/create table if not exists public\.curriculum_topics/);
 assert.match(sql[4],/function public\.sync_curriculum_topics/);
 assert.match(sql[5],/function public\.publish_teacher_assignment/);
 for(const statement of sql.slice(3)){
  assert.match(statement,/begin;/i);
  assert.match(statement,/commit;/i);
 }
});
