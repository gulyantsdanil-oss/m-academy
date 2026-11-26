'use client';
type Kind='ksp'|'ktp';
type Props={kind:Kind;value:Record<string,unknown>;onChange:(next:Record<string,unknown>)=>void};
type Loose=Record<string,unknown>;
const isObject=(v:unknown):v is Loose=>!!v&&typeof v==='object'&&!Array.isArray(v);
const val=(v:unknown)=>v===null||v===undefined?'':String(v);
const fieldsKsp=[
 ['school','Школа'],['teacher','Педагог'],['grade','Класс'],['section','Раздел'],
 ['date','Дата урока'],['topic','Тема'],['learning','Цели обучения'],['objectives','Цели урока'],
 ['present','Присутствуют'],['absent','Отсутствуют'],['homework','Домашнее задание'],
 ['adaptation','Дифференциация']
] as const;
const phases=[
 ['title','Этап'],['minutes','Минуты'],['teacher','Действия педагога'],
 ['student','Действия ученика'],['evaluation','Оценивание'],['resources','Ресурсы']
] as const;
const rowsKtp=[
 ['topic','Тема'],['hours','Часы'],['date','Дата'],['goals','Цели обучения (проверить по программе)']
] as const;
function Field({id,label,value,onChange,multiline=false}:{
 id:string;label:string;value:unknown;onChange:(v:string)=>void;multiline?:boolean
}){
 return <div><label htmlFor={id}>{label}</label>
 {multiline?<textarea id={id} rows={3} value={val(value)} onChange={e=>onChange(e.target.value)}/>:
 <input id={id} value={val(value)} onChange={e=>onChange(e.target.value)}/>}</div>
}
export function MaterialForm({kind,value,onChange}:Props){
 if(kind==='ksp'){
  const f=isObject(value.fields)?value.fields:{};
  const stages=Array.isArray(value.phases)?value.phases.filter(isObject):[];
  const changeField=(k:string,v:string)=>onChange({...value,fields:{...f,[k]:v}});
  const changeStage=(i:number,k:string,v:string)=>onChange({...value,phases:stages.map((p,j)=>j===i?{...p,[k]:k==='minutes'?Math.max(0,Math.min(240,Number(v)||0)):v}:p)});
  return <div className="material-form">
   <h3>КСП · основные сведения</h3>
   <div className="grid">{fieldsKsp.map(([key,label])=>
    <Field id={'f-'+key} key={key} label={label} value={f[key]} multiline={['learning','objectives','homework','adaptation'].includes(key)} onChange={v=>changeField(key,v)}/>)}</div>
   <h3>Ход урока — форма из пяти граф</h3>
   <p className="muted">Этап / время, действия педагога, действия ученика, оценивание, ресурсы. Проверьте соответствие вашей актуальной форме КСП.</p>
   {stages.map((stage,i)=><div className="card" style={{boxShadow:'none'}} key={i}>
    <div className="actions"><b>Этап {i+1}</b><button type="button" className="btn" onClick={()=>onChange({...value,phases:stages.filter((_,j)=>j!==i)})}>Удалить</button></div>
    <div className="grid">{phases.map(([key,label])=><Field key={key} id={'stage-'+i+'-'+key} label={label} value={stage[key]} multiline={['teacher','student','evaluation','resources'].includes(key)} onChange={v=>changeStage(i,key,v)}/>)}</div>
   </div>)}
   <button type="button" className="btn" disabled={stages.length>=40} onClick={()=>onChange({...value,phases:[...stages,{title:'',minutes:5,teacher:'',student:'',evaluation:'',resources:''}]})}>Добавить этап</button>
  </div>;
 }
 const rows=Array.isArray(value.rows)?value.rows.filter(isObject):[];
 const setField=(k:string,v:string)=>onChange({...value,[k]:v});
 const setRow=(i:number,k:string,v:string)=>onChange({...value,rows:rows.map((r,j)=>j===i?{...r,[k]:k==='hours'?Math.max(1,Math.min(50,Number(v)||1)):v}:r)});
 return <div className="material-form">
  <h3>КТП · учебный план</h3>
  <div className="grid">
   <Field id="ktpGrade" label="Класс" value={value.grade} onChange={v=>setField('grade',v)}/>
   <Field id="ktpSubject" label="Предмет" value={value.subject} onChange={v=>setField('subject',v)}/>
   <Field id="ktpYear" label="Учебный год" value={value.year} onChange={v=>setField('year',v)}/>
  </div>
  <h3>Распределение тем</h3>
  {rows.map((row,i)=><div className="card" style={{boxShadow:'none'}} key={i}>
   <div className="actions"><b>Тема {i+1}</b><button type="button" className="btn" onClick={()=>onChange({...value,rows:rows.filter((_,j)=>j!==i)})}>Удалить</button></div>
   <div className="grid">{rowsKtp.map(([key,label])=><Field key={key} id={'row-'+i+'-'+key} label={label} value={key==='goals'?(row.goals??row.objectives??row.learning_goals):row[key]} multiline={key==='goals'} onChange={v=>setRow(i,key,v)}/>)}</div>
  </div>)}
  <button type="button" className="btn" disabled={rows.length>=300} onClick={()=>onChange({...value,rows:[...rows,{topic:'',hours:1,date:''}]})}>Добавить тему</button>
 </div>
}
