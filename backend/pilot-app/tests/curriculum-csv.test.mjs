import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCurriculumCsv} from '../lib/curriculum-csv.mjs';
import {parseCurriculumSheet} from '../lib/curriculum-xlsx.mjs';
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
 assert.match(editor,/Импорт КТП из Excel \(\.xlsx \/ CSV \/ TSV\)/);
 assert.match(editor,/до 2 МБ, максимум 1000 тем/);
});

test('Excel worksheet maps a second-row header to topic hours date and objectives',()=>{
 const parsed=parseCurriculumSheet([
  ['КТП, 10 класс'],
  ['Тема','Часы','Дата','Цели обучения'],
  ['Методы решения тригонометрических уравнений',2,new Date('2026-12-01T00:00:00Z'),'Разложение на множители'],
  ['Простейшие тригонометрические неравенства',1,'02.12.2026','Тригонометрический круг']
 ]);
 assert.equal(parsed.headerLine,2);
 assert.equal(parsed.rows.length,2);
 assert.equal(parsed.rows[0].date,'2026-12-01');
 assert.equal(parsed.rows[1].date,'2026-12-02');
});
test('Excel worksheet preserves commas, tabs, quotes and line breaks in topics',()=>{
 const parsed=parseCurriculumSheet([
  ['Topic','Hours'],
  ['Plots, functions "intro"\nexercise',2]
 ]);
 assert.equal(parsed.rows[0].topic,'Plots, functions "intro"\nexercise');
});
test('Excel worksheet rejects invalid numbers and oversized grids',()=>{
 assert.throws(()=>parseCurriculumSheet([['Тема','Часы'],['Уравнения',0]]));
 assert.throws(()=>parseCurriculumSheet([['Тема','Часы'],['Уравнения',1.5]]));
 assert.throws(()=>parseCurriculumSheet(Array.from({length:1010},()=>['Уравнения',1])));
});
test('direct XLSX import reads file only in browser without automatic persistence',()=>{
 const code=editor.slice(editor.indexOf('async function importCsv'),editor.indexOf('function pick(id:string)'));
 assert.match(code,/import\('read-excel-file\/browser'\)/);
 assert.match(code,/readSheet\(file\)/);
 assert.match(code,/parseCurriculumSheet\(grid\)/);
 assert.match(code,/setEditor\(stringify\(data\)\)/);
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.rpc\(/);
});
