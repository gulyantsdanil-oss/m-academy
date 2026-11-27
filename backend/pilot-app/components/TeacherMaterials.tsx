'use client';
import {useCallback,useEffect,useMemo,useState,type ChangeEvent,type FormEvent} from 'react';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,TeacherAssignment} from '@/lib/types';
import {MaterialForm} from '@/components/MaterialForm';

type Kind='ksp'|'ktp';
type Material={id:string;school_id:string;class_id:string;teacher_id:string;revision:number;updated_at:string;content:Record<string,unknown>;topic?:string;subject?:string;curriculum_topic_id?:string|null};
type CurriculumTopic={id:string;topic:string;position:number};
type BackupRow={kind:Kind;title:string;data:Record<string,unknown>};
const MAX_BYTES=500000;
const tableFor=(kind:Kind)=>kind==='ksp'?'ksp_documents':'curriculum_plans';
const jsonObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const stringify=(v:unknown)=>JSON.stringify(v,null,2);
const defaultKsp=()=>({fields:{school:'',teacher:'',section:'',date:'',grade:'',present:'',absent:'',topic:'',learning:'',objectives:'',homework:'',adaptation:''},phases:[
 {title:'Начало урока',minutes:5,teacher:'',student:'',evaluation:'',resources:''},
 {title:'Основная часть',minutes:30,teacher:'',student:'',evaluation:'',resources:''},
 {title:'Завершение',minutes:5,teacher:'',student:'',evaluation:'',resources:''}
]});
const defaultKtp=()=>({grade:'',subject:'Математика',year:'2026-2027',rows:[{topic:'',hours:1,date:''}]});
// A small synthetic lesson sequence for an adult-only pilot. Never writes to Supabase
// until the assigned teacher reviews and explicitly saves the document.
const exampleKtp10=()=>({
 grade:'10',subject:'Алгебра и начала анализа',year:'2026-2027',
 rows:[
  {topic:'Простейшие тригонометрические уравнения',hours:2,date:'',goals:'Находить общие решения sin x = a, cos x = a; проверять ОДЗ и периодичность.'},
  {topic:'Методы решения тригонометрических уравнений',hours:2,date:'',goals:'Применять разложение на множители, замену переменной и формулы тригонометрии.'},
  {topic:'Простейшие тригонометрические неравенства',hours:2,date:'',goals:'Решать неравенства с sin x и cos x на тригонометрическом круге.'}
 ]
});
function validMaterial(kind:Kind,v:unknown):v is Record<string,unknown>{
 if(!jsonObject(v)||new TextEncoder().encode(JSON.stringify(v)).length>MAX_BYTES)return false;
 if(kind==='ksp')return jsonObject(v.fields)&&Array.isArray(v.phases)&&v.phases.length<=100&&
 v.phases.every(x=>jsonObject(x));
 return Array.isArray(v.rows)&&v.rows.length<=1000&&v.rows.every(x=>jsonObject(x));
}
function archiveEntries(value:unknown):BackupRow[]{
 // M-academy 3.1 curriculum export: preview as a single teacher-controlled KTP draft.
 // No automatic class resolution: the teacher explicitly selects the target class.
 if(jsonObject(value)&&value.version===1&&Array.isArray(value.topics)&&Array.isArray(value.assignments)){
  if(value.topics.length>1000||value.assignments.length>2000)throw Error('Архив 3.1 превышает допустимые лимиты.');
  const mapped=value.topics.map((v:unknown)=>{
   if(!jsonObject(v)||typeof v.topic!=='string'||v.topic.trim().length<2||v.topic.length>250||
     typeof v.hours!=='number'||!Number.isInteger(v.hours)||v.hours<1||v.hours>50||
     typeof v.grade!=='string'||!/^(?:[5-9]|10|11)$/.test(v.grade)||
     typeof v.subject!=='string'||v.subject.length>90||
     typeof v.group!=='string'||v.group.length>12||
     typeof v.goals!=='string'||v.goals.length>500||
     typeof v.date!=='string'||(v.date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(v.date)))
    throw Error('В архиве 3.1 есть некорректные строки КТП.');
   return {grade:v.grade,group:v.group,subject:v.subject,topic:v.topic,
    hours:Number(v.hours),goals:v.goals,date:v.date};
  });
  const keys=new Map<string,typeof mapped>();
  for(const t of mapped){
   const k=t.grade+'|'+t.group+'|'+t.subject;
   if(!keys.has(k))keys.set(k,[]);
   keys.get(k)!.push(t);
  }
  return [...keys.entries()].map(([key,rows])=>{
   const [grade,group,subject]=key.split('|');
   const data:Record<string,unknown>={grade,group,subject,year:'2026-2027',
    rows:rows.map(r=>({topic:r.topic,hours:r.hours,date:r.date,goals:r.goals}))};
   if(!validMaterial('ktp',data))throw Error('Материал КТП 3.1 слишком большой.');
   return {kind:'ktp' as const,title:grade+group+' · '+subject,data};
  });
 }

 if(!jsonObject(value)||value.app!=='M-academy'||!['local-backup-v1','local-backup-v2'].includes(String(value.schema))||!jsonObject(value.collections))throw Error('Неизвестный формат резервной копии.');
 const content=value.collections;
 const out:BackupRow[]=[];
 for(const kind of ['ksp','ktp'] as const){
  const group=content[kind];if(!jsonObject(group)||Object.keys(group).length>2000)throw Error('Повреждённый архив.');
  for(const [key,raw] of Object.entries(group)){
   if(!validMaterial(kind,raw))continue;
   const title=kind==='ksp'?String(jsonObject(raw.fields)?raw.fields.topic||key:key):String(raw.subjectLabel||raw.subject||key);
   out.push({kind,title:title.slice(0,300),data:raw});
  }
 }
 return out;
}
export function TeacherMaterials({
 schoolId,teacherId,classes,assignments
}:{schoolId:string;teacherId:string;classes:ClassRoom[];assignments:TeacherAssignment[]}){
 const api=getSupabase();
 const allowed=useMemo(()=>new Set(assignments.map(a=>a.class_id)),[assignments]);
 const permitted=useMemo(()=>classes.filter(c=>allowed.has(c.id)),[classes,allowed]);
 const [classId,setClassId]=useState('');
 const currentClass=permitted.some(c=>c.id===classId)?classId:permitted[0]?.id||'';
 const [kind,setKind]=useState<Kind>('ksp');
 const [docs,setDocs]=useState<Material[]>([]);
 const [curriculumTopics,setCurriculumTopics]=useState<CurriculumTopic[]>([]);
 const [curriculumTopicId,setCurriculumTopicId]=useState('');
 const [selected,setSelected]=useState<string>('');
 const [title,setTitle]=useState('');
 const [editor,setEditor]=useState(stringify(defaultKsp()));
 const [revision,setRevision]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [imports,setImports]=useState<BackupRow[]>([]);
 const [selectedImport,setSelectedImport]=useState('0');
 const [showJson,setShowJson]=useState(false);
 const visualValue=useMemo(()=>{try{const v:unknown=JSON.parse(editor);return validMaterial(kind,v)?v:null}catch{return null}},[editor,kind]);

 const fetchDocuments=useCallback(async()=>{
  if(!api||!currentClass){setDocs([]);return}
  if(kind==='ksp'){
   const {data,error:loadError}=await api.from('ksp_documents')
    .select('id,school_id,class_id,teacher_id,revision,updated_at,content,topic,curriculum_topic_id')
    .eq('school_id',schoolId).eq('class_id',currentClass).eq('teacher_id',teacherId)
    .order('updated_at',{ascending:false}).limit(100);
   if(loadError){setError(loadError.message);return}
   setDocs((data||[]) as Material[]);
  }else{
   const {data,error:loadError}=await api.from('curriculum_plans')
    .select('id,school_id,class_id,teacher_id,revision,updated_at,content,subject')
    .eq('school_id',schoolId).eq('class_id',currentClass).eq('teacher_id',teacherId)
    .order('updated_at',{ascending:false}).limit(100);
   if(loadError){setError(loadError.message);return}
   setDocs((data||[]) as Material[]);
  }
 },[api,currentClass,kind,schoolId,teacherId]);

 useEffect(()=>{void fetchDocuments()},[fetchDocuments]);
 useEffect(()=>{
  if(!api||!currentClass||kind!=='ksp'){setCurriculumTopics([]);return}
  let alive=true;
  (async()=>{
   const {data,error:loadError}=await api.from('curriculum_topics').select('id,topic,position')
    .eq('school_id',schoolId).eq('class_id',currentClass).eq('teacher_id',teacherId).order('position').limit(1000);
   if(!alive)return;
   if(loadError){setCurriculumTopics([]);return}
   setCurriculumTopics((data||[]) as CurriculumTopic[]);
  })();
  return()=>{alive=false};
 },[api,currentClass,kind,schoolId,teacherId]);

 function clearEditor(nextKind=kind){
  setSelected('');setRevision(null);setTitle('');setCurriculumTopicId('');
  setEditor(stringify(nextKind==='ksp'?defaultKsp():defaultKtp()));
  setError('');setMessage('');
 }
 function loadExampleKtp(){
  if(kind!=='ktp'||!currentClass||busy)return;
  if(selected&& !window.confirm('Заменить содержимое редактора примером? Сохранённый на сервере документ не изменится.'))return;
  setSelected('');setRevision(null);setCurriculumTopicId('');
  setTitle('Алгебра и начала анализа');
  setEditor(stringify(exampleKtp10()));
  setMessage('Тестовые 3 темы загружены только в редактор. Проверьте класс, часы и цели; данные не отправлены на сервер.');
  setError('');
 }
 function pick(id:string){
  if(!id){clearEditor();return}
  const doc=docs.find(d=>d.id===id);if(!doc)return;
  setSelected(doc.id);setRevision(doc.revision);setCurriculumTopicId(doc.curriculum_topic_id||'');
  setTitle(String(kind==='ksp'?doc.topic||'':doc.subject||''));
  setEditor(stringify(doc.content));setError('');setMessage('');
 }
 function parseEditor(){
  let obj:unknown;
  try{obj=JSON.parse(editor)}catch{throw Error('Исправьте синтаксис JSON перед сохранением.')}
  if(!validMaterial(kind,obj))throw Error('Неверная структура или превышен размер 500 КБ.');
  return obj;
 }
 async function save(e:FormEvent){
  e.preventDefault();if(!api||!currentClass||busy)return;
  setError('');setMessage('');
  const trimmed=title.trim();
  if(trimmed.length<2||trimmed.length>300){setError('Укажите название 2–300 символов.');return}
  let parsed:Record<string,unknown>;
  try{parsed=parseEditor()}catch(e){setError(e instanceof Error?e.message:'Ошибка содержимого');return}
  setBusy(true);
  try{
   if(!selected){
    const base={school_id:schoolId,class_id:currentClass,teacher_id:teacherId,content:parsed};
    const saved=kind==='ksp'
     ?await api.from('ksp_documents').insert({...base,topic:trimmed,...(curriculumTopicId?{curriculum_topic_id:curriculumTopicId}:{})}).select('id,revision').single()
     :await api.from('curriculum_plans').insert({...base,subject:trimmed}).select('id,revision').single();
    const {data,error:insertError}=saved;
    if(insertError||!data)throw new Error(insertError?.message||'Ошибка записи');
    setSelected(String(data.id));setRevision(Number(data.revision));
    setMessage('Создана серверная версия №1.');await fetchDocuments();
   }else{
    if(revision===null)throw Error('Неизвестная версия документа.');
    const res=await api.rpc('save_teacher_material',{
     p_kind:kind,p_doc_id:selected,p_expected_revision:revision,p_content:parsed
    });
    if(res.error)throw new Error(res.error.message);
    const next=Number(res.data);
    if(!Number.isInteger(next)||next!==revision+1)throw Error('Сервер вернул некорректную версию.');
    setRevision(next);
    setMessage('Сохранено на сервере. Новая редакция: '+next);
    await fetchDocuments();
   }
  }catch(e){setError((e instanceof Error?e.message:'Не удалось сохранить')+
    ' Если документ изменён в другой вкладке, откройте актуальную версию и перенесите правки вручную.')}
  finally{setBusy(false)}
 }
 async function readBackup(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];setImports([]);setSelectedImport('0');setError('');
  if(!file)return;
  if(file.size>2*1024*1024){setError('Файл превышает 2 МБ.');return}
  try{
   const rows=archiveEntries(JSON.parse(await file.text()));
   if(!rows.length)throw Error('Нет подходящих КСП и КТП.');
   setImports(rows.slice(0,500));
   setMessage('Найдено материалов: '+rows.length+'. Данные пока НЕ загружены на сервер.');
  }catch(e){setError(e instanceof Error?e.message:'Не удалось прочитать архив')}
 }
 function previewImport(){
  const chosen=imports[Number(selectedImport)];if(!chosen)return;
  setKind(chosen.kind);setSelected('');setRevision(null);
  setTitle(chosen.title);
  setEditor(stringify(chosen.data));
  setMessage('Содержимое загружено только в редактор. Проверьте данные, класс назначения, предмет и содержание перед серверным сохранением.');
  setError('');
 }
 function exportDocument(){
  let doc:Record<string,unknown>;
  try{doc=parseEditor()}catch(e){setError(e instanceof Error?e.message:'Ошибка');return}
  const blob=new Blob([stringify({kind,title,revision,content:doc})],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='M-academy-'+kind+'-'+(selected||'draft')+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="card">
  <h2>КТП / КСП — серверное хранение</h2>
  <p className="muted">Пилотный редактор структурированных данных с историей номеров редакций и защитой от перезаписи другой вкладкой. DOCX и расширенный визуальный редактор пока остаются в публичной версии.</p>
  {!permitted.length?<p className="warning">Администратор должен назначить учителя на класс. Без назначения запись на сервер запрещена.</p>:<>
   <div className="grid">
    <div><label htmlFor="matClass">Класс</label><select id="matClass" value={currentClass} onChange={e=>{setClassId(e.target.value);clearEditor()}}>{permitted.map(x=><option key={x.id} value={x.id}>{x.label} · {x.academic_year}</option>)}</select></div>
    <div><label htmlFor="matKind">Тип</label><select id="matKind" value={kind} onChange={e=>{const next=e.target.value as Kind;setKind(next);clearEditor(next)}}><option value="ksp">КСП / ҚМЖ</option><option value="ktp">КТП / КТЖ</option></select></div>
   </div>
   <label htmlFor="matList">Ранее сохранённые материалы</label>
   <select id="matList" value={selected} onChange={e=>pick(e.target.value)}>
    <option value="">Новый документ</option>
    {docs.map(d=><option key={d.id} value={d.id}>{kind==='ksp'?d.topic:d.subject} · редакция {d.revision}</option>)}
   </select>
   {kind==='ktp'&&<div className="card">
    <h3>Быстрый старт: пример КТП для 10 класса</h3>
    <p className="muted">Три учебные темы по тригонометрии. Пример не является официальным КТП и не сохраняется автоматически.</p>
    <button type="button" className="btn" disabled={busy} onClick={loadExampleKtp}>Подставить 3 тестовые темы (без сохранения)</button>
   </div>}
   <form onSubmit={e=>void save(e)}>
    {kind==='ksp'&&<><label htmlFor="matCurriculum">Связь с темой КТП</label>
    <select id="matCurriculum" value={curriculumTopicId} disabled={!!selected} onChange={e=>{
     const id=e.target.value;setCurriculumTopicId(id);
     const topic=curriculumTopics.find(t=>t.id===id);
     if(topic)setTitle(topic.topic);
    }}>
     <option value="">Без привязки к КТП</option>
     {curriculumTopics.map(t=><option value={t.id} key={t.id}>№{t.position} · {t.topic}</option>)}
    </select>
    <p className="muted">Связь выбирается при создании КСП. После сохранения изменить её напрямую нельзя; содержание обновляется по редакциям.</p>
   </>}
    <label htmlFor="matTitle">{kind==='ksp'?'Тема КСП':'Предмет КТП'}</label>
    <input id="matTitle" required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/>
    {visualValue?<MaterialForm kind={kind} value={visualValue} onChange={next=>setEditor(stringify(next))}/>:<p className="warning">Невозможно показать визуальную форму: структура JSON некорректна. Исправьте её ниже.</p>}
    <div className="actions"><button type="button" className="btn" onClick={()=>setShowJson(v=>!v)}>{showJson||!visualValue?'Скрыть JSON':'Показать структуру JSON'}</button></div>
    {(showJson||!visualValue)&&<><label htmlFor="matBody">Структура документа (JSON)</label>
    <textarea id="matBody" rows={18} className="editor-area" value={editor}
      onChange={e=>setEditor(e.target.value)} spellCheck={false} aria-describedby="matHelp"/></>}
    <p className="muted" id="matHelp">Не включайте персональные сведения реальных учащихся в тестовую систему. Сохранённый документ доступен только назначенному учителю.</p>
    <div className="actions">
     <button type="submit" className="btn primary" disabled={busy}>{busy?'Сохранение…':selected?'Сохранить новую редакцию':'Создать на сервере'}</button>
     <button type="button" className="btn" onClick={()=>clearEditor()}>Новый документ</button>
     <button type="button" className="btn" onClick={exportDocument}>Скачать JSON</button>
    </div>
   </form>
   {selected&&<p className="muted">Документ: {selected.slice(0,8)}… · текущая редакция {revision}</p>}
   <hr/>
   <h3>Перенос из локальной версии</h3>
   <p className="muted">Выберите резервную копию M-academy v1/v2 или экспорт учебного конвейера 3.1. Архив только читается и показывает предпросмотр: ничего автоматически не отправляется. Импорт выполняется по одному материалу после проверки и сохранения.</p>
   <label htmlFor="matImport">Резервная копия .json (до 2 МБ)</label>
   <input id="matImport" type="file" accept=".json,application/json" onChange={e=>void readBackup(e)}/>
   {imports.length>0&&<><label htmlFor="matImportSelect">Найденные КСП и КТП</label>
    <select id="matImportSelect" value={selectedImport} onChange={e=>setSelectedImport(e.target.value)}>
    {imports.map((row,i)=><option value={i} key={i}>{row.kind.toUpperCase()} — {row.title}</option>)}
    </select>
    <p><button type="button" className="btn" onClick={previewImport}>Перенести выбранное в редактор (без отправки)</button></p>
   </>}
   {message&&<p className="success" role="status">{message}</p>}
   {error&&<p className="error" role="alert">{error}</p>}
  </>}
 </section>;
}
