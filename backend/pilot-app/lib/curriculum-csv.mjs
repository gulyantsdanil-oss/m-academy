// Client-side, deterministic import of tabular CSV/TSV exported from Excel.
// No network calls. It deliberately does not interpret spreadsheet formulas.
const MAX_ROWS=1000;
const norm=s=>String(s??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[ё]/g,'е').replace(/[\s_№().:-]+/g,'');
function parseGrid(source,delimiter){
 const out=[];let row=[],field='',quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){
   if(quoted&&source[i+1]==='"'){field+='"';i++}
   else if(quoted){quoted=false}
   else if(!field){quoted=true}
   else throw Error('Некорректные кавычки в таблице.');
  }else if(!quoted&&c===delimiter){row.push(field);field=''}
  else if(!quoted&&(c==='\r'||c==='\n')){
   if(c==='\r'&&source[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.some(x=>x.trim()))out.push(row);
   row=[];
   if(out.length>MAX_ROWS+8)throw Error('В таблице больше 1000 тем.');
  }else{field+=c}
 }
 if(quoted)throw Error('Незакрытая кавычка в таблице.');
 row.push(field);if(row.some(x=>x.trim()))out.push(row);
 if(out.length>MAX_ROWS+8)throw Error('В таблице больше 1000 тем.');
 return out;
}
const synonyms={
 topic:['тема','темаурока','наименованиеразделовтем','наименованиетем','содержание','topic','lesson','lessonname'],
 hours:['часы','количествочасов','колчасов','час','колчас','hours','hour'],
 date:['дата','датапроведения','плановаядата','date'],
 goals:['целиобучения','цели','цельобучения','учебныецели','learningobjectives','goals','objectives']
};
function fields(row){
 const head=row.map(norm);const idx={};
 for(const [key,names] of Object.entries(synonyms)){
  const pos=head.findIndex(x=>names.includes(x));
  if(pos>=0)idx[key]=pos;
 }
 return idx;
}
function parseDate(text,line){
 const value=text.trim();
 if(!value)return '';
 let date=value;
 const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
 if(m)date=m[3]+'-'+m[2]+'-'+m[1];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Строка '+line+': дата должна быть ГГГГ-ММ-ДД или ДД.ММ.ГГГГ.');
 const [y,mo,d]=date.split('-').map(Number);
 const v=new Date(Date.UTC(y,mo-1,d));
 if(v.getUTCFullYear()!==y||v.getUTCMonth()!==mo-1||v.getUTCDate()!==d)throw Error('Строка '+line+': невозможная дата.');
 return date;
}
/**
 * @param {string} text
 * @returns {{rows: {topic:string,hours:number,date:string,goals:string}[],delimiter:string,headerLine:number}}
 */
export function parseCurriculumCsv(text){
 if(!text.trim())throw Error('Таблица пуста.');
 if(text.length>1000000)throw Error('Таблица превышает 1 МБ.');
 let picked=null;
 for(const delimiter of [';','\t',',']){
  const grid=parseGrid(text,delimiter);
  const rowNum=grid.findIndex((r,i)=>i<5&&'topic' in fields(r)&&'hours' in fields(r));
  if(rowNum>=0){picked={grid,delimiter,rowNum};break}
 }
 if(!picked)throw Error('Не найдены столбцы «Тема» и «Часы» в первых пяти строках. Экспортируйте КТП из Excel как CSV UTF-8.');
 const {grid,delimiter,rowNum}=picked;
 const indexes=fields(grid[rowNum]);
 const rows=[];
 for(let i=rowNum+1;i<grid.length;i++){
  const r=grid[i];
  const get=key=>indexes[key]===undefined?'':String(r[indexes[key]]??'').trim();
  const topic=get('topic'),hoursRaw=get('hours').replace(',','.');
  if(!topic&&!hoursRaw)continue;
  if(topic.length<2||topic.length>300)throw Error('Строка '+(i+1)+': тема должна содержать 2–300 символов.');
  const hours=Number(hoursRaw);
  if(!/^\d+$/.test(hoursRaw)||!Number.isInteger(hours)||hours<1||hours>50)throw Error('Строка '+(i+1)+': часы должны быть целым числом от 1 до 50.');
  const goals=get('goals');if(goals.length>2000)throw Error('Строка '+(i+1)+': слишком длинные цели обучения.');
  rows.push({topic,hours,date:parseDate(get('date'),i+1),goals});
  if(rows.length>MAX_ROWS)throw Error('В таблице больше 1000 тем.');
 }
 if(!rows.length)throw Error('В таблице нет тем после заголовков.');
 return {rows,delimiter,headerLine:rowNum+1};
}
