import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCurriculumCsv} from '../lib/curriculum-csv.mjs';
const editor=readFileSync(new URL('../components/TeacherMaterials.tsx',import.meta.url),'utf8');
test('CSV UTF-8 accepts Excel semicolon separator and headers in row two',()=>{
 const csv='\ufeffКТП на 2026-2027 год\nТема;Часы;Дата;Цели обучения\nПростейшие тригонометрические уравнения;2;27.11.2026;Общие решения\nМетоды решения тригонометрических уравнений;1;;Тождества';
 const x=parseCurriculumCsv(csv);
 assert.equal(x.headerLine,2);
 assert.equal(x.delimiter,';');
 assert.equal(x.rows.length,2);
 assert.deepEqual(x.rows[0],{topic:'Простейшие тригонометрические уравнения',hours:2,date:'2026-11-27',goals:'Общие решения'});
});
test('CSV parses quoted delimiters, escaped quotes and multiline',()=>{
 const x=parseCurriculumCsv('Topic,Hours,Date,Goals\n"Graphs, functions",2,2026-12-01,"Build ""graph"""\n"Intro\nexercise",1,,Done');
 assert.equal(x.rows[0].topic,'Graphs, functions');
 assert.equal(x.rows[0].goals,'Build "graph"');
 assert.equal(x.rows[1].topic,'Intro\nexercise');
});
test('TSV accepts optional dates and objectives',()=>{
 const x=parseCurriculumCsv('Тема\tЧасы\nЛинейные уравнения\t3');
 assert.deepEqual(x.rows,[{topic:'Линейные уравнения',hours:3,date:'',goals:''}]);
});
test('rejects spreadsheet errors before anything can be saved',()=>{
 for(const csv of [
 'Тема;Часы\nКвадратные уравнения;0',
 'Тема;Часы\nКвадратные уравнения;1.5',
 'Тема;Часы;Дата\nКвадратные уравнения;1;31.02.2026',
 'Тема;Часы\nA;1',
 'Название;Номер\nУрок;2',
 'Тема;Часы\n"Открытая тема;1'
 ])assert.throws(()=>parseCurriculumCsv(csv),undefined,csv);
});
test('CSV import only previews and never writes through an implicit API operation',()=>{
 const code=editor.slice(editor.indexOf('async function importCsv'),editor.indexOf('function pick(id:string)'));
 assert.match(code,/parseCurriculumCsv\(await file\.text\(\)\)/);
 assert.match(code,/setEditor\(stringify\(data\)\)/);
 assert.match(code,/setSelected\(''\)/);
 assert.match(code,/setRevision\(null\)/);
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.rpc\(/);
 assert.match(editor,/Импорт КТП из Excel \(CSV \/ TSV\)/);
 assert.match(editor,/до 1 МБ, максимум 1000 тем/);
});
