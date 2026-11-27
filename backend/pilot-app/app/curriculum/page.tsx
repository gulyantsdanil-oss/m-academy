'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,Membership,TeacherAssignment} from '@/lib/types';

type Plan={id:string;school_id:string;class_id:string;teacher_id:string;subject:string;content:unknown;revision:number};
type Topic={id:string;school_id:string;class_id:string;teacher_id:string;plan_id:string;position:number;topic:string;hours:number;scheduled_on:string|null;goals:string};
type Draft={id:string;curriculum_topic_id:string|null;topic:string};
type Ksp={id:string;curriculum_topic_id:string|null;topic:string};
type Assignment={id:string;curriculum_topic_id:string|null;topic:string;published:boolean};
type Candidate={position:number;topic:string;hours:number;scheduled_on:string|null;goals:string};
const api=getSupabase();
const asObj=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
function decodeRows(content:unknown):Candidate[]{
 if(!asObj(content)||!Array.isArray(content.rows)||content.rows.length>1000)throw Error('КТП не содержит корректного массива rows (максимум 1000).');
 return content.rows.map((row:unknown,i:number)=>{
  if(!asObj(row))throw Error('Строка '+(i+1)+' имеет неверный формат.');
  const topic=String(row.topic??'').trim(),hours=Number(row.hours??1),goals=String(row.goals??row.objectives??row.learning_goals??'');
  const date=String(row.date??'').trim();
  if(topic.length<2||topic.length>300||!Number.isInteger(hours)||hours<1||hours>50||goals.length>2000||
    (date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))throw Error('Исправьте тему, часы, цели или дату в строке '+(i+1)+'. Дата должна быть ГГГГ-ММ-ДД.');
  if(date&&!Number.isFinite(Date.parse(date+'T12:00:00Z')))throw Error('Неверная дата в строке '+(i+1)+'.');
  return {position:i+1,topic,hours,goals,scheduled_on:date||null};
 });
}
export default function CurriculumPage(){
 const [uid,setUid]=useState('');
 const [school,setSchool]=useState('');
 const [schoolNames,setSchoolNames]=useState<Record<string,string>>({});
 const [memberships,setMemberships]=useState<Membership[]>([]);
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [teaching,setTeaching]=useState<TeacherAssignment[]>([]);
 const [classId,setClassId]=useState('');
 const [plans,setPlans]=useState<Plan[]>([]);
 const [planId,setPlanId]=useState('');
 const [topics,setTopics]=useState<Topic[]>([]);
 const [drafts,setDrafts]=useState<Draft[]>([]);
 const [ksp,setKsp]=useState<Ksp[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false);
 const [tick,setTick]=useState(0);
 const selectedPlan=plans.find(p=>p.id===planId)||null;
 const availableClasses=useMemo(()=>classes.filter(c=>teaching.some(t=>t.class_id===c.id)),[classes,teaching]);
 const candidates=useMemo(()=>{
  if(!selectedPlan)return {rows:[] as Candidate[],error:''};
  try{return {rows:decodeRows(selectedPlan.content),error:''}}catch(err){return {rows:[] as Candidate[],error:err instanceof Error?err.message:'Некорректное КТП'}
  }
 },[selectedPlan]);
 const currentTopics=topics.filter(t=>t.plan_id===planId).sort((a,b)=>a.position-b.position);
 const matches=currentTopics.length===candidates.rows.length&&currentTopics.every((t,i)=>{
  const r=candidates.rows[i];return t.position===r.position&&t.topic===r.topic&&t.hours===r.hours&&t.goals===r.goals&&(t.scheduled_on||null)===r.scheduled_on;
 });
 const hasLinks=currentTopics.some(t=>drafts.some(d=>d.curriculum_topic_id===t.id)||ksp.some(d=>d.curriculum_topic_id===t.id)||assignments.some(a=>a.curriculum_topic_id===t.id));
 const loadIdentity=useCallback(async()=>{
  if(!api){setError('Сервер не подключён. Настройте Supabase для пилота.');setReady(true);return}
  const {data,error:authError}=await api.auth.getUser();
  if(authError||!data.user){setError('Сначала войдите в серверный кабинет.');setReady(true);return}
  const id=data.user.id;setUid(id);
  const mr=await api.from('memberships').select('school_id,role,active').eq('user_id',id).eq('role','teacher').eq('active',true);
  if(mr.error){setError(mr.error.message);setReady(true);return}
  const memberships=(mr.data||[]) as Membership[];setMemberships(memberships);
  if(memberships.length){
   const names=await api.from('schools').select('id,name').in('id',memberships.map(m=>m.school_id));
   if(!names.error)setSchoolNames(Object.fromEntries((names.data||[]).map(v=>[v.id as string,v.name as string])));
  }
  if(!memberships.length)setError('Пользователь не назначен учителем ни в одной школе.');
  setSchool(s=>memberships.some(m=>m.school_id===s)?s:memberships[0]?.school_id||'');setReady(true);
 },[]);
 useEffect(()=>{void loadIdentity()},[loadIdentity]);
 useEffect(()=>{
  if(!api||!uid||!school){setClasses([]);setTeaching([]);return}
  let active=true;
  (async()=>{
   setError('');setMessage('');
   const [cr,tr]=await Promise.all([
    api.from('classes').select('id,school_id,label,academic_year').eq('school_id',school).limit(500),
    api.from('class_teachers').select('class_id,school_id,subject').eq('school_id',school).eq('teacher_id',uid).limit(500)
   ]);
   if(!active)return;
   if(cr.error||tr.error){setError(cr.error?.message||tr.error?.message||'Не удалось открыть классы');return}
   const cl=(cr.data||[]) as ClassRoom[],teach=(tr.data||[]) as TeacherAssignment[];
   setClasses(cl);setTeaching(teach);
   setClassId(prev=>teach.some(t=>t.class_id===prev)?prev:teach[0]?.class_id||'');
  })();return()=>{active=false};
 },[uid,school]);
 useEffect(()=>{
  if(!api||!uid||!school||!classId){setPlans([]);setTopics([]);setDrafts([]);setKsp([]);setAssignments([]);return}
  let active=true;
  (async()=>{
   setError('');setMessage('');
   const [pr,tr,dr,kr,ar]=await Promise.all([
    api.from('curriculum_plans').select('id,school_id,class_id,teacher_id,subject,content,revision').eq('school_id',school).eq('class_id',classId).eq('teacher_id',uid).limit(100),
    api.from('curriculum_topics').select('id,school_id,class_id,teacher_id,plan_id,position,topic,hours,scheduled_on,goals').eq('school_id',school).eq('class_id',classId).eq('teacher_id',uid).limit(1000),
    api.from('lesson_drafts').select('id,curriculum_topic_id,topic').eq('school_id',school).eq('class_id',classId).eq('teacher_id',uid).limit(500),
    api.from('ksp_documents').select('id,curriculum_topic_id,topic').eq('school_id',school).eq('class_id',classId).eq('teacher_id',uid).limit(500),
    api.from('assignments').select('id,curriculum_topic_id,topic,published').eq('school_id',school).eq('class_id',classId).eq('teacher_id',uid).limit(500)
   ]);
   if(!active)return;
   const failed=[pr,tr,dr,kr,ar].find(x=>x.error);
   if(failed?.error){setError('Не удалось получить связанные данные. Проверьте, применена ли миграция 20261126100000_curriculum_flow.sql. '+failed.error.message);return}
   const incoming=(pr.data||[]) as Plan[];
   setPlans(incoming);setPlanId(prev=>incoming.some(p=>p.id===prev)?prev:incoming[0]?.id||'');
   setTopics((tr.data||[]) as Topic[]);setDrafts((dr.data||[]) as Draft[]);setKsp((kr.data||[]) as Ksp[]);setAssignments((ar.data||[]) as Assignment[]);
  })();return()=>{active=false};
 },[uid,school,classId,tick]);
 async function synchronize(){
  if(!api||!uid||!selectedPlan||busy||candidates.error||!candidates.rows.length)return;
  if(hasLinks&&!matches){setError('В этом КТП уже существуют связанные КСП, уроки или задания. Изменение структуры тем заблокировано во избежание потери связей. Создайте новую редакцию КТП отдельно.');return}
  if(currentTopics.some(t=>t.position>candidates.rows.length)){setError('Число тем уменьшилось. Сначала согласуйте структуру КТП; автоматическое удаление существующих строк запрещено.');return}
  if(!window.confirm('Согласовать '+candidates.rows.length+' тем КТП с серверным реестром?'))return;
  setBusy(true);setError('');setMessage('');
  try{
   // Atomic function validates all rows and preserves topic IDs in a single transaction.
   const {data,error:syncError}=await api.rpc('sync_curriculum_topics',{
    p_plan:selectedPlan.id,p_rows:candidates.rows.map(r=>({
     topic:r.topic,hours:r.hours,scheduled_on:r.scheduled_on,goals:r.goals
    }))
   });
   if(syncError||data!==candidates.rows.length)throw Error(syncError?.message||'Сервер не подтвердил число тем.');
   setMessage('Реестр тем синхронизирован с КТП.');setTick(x=>x+1);
  }catch(err){setError('Синхронизация отклонена. '+(err instanceof Error?err.message:'Ошибка сохранения'))}
  finally{setBusy(false)}
 }
 async function createLesson(t:Topic){
  if(!api||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const existing=drafts.find(d=>d.curriculum_topic_id===t.id);
   if(existing){setMessage('К этой теме уже привязан черновик урока.');return}
   const content={source:'curriculum_topic',curriculum_topic_id:t.id,topic:t.topic,goals:t.goals,
    hours:t.hours,scheduled_on:t.scheduled_on,
    phases:[{title:'Начало урока',minutes:5},{title:'Основная часть',minutes:30},{title:'Рефлексия',minutes:5}],
    notes:'Черновик. Учитель должен проверить цели, время и содержание.'};
   const saved=await api.from('lesson_drafts').insert({school_id:school,class_id:classId,teacher_id:uid,curriculum_topic_id:t.id,topic:t.topic,content});
   if(saved.error)throw Error(saved.error.message);
   setMessage('Черновик урока создан и связан с темой КТП.');setTick(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:'Ошибка создания урока')}finally{setBusy(false)}
 }
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">4.1 · КТП → урок → задание</small></div><nav className="actions"><Link href="/">Кабинет</Link><Link href="/overview">Панель 4.0</Link><Link href="/lessons">Редактор уроков</Link><Link href="/assignments">Задания</Link><Link href="/results">Результаты</Link></nav></div></header>
 <main className="container"><h1>Связанные учебные материалы</h1><p className="muted">Каждая тема получает постоянный идентификатор в базе. Уроки и задания могут ссылаться на него без поиска по названию.</p>
 <div className="warning"><b>Пилотная функция.</b> Не используйте реальные данные учащихся до завершения проверки безопасности. КТП сначала сохраняется педагогом в серверном редакторе, затем темы синхронизируются отдельной кнопкой. Реальные данные учеников не используйте.</div>
 {!ready&&<p>Проверка доступа…</p>}
 {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
 {!!memberships.length&&<section className="card"><div className="grid"><div><label htmlFor="flowSchool">Школа</label><select id="flowSchool" value={school} onChange={e=>{setSchool(e.target.value);setClassId('');setPlanId('')}}>{memberships.map(m=><option key={m.school_id} value={m.school_id}>{schoolNames[m.school_id]||'Школа '+m.school_id.slice(0,8)+'…'}</option>)}</select></div><div><label htmlFor="flowClass">Мой класс</label><select id="flowClass" value={classId} onChange={e=>{setClassId(e.target.value);setPlanId('')}}>{availableClasses.map(c=><option key={c.id} value={c.id}>{c.label} · {c.academic_year}</option>)}</select></div></div>
 <label htmlFor="flowPlan">КТП</label><select id="flowPlan" value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Выберите КТП</option>{plans.map(p=><option key={p.id} value={p.id}>{p.subject} · редакция {p.revision}</option>)}</select>
 {!plans.length?<p className="warning">Для класса пока нет серверного КТП. Откройте главный кабинет → раздел «КТП / КСП» → выберите КТП. Можно подставить учебный пример для 10 класса, проверить его и сохранить. Затем вернитесь сюда и синхронизируйте темы.</p>:selectedPlan&&<><p className="muted">В КТП строк: {candidates.rows.length}. В реестре тем: {currentTopics.length}. Связанные уроки: {drafts.filter(d=>currentTopics.some(t=>t.id===d.curriculum_topic_id)).length}.</p>
 {candidates.error&&<p className="error">{candidates.error}</p>}
 <div className="actions"><button type="button" className="btn primary" disabled={busy||matches||!!candidates.error||!candidates.rows.length||(hasLinks&&!matches)} onClick={()=>void synchronize()}>{busy?'Сохранение…':matches?'КТП согласован':'Согласовать темы КТП'}</button><button type="button" className="btn" disabled={busy} onClick={()=>setTick(x=>x+1)}>Перечитать базу</button></div>
 {hasLinks&&!matches&&<p className="warning">К КТП привязаны материалы. Для изменения состава тем нужна контролируемая процедура обновления связей.</p>}
 <div className="card"><h2>Темы и связанные материалы</h2>{!currentTopics.length?<p className="muted">Сначала синхронизируйте темы.</p>:currentTopics.map(t=>{
 const linkedDrafts=drafts.filter(d=>d.curriculum_topic_id===t.id),linkedKsp=ksp.filter(d=>d.curriculum_topic_id===t.id),linkedAssignments=assignments.filter(a=>a.curriculum_topic_id===t.id);
 return <div key={t.id} className="item"><div><b>{t.position}. {t.topic}</b> <span className="tag">{t.hours} ч.</span></div><p className="muted">{t.goals||'Цель не указана'}{t.scheduled_on?' · '+t.scheduled_on:''}</p>
 <p className="muted">Уроков: {linkedDrafts.length}. КСП: {linkedKsp.length}. Заданий: {linkedAssignments.length}.</p><div className="actions"><button className="btn" disabled={busy||!!linkedDrafts.length} onClick={()=>void createLesson(t)}>{linkedDrafts.length?'Черновик создан':'Создать черновик урока'}</button><Link href="/">Создать задание в кабинете →</Link><Link href="/lessons">Редактировать уроки →</Link></div></div>})}</div></>}</section>}
 </main></>;
}
