import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const lesson=readFileSync(new URL('../app/lessons/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/styles.css',import.meta.url),'utf8');
test('lesson editor uses authenticated teacher membership and school-scoped reads',()=>{
 assert.match(lesson,/sb\.auth\.getUser\(\)/);
 assert.match(lesson,/\.from\('memberships'\)/);
 assert.match(lesson,/\.eq\('role','teacher'\)\.eq\('active',true\)/);
 assert.match(lesson,/\.from\('class_teachers'\)/);
 assert.match(lesson,/\.eq\('teacher_id',userId\)/);
 assert.match(lesson,/\.from\('lesson_drafts'\)/);
 assert.match(lesson,/\.eq\('school_id',school\)/);
});
test('lesson editor uses optimistic concurrency instead of direct content updates',()=>{
 assert.match(lesson,/\.rpc\('save_teacher_material'/);
 assert.match(lesson,/p_expected_revision:revision/);
 assert.match(lesson,/p_kind:'lesson'/);
 assert.doesNotMatch(lesson,/\.from\('lesson_drafts'\)\.update/);
});
test('lesson phases and form fields are validated before storage',()=>{
 for(const field of ['teacher','student','evaluation','resources','minutes','title'])assert.match(lesson,new RegExp(field));
 assert.match(lesson,/validateDraft\(lesson\)/);
 assert.match(lesson,/new TextEncoder\(\)\.encode\(JSON\.stringify\(content\)\)/);
 assert.match(lesson,/length>500000/);
 assert.match(lesson,/phases\.length>40/);
 assert.match(css,/textarea\{/);
});
test('lesson editor preserves link to curriculum topic and unknown metadata',()=>{
 assert.match(lesson,/curriculum_topic_id/);
 assert.match(lesson,/\{\.\.\.originalContent/);
 assert.match(lesson,/setOriginalContent\(d\.content\)/);
});
