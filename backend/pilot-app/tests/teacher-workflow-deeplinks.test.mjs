import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const curriculum=file('app/curriculum/page.tsx');
const lessons=file('app/lessons/page.tsx');
const assignment=file('components/TeacherAssignmentBuilder.tsx');
const overview=file('app/overview/page.tsx');
test('KTP topics offer real navigation to their linked lesson and assignment editor',()=>{
 assert.match(curriculum,/linkedDrafts\[0\]\.id/);
 assert.match(curriculum,/encodeURIComponent\(classId\)/);
 assert.match(curriculum,/curriculumTopicId=/);
 assert.match(curriculum,/Создать черновик урока/);
 assert.match(curriculum,/topic-progress-step/);
});
test('Lesson deep link is validated against assigned class and RLS-returned documents',()=>{
 assert.match(lessons,/URLSearchParams\(window\.location\.search\)/);
 assert.match(lessons,/availableClasses\.some\(c=>c\.id===incoming\.classId\)/);
 assert.match(lessons,/documents\.find\(v=>v\.id===incoming\.lessonId&&v\.class_id===chosen\)/);
 assert.doesNotMatch(lessons,/\.eq\('id',incoming\.lessonId\)/);
});
test('Assignment deep link must be in RLS-scoped curriculum topics and assigned class',()=>{
 assert.match(assignment,/URLSearchParams\(window\.location\.search\)/);
 assert.match(assignment,/options\.some\(x=>x\.id===incoming\.classId\)/);
 assert.match(assignment,/curriculumTopics\.find\(t=>t\.id===incoming\.topicId&&t\.class_id===chosen\)/);
 assert.match(assignment,/setTopic\(matched\.topic\)/);
 assert.doesNotMatch(assignment,/\.from\('assignments'\)\.insert/);
});
test('Teacher overview shows a guided but non-automatic publishing workflow',()=>{
 assert.match(overview,/Подготовка урока — три шага/);
 assert.match(overview,/className="teacher-workflow"/);
 assert.match(overview,/href="\/curriculum"/);
});
