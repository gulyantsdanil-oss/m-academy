import {parseCurriculumCsv} from './curriculum-csv.mjs';

// Transform worksheet cell values into a lossless TSV so both XLSX and CSV use
// identical header mapping and strict curriculum validation. Never evaluate formulas.
function formatCell(value){
 if(value===null||value===undefined)return '';
 if(value instanceof Date){
  if(!Number.isFinite(value.getTime()))throw Error('В Excel найдена некорректная дата.');
  return [value.getUTCFullYear(),String(value.getUTCMonth()+1).padStart(2,'0'),String(value.getUTCDate()).padStart(2,'0')].join('-');
 }
 if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'||typeof value==='string')return String(value);
 throw Error('В Excel найдена неподдерживаемая ячейка. Проверьте формулы и значения.');
}
export function parseCurriculumSheet(grid){
 if(!Array.isArray(grid)||grid.length>1008)throw Error('В Excel слишком много строк (максимум 1000 тем).');
 const lines=grid.map(row=>{
  if(!Array.isArray(row)||row.length>100)throw Error('В Excel слишком много столбцов.');
  return row.map(cell=>{
   const s=formatCell(cell);
   return /[\t\r\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }).join('\t');
 });
 return parseCurriculumCsv(lines.join('\n'));
}
