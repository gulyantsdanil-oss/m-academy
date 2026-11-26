'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,Membership} from '@/lib/types';

type Roster={class_id:string;teacher_id?:string;student_id?:string;subject?:string};
const sb=getSupabase();
const short=(x:string)=>x.slice(0,8)+'…';

export default function AdminRoster(){
 const [uid,setUid]=useState('');
 const [schools,setSchools]=useState<string[]>([]);
 const [school,setSchool]=useState('');
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [members,setMembers]=useState<(Membership&{user_id:string})[]>([]);
 const [teachers,setTeachers]=useState<Roster[]>([]);
 const [students,setStudents]=useState<Roster[]>([]);
 const [classId,setClassId]=useState('');
 const [teacherId,setTeacherId]=useState('');
 const [studentId,setStudentId]=useState('');
 const [subject,setSubject]=useState('Математика');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [reload,setReload]=useState(0);
 const [ready,setReady]=useState(false);

 useEffect(()=>{
  let active=true;
  (async()=>{
   if(!sb){setError('Supabase не подключён.');setReady(true);return}
   const {data,error:authError}=await sb.auth.getUser();
   if(!active)return;
   if(authError||!data.user){setError('Необходимо войти в серверный кабинет.');setReady(true);return}
   const userId=data.user.id;setUid(userId);
   const memberships=await sb.from('memberships').select('school_id,role,active')
    .eq('user_id',userId).eq('role','admin').eq('active',true);
   if(!active)return;
   if(memberships.error){setError(memberships.error.message);setReady(true);return}
   const ids=(memberships.data||[]).map(m=>m.school_id as string);
   setSchools(ids);setSchool(ids[0]||'');
   if(!ids.length)setError('Этот аккаунт не назначен администратором школы.');
   setReady(true);
  })();
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  if(!sb||!uid||!school){setClasses([]);setMembers([]);setTeachers([]);setStudents([]);return}
  let active=true;
  (async()=>{
   setError('');
   const [cr,mr,tr,sr]=await Promise.all([
    sb.from('classes').select('id,school_id,label,academic_year').eq('school_id',school).order('label').limit(500),
    sb.from('memberships').select('school_id,user_id,role,active').eq('school_id',school).eq('active',true).limit(1000),
    sb.from('class_teachers').select('class_id,teacher_id,subject').eq('school_id',school).limit(1000),
    sb.from('class_students').select('class_id,student_id').eq('school_id',school).limit(1000)
   ]);
   if(!active)return;
   const failure=[cr,mr,tr,sr].find(x=>x.error)?.error;
   if(failure){setError(failure.message);return}
   const cl=(cr.data||[]) as ClassRoom[];
   setClasses(cl);setMembers((mr.data||[]) as (Membership&{user_id:string})[]);
   setTeachers((tr.data||[]) as Roster[]);setStudents((sr.data||[]) as Roster[]);
   setClassId(v=>cl.some(c=>c.id===v)?v:cl[0]?.id||'');
  })();
  return()=>{active=false};
 },[school,uid,reload]);

 const teachersAvailable=members.filter(m=>m.role==='teacher');
 const studentsAvailable=members.filter(m=>m.role==='student');
 const chosen=classes.some(c=>c.id===classId)?classId:classes[0]?.id||'';
 const selectedTeacher=teachersAvailable.some(m=>m.user_id===teacherId)?teacherId:teachersAvailable[0]?.user_id||'';
 const selectedStudent=studentsAvailable.some(m=>m.user_id===studentId)?studentId:studentsAvailable[0]?.user_id||'';
 const linkedTeachers=teachers.filter(r=>r.class_id===chosen);
 const linkedStudents=students.filter(r=>r.class_id===chosen);

 async function assign(event:FormEvent,kind:'teacher'|'student'){
  event.preventDefault();if(!sb||busy||!school||!chosen)return;
  const target=kind==='teacher'?selectedTeacher:selectedStudent;
  if(!target){setError('В школе ещё нет пользователя с нужной ролью. Создайте его через доверенное администрирование.');return}
  if(kind==='teacher'&&(subject.trim().length<2||subject.trim().length>100)){setError('Предмет должен содержать от 2 до 100 символов.');return}
  const exists=kind==='teacher'
   ?teachers.some(r=>r.class_id===chosen&&r.teacher_id===target&&r.subject===subject.trim())
   :students.some(r=>r.class_id===chosen&&r.student_id===target);
  if(exists){setError('Такое назначение уже существует.');return}
  setBusy(true);setError('');setMessage('');
  const res=kind==='teacher'
   ?await sb.from('class_teachers').insert({school_id:school,class_id:chosen,teacher_id:target,subject:subject.trim()})
   :await sb.from('class_students').insert({school_id:school,class_id:chosen,student_id:target});
  setBusy(false);
  if(res.error){setError('Назначение не выполнено: '+res.error.message);return}
  setMessage(kind==='teacher'?'Учитель назначен на предмет и класс.':'Ученик добавлен в класс.');
  setReload(n=>n+1);
 }

 async function unassign(kind:'teacher'|'student',row:Roster){
  if(!sb||busy||!chosen||!school)return;
  if(!window.confirm('Отменить назначение? Доступ к материалам класса может измениться.'))return;
  setBusy(true);setError('');setMessage('');
  const res=kind==='teacher'
   ?await sb.from('class_teachers').delete().eq('school_id',school).eq('class_id',chosen)
    .eq('teacher_id',row.teacher_id!).eq('subject',row.subject!)
   :await sb.from('class_students').delete().eq('school_id',school).eq('class_id',chosen)
    .eq('student_id',row.student_id!);
  setBusy(false);
  if(res.error){setError('Назначение не удалено: '+res.error.message);return}
  setMessage('Назначение отменено.');setReload(n=>n+1);
 }

 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Администрирование · пилот</small></div>
 <nav className="actions"><Link href="/">Кабинет</Link><Link href="/overview">Панель</Link><Link href="/classes">Классы</Link><Link href="/help">Помощь</Link></nav></div></header>
 <main className="container"><h1>Участники классов</h1>
 <p className="muted">Администратор назначает только уже созданные учётные записи с действующими ролями. Создание аккаунтов и назначение школьных ролей остаются в защищённой административной процедуре.</p>
 <div className="warning">Пилотная функция для тестовых аккаунтов взрослых. Идентификаторы показаны сокращённо, поэтому перед назначением требуется сверка с доверенным списком участников. Не вводите здесь реальные данные учащихся.</div>
 {!ready&&<p>Проверка полномочий…</p>}
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 {!!schools.length&&<section className="card"><div className="grid">
 <div><label htmlFor="rosterSchool">Школа</label><select id="rosterSchool" value={school} onChange={e=>{setSchool(e.target.value);setTeacherId('');setStudentId('')}}>
 {schools.map(id=><option value={id} key={id}>{short(id)}</option>)}</select></div>
 <div><label htmlFor="rosterClass">Класс</label><select id="rosterClass" value={chosen} onChange={e=>setClassId(e.target.value)}>
 {classes.map(c=><option value={c.id} key={c.id}>{c.label} · {c.academic_year}</option>)}</select></div></div>
 {!classes.length&&<p className="muted">Нет классов. Администратор может создать класс в главном кабинете.</p>}</section>}
 {!!school&&!!chosen&&<div className="grid"><section className="card"><h2>Педагоги класса</h2>
 <p className="muted">Назначений: {linkedTeachers.length}</p>
 {linkedTeachers.map((r,i)=><div className="item" key={r.teacher_id+'-'+r.subject+'-'+i}>
 <b>{short(r.teacher_id||'')}</b> · {r.subject}
 <button className="btn" type="button" disabled={busy} onClick={()=>void unassign('teacher',r)}>Снять назначение</button>
 </div>)}
 <form onSubmit={e=>void assign(e,'teacher')}>
 <label htmlFor="rosterTeacher">Учитель (проверенный ID)</label><select id="rosterTeacher" value={selectedTeacher} onChange={e=>setTeacherId(e.target.value)}>
 {teachersAvailable.map(m=><option key={m.user_id} value={m.user_id}>{short(m.user_id)}</option>)}</select>
 <label htmlFor="rosterSubject">Предмет</label><input id="rosterSubject" value={subject} maxLength={100} onChange={e=>setSubject(e.target.value)}/>
 <button className="btn primary" disabled={busy||!teachersAvailable.length} type="submit">Назначить учителя</button></form>
 </section><section className="card"><h2>Ученики класса</h2>
 <p className="muted">Назначений: {linkedStudents.length}</p>
 {linkedStudents.map(r=><div className="item" key={r.student_id}>
 <b>{short(r.student_id||'')}</b>
 <button className="btn" type="button" disabled={busy} onClick={()=>void unassign('student',r)}>Исключить из класса</button></div>)}
 <form onSubmit={e=>void assign(e,'student')}>
 <label htmlFor="rosterStudent">Ученик (тестовый ID)</label><select id="rosterStudent" value={selectedStudent} onChange={e=>setStudentId(e.target.value)}>
 {studentsAvailable.map(m=><option key={m.user_id} value={m.user_id}>{short(m.user_id)}</option>)}</select>
 <button className="btn primary" disabled={busy||!studentsAvailable.length} type="submit">Добавить ученика</button></form>
 </section></div>}</main></>;
}
