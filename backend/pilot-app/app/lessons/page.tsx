'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,Membership,TeacherAssignment} from '@/lib/types';
type Phase={title:string;minutes:number;teacher:string;student:string;evaluation:string;resources:string};
type Lesson={id:string;school_id:string;class_id:string;teacher_id:string;topic:string;content:Record<string,unknown>;revision:number;updated_at:string;curriculum_topic_id:string|null};
type LessonData={topic:string;goals:string;hours:number;scheduled_on:string;notes:string;phases:Phase[]};
const sb=getSupabase();
const emptyPhase=():Phase=>({title:'Новый этап',minutes:5,teacher:'',student:'',evaluation:'',resources:''});
const emptyData=():LessonData=>({topic:'',goals:'',hours:1,scheduled_on:'',notes:'',phases:[
 {title:'Начало урока',minutes:5,teacher:'',student:'',evaluation:'',resources:''},
 {title:'Основная часть',minutes:30,teacher:'',student:'',evaluation:'',resources:''},
 {title:'Рефлексия',minutes:5,teacher:'',student:'',evaluation:'',resources:''}
]});
function str(v:unknown,max:number){return typeof v==='string'?v.slice(0,max):''}
function safeContent(c:Record<string,unknown>,fallback:string):LessonData{
 const phases=Array.isArray(c.phases)?c.phases:[];
 return {topic:str(c.topic,300)||fallback,goals:str(c.goals,2000),hours:typeof c.hours==='number'&&c.hours>=1&&c.hours<=50?c.hours:1,
  scheduled_on:str(c.scheduled_on,10),notes:str(c.notes,8000),
  phases:phases.slice(0,40).map(v=>{const p=v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
   return {title:str(p.title,200),minutes:typeof p.minutes==='number'&&Number.isFinite(p.minutes)?p.minutes:5,
    teacher:str(p.teacher,3000),student:str(p.student,3000),evaluation:str(p.evaluation,3000),resources:str(p.resources,3000)};})
 };
}
function validateDraft(d:LessonData){
 if(d.topic.trim().length<2||d.topic.trim().length>300) return 'Укажите тему урока (2–300 символов).';
 if(d.goals.length>2000||d.notes.length>8000)return 'Слишком длинное описание урока.';
 if(d.phases.length<1||d.phases.length>40)return 'Допустимо от 1 до 40 этапов урока.';
 if(d.phases.some(p=>p.title.trim().length<2||p.title.length>200||!Number.isInteger(p.minutes)||p.minutes<1||p.minutes>240||
  [p.teacher,p.student,p.evaluation,p.resources].some(x=>x.length>3000)))return 'Проверьте длительность и содержание каждого этапа.';
 const total=d.phases.reduce((n,p)=>n+p.minutes,0);
 if(total>240)return 'Общее время урока не должно превышать 240 минут.';
 if(d.scheduled_on&&!/^\d{4}-\d{2}-\d{2}$/.test(d.scheduled_on))return 'Неверная дата урока.';
 return '';
}
export default function LessonsPage(){
 const [userId,setUserId]=useState('');
 const [memberships,setMemberships]=useState<Membership[]>([]);
 const [school,setSchool]=useState('');
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [appointments,setAppointments]=useState<TeacherAssignment[]>([]);
 const [classId,setClassId]=useState('');
 const [documents,setDocuments]=useState<Lesson[]>([]);
 const [selected,setSelected]=useState('');
 const [revision,setRevision]=useState<number|null>(null);
 const [lesson,setLesson]=useState<LessonData>(emptyData);
 const [originalContent,setOriginalContent]=useState<Record<string,unknown>>({});
 const [pending,setPending]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [reload,setReload]=useState(0);
 const availableClasses=useMemo(()=>classes.filter(c=>appointments.some(a=>a.class_id===c.id)),[classes,appointments]);
 const chosen=availableClasses.some(c=>c.id===classId)?classId:availableClasses[0]?.id||'';
 const selectedDoc=documents.find(d=>d.id===selected);
 const phaseMinutes=lesson.phases.reduce((n,p)=>n+p.minutes,0);
 const fetchLessons=useCallback(async()=>{
  if(!sb||!school||!chosen||!userId){setDocuments([]);return}
  const res=await sb.from('lesson_drafts')
   .select('id,school_id,class_id,teacher_id,topic,content,revision,updated_at,curriculum_topic_id')
   .eq('school_id',school).eq('class_id',chosen).eq('teacher_id',userId).order('updated_at',{ascending:false}).limit(100);
  if(res.error){setError(res.error.message);return}
  setDocuments((res.data||[]) as Lesson[]);
 },[school,chosen,userId]);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   if(!sb){setError('Не настроен Supabase.');setLoaded(true);return}
   const auth=await sb.auth.getUser();if(!alive)return;
   if(auth.error||!auth.data.user){setError('Сначала войдите в серверный кабинет.');setLoaded(true);return}
   const uid=auth.data.user.id;setUserId(uid);
   const mr=await sb.from('memberships').select('school_id,role,active').eq('user_id',uid).eq('role','teacher').eq('active',true);
   if(!alive)return;
   if(mr.error){setError(mr.error.message);setLoaded(true);return}
   const ms=(mr.data||[]) as Membership[];setMemberships(ms);setSchool(ms[0]?.school_id||'');
   if(!ms.length)setError('Нет действующего назначения учителем.');setLoaded(true);
  })();
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!sb||!school||!userId){setClasses([]);setAppointments([]);return}
  let alive=true;
  (async()=>{
   const [cr,tr]=await Promise.all([
    sb.from('classes').select('id,school_id,label,academic_year').eq('school_id',school).limit(500),
    sb.from('class_teachers').select('class_id,school_id,subject').eq('school_id',school).eq('teacher_id',userId).limit(500)
   ]);
   if(!alive)return;
   if(cr.error||tr.error){setError(cr.error?.message||tr.error?.message||'Ошибка классов');return}
   const c=(cr.data||[]) as ClassRoom[],t=(tr.data||[]) as TeacherAssignment[];
   setClasses(c);setAppointments(t);setClassId(prev=>t.some(a=>a.class_id===prev)?prev:t[0]?.class_id||'');
  })();
  return()=>{alive=false};
 },[school,userId]);
 useEffect(()=>{void fetchLessons()},[fetchLessons,reload]);
 function selectLesson(id:string){
  const d=documents.find(v=>v.id===id);
  if(!d){setSelected('');setRevision(null);setOriginalContent({});setLesson(emptyData());return}
  setSelected(d.id);setRevision(d.revision);setOriginalContent(d.content);
  setLesson(safeContent(d.content,d.topic));setMessage('');setError('');
 }
 useEffect(()=>{setSelected('');setRevision(null);setLesson(emptyData());setOriginalContent({})},[chosen,school]);
 function edit(k:keyof LessonData,v:string){setLesson(p=>({...p,[k]:k==='hours'?Number(v):v}))}
 function editPhase(index:number,k:keyof Phase,v:string){
  setLesson(d=>({...d,phases:d.phases.map((p,i)=>i===index?{...p,[k]:k==='minutes'?Number(v):v}:p)}))
 }
 async function save(event:FormEvent){
  event.preventDefault();
  if(!sb||!selected||revision===null||pending||!selectedDoc)return;
  const issue=validateDraft(lesson);if(issue){setError(issue);return}
  // Preserve metadata and existing unknown fields when saving this controlled form.
  const content:Record<string,unknown>={...originalContent,topic:lesson.topic,goals:lesson.goals,hours:lesson.hours,
   scheduled_on:lesson.scheduled_on||null,notes:lesson.notes,phases:lesson.phases};
  if(new TextEncoder().encode(JSON.stringify(content)).length>500000){setError('Содержимое урока превышает 500 КБ.');return}
  setPending(true);setError('');setMessage('');
  const {data,error:saveError}=await sb.rpc('save_teacher_material',{p_kind:'lesson',p_doc_id:selected,
   p_expected_revision:revision,p_content:content});
  if(saveError){setError('Не удалось сохранить. Возможно, урок изменён в другой вкладке: '+saveError.message);setPending(false);return}
  if(!Number.isInteger(data)||data!==revision+1){setError('Некорректное подтверждение редакции от сервера.');setPending(false);return}
  setRevision(data);setOriginalContent(content);setMessage('Новая редакция урока №'+data+' сохранена на сервере.');
  setPending(false);setReload(n=>n+1);
 }
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">4.2 · редактор уроков</small></div><nav className="actions"><Link href="/">Кабинет</Link><Link href="/overview">Панель</Link><Link href="/curriculum">КТП</Link><Link href="/results">Результаты</Link></nav></div></header>
 <main className="container"><h1>Редактор уроков</h1><p className="muted">Откройте черновик, связанный с КТП, настройте ход занятия и сохраните новую редакцию на сервере. Документы другого учителя недоступны.</p>
 <div className="warning">Тестовый режим. Не вводите данные реальных несовершеннолетних до завершения проверки безопасности и развёртывания.</div>
 {!loaded&&<p>Проверка доступа…</p>}{error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 {!!memberships.length&&<section className="card">
 <div className="grid"><div><label htmlFor="lessonSchool">Школа</label><select id="lessonSchool" value={school} onChange={e=>{setSchool(e.target.value);setClassId('')}}>{memberships.map(m=><option key={m.school_id} value={m.school_id}>{m.school_id.slice(0,8)}…</option>)}</select></div><div><label htmlFor="lessonClass">Мой класс</label><select id="lessonClass" value={chosen} onChange={e=>setClassId(e.target.value)}>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.label} · {c.academic_year}</option>)}</select></div></div>
 <label htmlFor="lessonPick">Черновик</label><select id="lessonPick" value={selected} onChange={e=>selectLesson(e.target.value)}><option value="">Выберите урок</option>{documents.map(d=><option key={d.id} value={d.id}>{d.topic} · редакция {d.revision}</option>)}</select>
 {!documents.length&&<p className="muted">Уроков пока нет. Откройте «КТП», согласуйте темы и создайте черновик.</p>}
 </section>}
 {selectedDoc&&<form onSubmit={e=>void save(e)} className="card">
 <h2>{lesson.topic}</h2><p className="muted">Версия документа: {revision}. {selectedDoc.curriculum_topic_id?'Связан с темой КТП.':'Без привязки к КТП.'}</p>
 <label htmlFor="lessonTopic">Тема урока</label><input id="lessonTopic" maxLength={300} value={lesson.topic} onChange={e=>edit('topic',e.target.value)}/>
 <div className="grid"><div><label htmlFor="lessonGoals">Цели обучения</label><textarea id="lessonGoals" rows={4} maxLength={2000} value={lesson.goals} onChange={e=>edit('goals',e.target.value)}/></div>
 <div><label htmlFor="lessonNotes">Методические заметки</label><textarea id="lessonNotes" rows={4} maxLength={8000} value={lesson.notes} onChange={e=>edit('notes',e.target.value)}/></div>
 <div><label htmlFor="lessonDate">Планируемая дата</label><input id="lessonDate" type="date" value={lesson.scheduled_on} onChange={e=>edit('scheduled_on',e.target.value)}/></div>
 <div><label htmlFor="lessonHours">Учебных часов</label><input id="lessonHours" type="number" min={1} max={50} value={lesson.hours} onChange={e=>edit('hours',e.target.value)}/></div></div>
 <h2>Ход урока</h2><p className="muted">Всего запланировано: {phaseMinutes} мин. Уточните длительность в соответствии с расписанием.</p>
 {lesson.phases.map((phase,i)=><div className="card" style={{boxShadow:'none'}} key={i}>
 <div className="actions"><b>Этап {i+1}</b><button type="button" className="btn" disabled={pending||lesson.phases.length===1} onClick={()=>setLesson(d=>({...d,phases:d.phases.filter((_,n)=>n!==i)}))}>Удалить этап</button></div>
 <div className="grid">
 <div><label htmlFor={'lessonPhaseName'+i}>Название этапа</label><input id={'lessonPhaseName'+i} maxLength={200} value={phase.title} onChange={e=>editPhase(i,'title',e.target.value)}/></div>
 <div><label htmlFor={'lessonPhaseMinutes'+i}>Минуты</label><input id={'lessonPhaseMinutes'+i} type="number" min={1} max={240} value={phase.minutes} onChange={e=>editPhase(i,'minutes',e.target.value)}/></div>
 {([['teacher','Действия педагога'],['student','Действия учащихся'],['evaluation','Оценивание'],['resources','Ресурсы']] as const).map(([k,label])=>
 <div key={k}><label htmlFor={'lessonPhase'+k+i}>{label}</label><textarea id={'lessonPhase'+k+i} rows={3} maxLength={3000} value={phase[k]} onChange={e=>editPhase(i,k,e.target.value)}/></div>)}
 </div></div>)}
 <div className="actions"><button type="button" className="btn" disabled={pending||lesson.phases.length>=40} onClick={()=>setLesson(d=>({...d,phases:[...d.phases,emptyPhase()]}))}>Добавить этап</button>
 <button className="btn primary" type="submit" disabled={pending}>{pending?'Сохранение…':'Сохранить редакцию'}</button>
 <Link href="/curriculum">К темам КТП →</Link></div>
 </form>}</main></>;
}
