'use client';
import {SiteHeader} from '@/components/SiteHeader';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {Membership,Role,ClassRoom} from '@/lib/types';
type Row={id:string;school_id:string;class_id:string;teacher_id:string;topic:string;published:boolean;created_at:string};
type Submitted={id:string;assignment_id:string;student_id:string;submitted_at:string};
type Grade={submission_id:string;score:number;feedback:string|null};
type View={schoolId:string;role:Role};
const api=getSupabase();
export default function ResultsPage(){
 const [view,setView]=useState<View|null>(null);
 const [userId,setUserId]=useState('');
 const [memberships,setMemberships]=useState<Membership[]>([]);
 const [selected,setSelected]=useState('');
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [assignments,setAssignments]=useState<Row[]>([]);
 const [submissions,setSubmissions]=useState<Submitted[]>([]);
 const [grades,setGrades]=useState<Grade[]>([]);
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   if(!api){setError('Подключение Supabase не настроено.');setLoading(false);return}
   const auth=await api.auth.getUser();if(!alive)return;
   if(auth.error||!auth.data.user){setError('Для просмотра результатов требуется вход в серверный кабинет.');setLoading(false);return}
   const uid=auth.data.user.id;setUserId(uid);
   const {data,error:membershipError}=await api.from('memberships')
    .select('school_id,role,active').eq('user_id',uid).eq('active',true);
   if(!alive)return;
   if(membershipError){setError(membershipError.message);setLoading(false);return}
   const ms=(data||[]) as Membership[];
   const allowed=ms.filter(m=>m.role==='teacher'||m.role==='student');
   setMemberships(allowed);setSelected(allowed[0]?.school_id||'');
   if(!allowed.length)setError('Нет активного назначения учителем или учеником. Для администратора доступна только общая панель.');
   setLoading(false);
  })();
  return()=>{alive=false};
 },[]);
 const membership=memberships.find(m=>m.school_id===selected)||null;
 useEffect(()=>{
  if(!api||!membership||!userId){setView(null);setAssignments([]);setSubmissions([]);setGrades([]);return}
  let alive=true;
  (async()=>{
   setPending(true);setError('');setView(null);
   const role=membership.role,schoolId=membership.school_id;
   const [classesResult,assignmentsResult]=await Promise.all([
    api.from('classes').select('id,school_id,label,academic_year').eq('school_id',schoolId).limit(500),
    role==='teacher'
     ?api.from('assignments').select('id,school_id,class_id,teacher_id,topic,published,created_at')
       .eq('school_id',schoolId).eq('teacher_id',userId).order('created_at',{ascending:false}).limit(100)
     :api.from('assignments').select('id,school_id,class_id,teacher_id,topic,published,created_at')
       .eq('school_id',schoolId).eq('published',true).order('created_at',{ascending:false}).limit(100)
   ]);
   if(!alive)return;
   if(classesResult.error||assignmentsResult.error){setError(classesResult.error?.message||assignmentsResult.error?.message||'Не удалось прочитать задания');setPending(false);return}
   const a=(assignmentsResult.data||[]) as Row[];
   const ids=a.map(item=>item.id);
   let sub:Submitted[]=[];
   let scores:Grade[]=[];
   if(ids.length){
    const sr=await api.from('submissions')
     .select('id,assignment_id,student_id,submitted_at')
     .in('assignment_id',ids)
     .eq('school_id',schoolId)
     .order('submitted_at',{ascending:false}).limit(1000);
    if(!alive)return;
    if(sr.error){setError(sr.error.message);setPending(false);return}
    sub=(sr.data||[]) as Submitted[];
    if(sub.length){
     // Batch IDs so large classes do not exceed URL limits in PostgREST.
     for(let offset=0;offset<sub.length;offset+=60){
      const ids=sub.slice(offset,offset+60).map(x=>x.id);
      const gr=await api.from('submission_grades').select('submission_id,score,feedback')
       .in('submission_id',ids).eq('school_id',schoolId);
      if(!alive)return;
      if(gr.error){setError(gr.error.message);setPending(false);return}
      scores.push(...((gr.data||[]) as Grade[]));
     }
    }
   }
   if(!alive)return;
   setClasses((classesResult.data||[]) as ClassRoom[]);
   setAssignments(a);setSubmissions(sub);setGrades(scores);setView({schoolId,role});
   setPending(false);
  })();
  return()=>{alive=false};
 },[membership,userId,revision]);
 const student=membership?.role==='student';
 const stats=useMemo(()=>{
  const graded=new Set(grades.map(g=>g.submission_id));
  return {assigned:assignments.length,submitted:submissions.length,checked:submissions.filter(s=>graded.has(s.id)).length};
 },[assignments,submissions,grades]);
 const schoolName=(classId:string)=>classes.find(c=>c.id===classId)?.label||'Класс';
 return <><SiteHeader /><main className="container inner-main">
 <h1>{student?'Мои результаты':'Контроль выполненных работ'}</h1>
 <p className="muted">Сведения читаются из защищённой базы и проверяются правилами доступа. Отображаются максимум 100 последних заданий и 1000 работ — это не полная общешкольная статистика.</p>
 <div className="warning">Пилотный модуль. Для работы с реальными учащимися требуется предварительная проверка безопасности, требований обработки данных и серверной инфраструктуры.</div>
 {loading&&<p role="status">Проверка аккаунта…</p>}{error&&<p className="error" role="alert">{error}</p>}
 {!!memberships.length&&<section className="card"><div className="grid"><div><label htmlFor="resultsSchool">Школа / роль</label><select id="resultsSchool" value={selected} onChange={e=>setSelected(e.target.value)}>{memberships.map(m=><option key={m.school_id} value={m.school_id}>{m.school_id.slice(0,8)}… · {m.role==='teacher'?'Учитель':'Ученик'}</option>)}</select></div><div><label>Актуализация</label><button type="button" className="btn" disabled={pending} onClick={()=>setRevision(v=>v+1)}>{pending?'Загрузка…':'Обновить результаты'}</button></div></div></section>}
 {view&&!pending&&<><div className="stat-grid"><div className="stat4"><strong>{stats.assigned}</strong><span>{student?'Доступных заданий':'Моих заданий'}</span></div><div className="stat4"><strong>{stats.submitted}</strong><span>{student?'Отправлено работ':'Получено работ'}</span></div><div className="stat4"><strong>{stats.checked}</strong><span>Проверено учителем</span></div><div className="stat4"><strong>{stats.submitted-stats.checked}</strong><span>Ожидают проверки</span></div></div>
 <section className="card"><h2>{student?'Мои задания и оценки':'Работы по заданиям'}</h2>
 {assignments.length===0?<p className="muted">Заданий пока нет.</p>:assignments.map(a=>{
  const matching=submissions.filter(s=>s.assignment_id===a.id);
  const mark=student?grades.find(g=>matching.some(s=>s.id===g.submission_id)):null;
  return <div className="item" key={a.id}><div className="actions"><Link href={'/assignments/'+a.id}><b>{a.topic}</b></Link><span className="tag">{schoolName(a.class_id)}</span></div>
  {student?<p className="muted">{matching.length?mark?'Проверено · '+mark.score+' балл(ов)':'Отправлено · ожидает оценки':'Работа не отправлена'}{mark?.feedback?' · Комментарий: '+mark.feedback:''}</p>
   :<p className="muted">Отправлено: {matching.length}. Проверено: {matching.filter(s=>grades.some(g=>g.submission_id===s.id)).length}. {a.published?'Опубликовано':'Черновик'}.</p>}
  </div>})}</section>
 </>}
 </main></>;
}
