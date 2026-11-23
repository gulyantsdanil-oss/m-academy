'use client';
import {useCallback,useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {getSupabase} from '@/lib/supabase';
import type {Assignment} from '@/lib/types';

const sb=getSupabase();
type Question={id:string;position:number;question_text:string;level:string|null};
type Submission={id:string;student_id:string;submitted_at:string};
type Answer={submission_id:string;question_id:string;answer_text:string};
type Grade={submission_id:string;score:number;feedback:string|null};
function shortId(id:string){return id.slice(0,8)+'…'}
export default function AssignmentPage(){
 const params=useParams<{id:string}>(),id=String(params.id||'');
 const [userId,setUserId]=useState('');
 const [assignment,setAssignment]=useState<Assignment|null>(null);
 const [kind,setKind]=useState<'teacher'|'student'|null>(null);
 const [questions,setQuestions]=useState<Question[]>([]);
 const [values,setValues]=useState<Record<string,string>>({});
 const [submissions,setSubmissions]=useState<Submission[]>([]);
 const [answers,setAnswers]=useState<Answer[]>([]);
 const [keys,setKeys]=useState<Record<string,string>>({});
 const [grades,setGrades]=useState<Grade[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [mine,setMine]=useState<string|null>(null);
 const [scoreById,setScoreById]=useState<Record<string,string>>({});
 const [feedbackById,setFeedbackById]=useState<Record<string,string>>({});

 const reload=useCallback(async()=>{
  if(!sb||!/^[0-9a-fA-F-]{36}$/.test(id)){setError('Неверная конфигурация или ссылка.');setLoading(false);return}
  setError('');setLoading(true);
  const auth=await sb.auth.getUser();
  if(auth.error||!auth.data.user){setError('Сначала войдите в аккаунт пилотной платформы.');setLoading(false);return}
  const uid=auth.data.user.id;setUserId(uid);
  const found=await sb.from('assignments').select('id,school_id,class_id,teacher_id,topic,published,created_at').eq('id',id).maybeSingle();
  if(found.error||!found.data){setError('Задание недоступно для этого аккаунта.');setLoading(false);return}
  const a=found.data as Assignment & {teacher_id:string};
  const membership=await sb.from('memberships').select('role,active').eq('school_id',a.school_id).eq('user_id',uid).eq('active',true).maybeSingle();
  if(membership.error||!membership.data){setError('У вас нет роли в этой школе.');setLoading(false);return}
  const role=membership.data.role as string;
  if(role!=='student'&&!(role==='teacher'&&a.teacher_id===uid)){
   setError('Эта страница доступна только назначенному учителю или ученику класса.');setLoading(false);return;
  }
  const isTeacher=role==='teacher';setKind(isTeacher?'teacher':'student');setAssignment(a);
  const q=await sb.from('assignment_questions').select('id,position,question_text,level')
   .eq('assignment_id',id).order('position');
  if(q.error){setError(q.error.message);setLoading(false);return}
  const qs=(q.data||[]) as Question[];setQuestions(qs);
  if(isTeacher){
   const [submitted,keyRows]=await Promise.all([
    sb.from('submissions').select('id,student_id,submitted_at').eq('assignment_id',id).order('submitted_at',{ascending:false}),
    qs.length?sb.from('assignment_keys').select('question_id,answer_text').in('question_id',qs.map(x=>x.id)):
    Promise.resolve({data:[],error:null})
   ]);
   if(submitted.error||keyRows.error)setError(submitted.error?.message||keyRows.error?.message||'');
   const ss=(submitted.data||[]) as Submission[];setSubmissions(ss);
   setKeys(Object.fromEntries((keyRows.data||[]).map(row=>[row.question_id,row.answer_text])));
   const ids=ss.map(x=>x.id);
   if(ids.length){
    const [answerRows,gradeRows]=await Promise.all([
     sb.from('submission_answers').select('submission_id,question_id,answer_text').in('submission_id',ids),
     sb.from('submission_grades').select('submission_id,score,feedback').in('submission_id',ids)
    ]);
    if(answerRows.error||gradeRows.error)setError(answerRows.error?.message||gradeRows.error?.message||'');
    setAnswers((answerRows.data||[]) as Answer[]);
    const g=(gradeRows.data||[]) as Grade[];setGrades(g);
    setScoreById(Object.fromEntries(g.map(x=>[x.submission_id,String(x.score)])));
    setFeedbackById(Object.fromEntries(g.map(x=>[x.submission_id,x.feedback||''])));
   }else{setAnswers([]);setGrades([])}
  }else{
   const old=await sb.from('submissions').select('id').eq('assignment_id',id).eq('student_id',uid).maybeSingle();
   if(old.error)setError(old.error.message);
   const submissionId=old.data?.id||null;
   setMine(submissionId);
   if(submissionId){
    const graded=await sb.from('submission_grades').select('submission_id,score,feedback').eq('submission_id',submissionId).maybeSingle();
    if(graded.error)setError(graded.error.message);
    setGrades(graded.data?[graded.data as Grade]:[]);
   }
  }
  setLoading(false);
 },[id]);

 useEffect(()=>{void reload()},[reload]);

 async function submit(){
  if(!sb||!assignment||kind!=='student'||busy||mine)return;
  if(questions.length===0||questions.some(q=>!values[q.id]?.trim())){setError('Заполните ответы на все вопросы.');return}
  if(questions.some(q=>values[q.id].length>1000)){setError('Ответ превышает 1000 символов.');return}
  if(!window.confirm('Отправить ответы? После отправки изменить их нельзя.'))return;
  setBusy(true);setError('');
  const {data,error:rpcError}=await sb.rpc('submit_assignment_answers',{
   p_assignment:assignment.id,p_answers:values
  });
  setBusy(false);
  if(rpcError)setError(rpcError.message);
  else{setMine(String(data));setMessage('Работа отправлена. Оценку и комментарий выставляет педагог.')}
 }
 async function grade(submissionId:string){
  if(!sb||!assignment||kind!=='teacher'||busy)return;
  const score=Number(scoreById[submissionId]);
  if(!Number.isFinite(score)||score<0||score>questions.length){setError('Балл должен быть от 0 до '+questions.length);return}
  setBusy(true);setError('');
  const result=await sb.from('submission_grades').upsert({
   school_id:assignment.school_id,submission_id:submissionId,
   graded_by:userId,score,feedback:(feedbackById[submissionId]||'').trim().slice(0,3000),
   graded_at:new Date().toISOString()
  },{onConflict:'submission_id'});
  setBusy(false);
  if(result.error)setError(result.error.message);
  else{setMessage('Оценка сохранена.');void reload()}
 }
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Пилот</small></div><a href="/">← К кабинету</a></div></header>
 <main className="container">
 {loading?<p>Загрузка задания…</p>:error&&!assignment?<div className="warning">{error}</div>:assignment&&<>
 <h1>{assignment.topic}</h1>
 <p className="muted">{kind==='teacher'?'Режим учителя':'Самостоятельная работа'} · {assignment.published?'Опубликовано':'Черновик'}</p>
 {error&&<p className="error" role="alert">{error}</p>}
 {message&&<p className="success" role="status">{message}</p>}
 {kind==='student'&&!assignment.published&&<div className="warning">Задание пока не опубликовано.</div>}
 <section className="card"><h2>Вопросы ({questions.length})</h2>
 {questions.map((q,i)=><div className="item" key={q.id}>
 <p><b>{i+1}. [{q.level||'A'}]</b> {q.question_text}</p>
 {kind==='student'&&!mine&&<><label htmlFor={q.id}>Ваш ответ</label><input id={q.id} value={values[q.id]||''} maxLength={1000} onChange={e=>setValues(v=>({...v,[q.id]:e.target.value}))}/></>}
 {kind==='teacher'&&<p className="muted">Ключ педагога: {keys[q.id]||'—'}</p>}
 </div>)}
 {kind==='student'&&mine&&grades.length>0&&<div className="card" style={{background:'#ecfdf5'}}>
 <h3>Проверка учителя</h3><p><b>Балл: {grades[0].score} из {questions.length}</b></p>
 {grades[0].feedback&&<p>Комментарий: {grades[0].feedback}</p>}
 </div>}
 {kind==='student'&&(mine?<div className="success">Ответы уже отправлены. Повторная отправка закрыта.</div>:
 <button className="btn primary" disabled={busy||!assignment.published} onClick={()=>void submit()}>{busy?'Отправка…':'Отправить ответы'}</button>)}
 </section>
 {kind==='teacher'&&<section className="card"><h2>Полученные работы ({submissions.length})</h2>
 {submissions.length===0?<p className="muted">Работ ещё нет.</p>:submissions.map(s=><div className="card" key={s.id}>
 <h3>Ученик: {shortId(s.student_id)}</h3><p className="muted">Отправлено: {new Date(s.submitted_at).toLocaleString('ru-RU')}</p>
 {questions.map(q=><div className="item" key={q.id}>
 <b>{q.position}. {q.question_text}</b>
 <p>Ответ ученика: {answers.find(a=>a.submission_id===s.id&&a.question_id===q.id)?.answer_text||'—'}</p>
 <p className="muted">Ключ: {keys[q.id]||'—'}</p>
 </div>)}
 <div className="grid">
 <div><label htmlFor={'score'+s.id}>Балл (0–{questions.length})</label>
 <input id={'score'+s.id} type="number" min={0} max={questions.length} step="0.5" value={scoreById[s.id]||''} onChange={e=>setScoreById(v=>({...v,[s.id]:e.target.value}))}/></div>
 <div><label htmlFor={'feedback'+s.id}>Комментарий</label>
 <input id={'feedback'+s.id} value={feedbackById[s.id]||''} maxLength={3000} onChange={e=>setFeedbackById(v=>({...v,[s.id]:e.target.value}))}/></div>
 </div><p><button className="btn primary" disabled={busy} onClick={()=>void grade(s.id)}>Сохранить оценку</button></p>
 {grades.some(g=>g.submission_id===s.id)&&<small className="success">Ранее выставлена оценка</small>}
 </div>)}
 </section>}
 </>}
 </main></>;
}
