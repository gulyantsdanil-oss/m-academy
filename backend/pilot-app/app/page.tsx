'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import type {User} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import type {Membership,School,ClassRoom,TeacherAssignment,StudentEnrollment,Assignment,Ksp} from '@/lib/types';
import {TeacherAssignmentBuilder} from '@/components/TeacherAssignmentBuilder';

const client=getSupabase();
type Readiness='loading'|'logged_out'|'ready'|'unconfigured';
type RoleView={school:School;membership:Membership};
function shortId(v:string){return v.slice(0,8)+'…'}
function ErrorText({value}:{value:string}){return value?<p className="error" role="alert">{value}</p>:null}

export default function PilotHome(){
 const [user,setUser]=useState<User|null>(null);
 const [readiness,setReadiness]=useState<Readiness>('loading');
 const [email,setEmail]=useState('');
 const [sending,setSending]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [memberships,setMemberships]=useState<RoleView[]>([]);
 const [activeSchoolId,setActiveSchoolId]=useState('');
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [teacherClasses,setTeacherClasses]=useState<TeacherAssignment[]>([]);
 const [enrolledClasses,setEnrolledClasses]=useState<StudentEnrollment[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [ksp,setKsp]=useState<Ksp[]>([]);
 const [name,setName]=useState('');
 const [academicYear,setAcademicYear]=useState('2026-2027');
 const [creating,setCreating]=useState(false);
 const [refreshToken,setRefreshToken]=useState(0);

 const reloadIdentity=useCallback(async()=>{
  if(!client){setReadiness('unconfigured');return}
  const {data,error:authError}=await client.auth.getUser();
  if(authError||!data.user){
   setUser(null);setReadiness('logged_out');setMemberships([]);return;
  }
  setUser(data.user);
  setReadiness('ready');
 },[]);

 useEffect(()=>{
  void reloadIdentity();
  if(!client)return;
  const {data:{subscription}}=client.auth.onAuthStateChange(()=>{void reloadIdentity()});
  return()=>subscription.unsubscribe();
 },[reloadIdentity]);

 useEffect(()=>{
  if(!client||!user)return;
  let alive=true;
  (async()=>{
   setError('');
   const {data:rows,error:membershipError}=await client.from('memberships')
    .select('school_id,role,active').eq('user_id',user.id).eq('active',true);
   if(!alive)return;
   if(membershipError){setError('Не удалось получить роли: '+membershipError.message);setMemberships([]);return}
   const ms=(rows||[]) as Membership[];
   if(!ms.length){setMemberships([]);return}
   const {data:schools,error:schoolsError}=await client.from('schools')
     .select('id,name').in('id',ms.map(m=>m.school_id));
   if(!alive)return;
   if(schoolsError){setError('Нет доступа к школам: '+schoolsError.message);return}
   const look=new Map(((schools||[]) as School[]).map(s=>[s.id,s]));
   const views=ms.flatMap(m=>look.has(m.school_id)?[{membership:m,school:look.get(m.school_id)!}]:[]);
   setMemberships(views);
   setActiveSchoolId(prev=>views.some(x=>x.school.id===prev)?prev:(views[0]?.school.id||''));
  })();
  return()=>{alive=false};
 },[user,refreshToken]);

 const active=useMemo(()=>memberships.find(x=>x.school.id===activeSchoolId)||null,[memberships,activeSchoolId]);

 useEffect(()=>{
  if(!client||!user||!active){setClasses([]);setTeacherClasses([]);setEnrolledClasses([]);setAssignments([]);setKsp([]);return}
  let alive=true;
  (async()=>{
   const schoolId=active.school.id;
   const [cr,tc,ec,ar,kr]=await Promise.all([
    client.from('classes').select('id,school_id,label,academic_year').eq('school_id',schoolId).order('label'),
    active.membership.role==='teacher'?client.from('class_teachers').select('class_id,school_id,subject').eq('school_id',schoolId).eq('teacher_id',user.id):Promise.resolve({data:[],error:null}),
    active.membership.role==='student'?client.from('class_students').select('class_id,school_id').eq('school_id',schoolId).eq('student_id',user.id):Promise.resolve({data:[],error:null}),
    client.from('assignments').select('id,school_id,class_id,topic,published,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(80),
    active.membership.role==='teacher'?client.from('ksp_documents').select('id,school_id,class_id,topic,revision,updated_at').eq('school_id',schoolId).eq('teacher_id',user.id).order('updated_at',{ascending:false}).limit(80):Promise.resolve({data:[],error:null})
   ]);
   if(!alive)return;
   const failed=[cr,tc,ec,ar,kr].find(x=>x.error);
   if(failed?.error)setError('Ошибка загрузки: '+failed.error.message);
   setClasses((cr.data||[]) as ClassRoom[]);
   setTeacherClasses((tc.data||[]) as TeacherAssignment[]);
   setEnrolledClasses((ec.data||[]) as StudentEnrollment[]);
   setAssignments((ar.data||[]) as Assignment[]);
   setKsp((kr.data||[]) as Ksp[]);
  })();
  return()=>{alive=false};
 },[active,user,refreshToken]);

 async function sendLogin(e:FormEvent){
  e.preventDefault();if(!client)return;
  const clean=email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)){setError('Введите корректный email.');return}
  setError('');setSending(true);
  const {error:loginError}=await client.auth.signInWithOtp({
   email:clean,options:{emailRedirectTo:window.location.origin,shouldCreateUser:false}
  });
  setSending(false);
  if(loginError)setError(loginError.message);
  else setMessage('Если вход разрешён, письмо со ссылкой отправлено. Доступ откроется только после назначения роли администратором.');
 }
 async function signOut(){
  if(!client)return;
  await client.auth.signOut();setUser(null);setReadiness('logged_out');setActiveSchoolId('');setMemberships([]);setMessage('');
 }
 async function addClass(e:FormEvent){
  e.preventDefault();if(!client||!active||active.membership.role!=='admin')return;
  if(!/^\d{4}-\d{4}$/.test(academicYear)||name.trim().length<1||name.trim().length>40){setError('Проверьте класс и учебный год.');return}
  setCreating(true);setError('');
  const {error:insertError}=await client.from('classes').insert({
   school_id:active.school.id,label:name.trim(),academic_year:academicYear
  });
  setCreating(false);
  if(insertError)setError(insertError.message);
  else{setName('');setRefreshToken(v=>v+1)}
 }
 if(readiness==='unconfigured')return <main className="container"><h1>M-academy · Серверный пилот</h1><div className="warning">Сервер не подключён. Укажите NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в окружении пилотного приложения. Публичный сайт продолжает работать независимо.</div></main>;
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Secure pilot · не запущено для школы</small></div><div className="actions"><a href="https://gulyantsdanil-oss.github.io/m-academy/" target="_blank" rel="noreferrer">Публичная версия</a>{user&&<button className="btn" onClick={()=>void signOut()}>Выйти</button>}</div></div></header>
 <main className="container"><h1>Кабинеты, классы и задания</h1><p className="muted">Отдельное пилотное приложение. Реальная авторизация требует развёрнутой базы данных и настройки доступа. Пользовательские роли назначаются администратором вне публичного интерфейса.</p><div className="warning"><b>Пилот без персональных данных.</b> Не регистрируйте реальных учеников и не загружайте их сведения до утверждения политики обработки данных, проверки размещения сервера, резервного копирования и тестирования безопасности.</div>
 <ErrorText value={error}/>
 {readiness==='loading'&&<p>Проверка сеанса…</p>}
 {readiness==='logged_out'&&<section className="card"><h2>Вход по ссылке на email</h2><p className="muted">Для теста используйте технические адреса взрослых участников пилота. Новый аккаунт не получает роль автоматически.</p><form onSubmit={e=>void sendLogin(e)}><label htmlFor="email">Email</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/><p><button disabled={sending} className="btn primary" type="submit">{sending?'Отправка…':'Получить ссылку для входа'}</button></p></form>{message&&<p className="success">{message}</p>}</section>}
 {readiness==='ready'&&user&&<><section className="card"><h2>Текущий сеанс</h2><p><b>Пользователь:</b> {user.email||shortId(user.id)}</p>{memberships.length===0?<p className="warning">Для аккаунта нет действующих назначений в школах. Роль назначается только через доверенное администрирование — автоматически учителем или администратором стать нельзя.</p>:<><label htmlFor="school">Школа / роль</label><select id="school" value={activeSchoolId} onChange={e=>setActiveSchoolId(e.target.value)}>{memberships.map(v=><option key={v.school.id} value={v.school.id}>{v.school.name} — {v.membership.role}</option>)}</select></>}</section>
 {active&&<><section className="card"><h2>Доступные классы</h2>{classes.length===0?<p className="muted">В этом аккаунте ещё нет доступных классов.</p>:classes.map(c=><div className="item" key={c.id}><b>{c.label}</b> · {c.academic_year}</div>)}</section>
 {active.membership.role==='admin'&&<section className="card"><h2>Администратор школы</h2><p className="muted">Можно добавить учебный класс. Назначения пользователей и ролей не доступны из браузера.</p><form onSubmit={e=>void addClass(e)} className="grid"><div><label htmlFor="className">Название класса</label><input id="className" value={name} maxLength={40} placeholder="9Ж" onChange={e=>setName(e.target.value)}/></div><div><label htmlFor="year">Учебный год</label><input id="year" value={academicYear} onChange={e=>setAcademicYear(e.target.value)}/></div><p><button className="btn primary" disabled={creating}>{creating?'Сохранение…':'Добавить класс'}</button></p></form></section>}
 {active.membership.role==='teacher'&&<TeacherAssignmentBuilder schoolId={active.school.id} teacherId={user.id} classes={classes} assignments={teacherClasses} onSaved={()=>setRefreshToken(v=>v+1)}/>}
 {active.membership.role==='teacher'&&<div className="grid"><section className="card"><h2>Мои предметы и классы</h2>{teacherClasses.length?teacherClasses.map((x,i)=><div className="item" key={i}>{classes.find(c=>c.id===x.class_id)?.label||shortId(x.class_id)} · {x.subject}</div>):<p className="muted">Назначений пока нет.</p>}</section><section className="card"><h2>Мои КСП</h2>{ksp.length?ksp.map(x=><div className="item" key={x.id}><b>{x.topic}</b><br/><small>Редакция {x.revision}</small></div>):<p className="muted">Серверных документов пока нет. Локальные КСП публичной версии ещё не перенесены.</p>}</section></div>}
 {active.membership.role==='student'&&<section className="card"><h2>Мои учебные классы</h2>{enrolledClasses.length?enrolledClasses.map(x=><div className="item" key={x.class_id}>{classes.find(c=>c.id===x.class_id)?.label||shortId(x.class_id)}</div>):<p className="muted">Аккаунт ещё не назначен в класс.</p>}</section>}
 <section className="card"><h2>{active.membership.role==='student'?'Доступные задания':'Задания школы'}</h2>{assignments.length?assignments.map(a=><div className="item" key={a.id}><a href={'/assignments/'+a.id}><b>{a.topic}</b></a> <span className="tag">{a.published?'Опубликовано':'Черновик'}</span><p className="muted">Класс: {classes.find(c=>c.id===a.class_id)?.label||shortId(a.class_id)}</p></div>):<p className="muted">Пока нет доступных заданий. Редактор заданий и отправка результатов — следующий этап серверного приложения.</p>}</section>
 </>}
 </>}
 </main></>;
}
