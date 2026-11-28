'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import type {User} from '@supabase/supabase-js';
import {getSupabase} from '@/lib/supabase';
import type {Membership,School,ClassRoom,TeacherAssignment,StudentEnrollment,Assignment,Ksp} from '@/lib/types';
import {TeacherAssignmentBuilder} from '@/components/TeacherAssignmentBuilder';
import {TeacherMaterials} from '@/components/TeacherMaterials';

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

 async function signInWithGoogle(){
  if(!client||sending)return;
  setError('');setMessage('');setSending(true);
  // Supabase performs Google OAuth. Firebase tokens from ECO CLUB are never
  // passed to this application. Roles must already be approved in Supabase.
  const redirectTo=new URL('/',window.location.origin).toString();
  const {error:loginError}=await client.auth.signInWithOAuth({
   provider:'google',
   options:{redirectTo,queryParams:{prompt:'select_account'}}
  });
  if(loginError){setError('Вход через Google недоступен: '+loginError.message);setSending(false)}
  // Successful requests navigate away; keep the button disabled during redirect.
 }
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
 return <div className="home-shell"><header className="home-header"><div className="home-header-inner">
  <Link className="home-wordmark" href="/" aria-label="M-academy — главная"><span className="home-logo">M</span><span className="home-wordmark-text">M-academy<small>Математика · возможности · мастерство</small></span></Link>
  <span className="home-stage"><span className="home-stage-dot"/> Тестовая платформа</span>
  <div className="home-header-right"><Link href="/help" className="home-help-link">Помощь</Link>{user&&<button className="home-logout" onClick={()=>void signOut()}>Выйти <span aria-hidden="true">↗</span></button>}</div>
 </div><nav className="home-navigation" aria-label="Разделы платформы"><div className="home-navigation-inner">
  <Link className="home-nav-item home-nav-current" href="/">⌂ <span>Главная</span></Link>
  <Link className="home-nav-item" href="/overview"><span>◫</span> Обзор</Link>
  <Link className="home-nav-item" href="/curriculum"><span>▤</span> КТП и темы</Link>
  <Link className="home-nav-item" href="/lessons"><span>✎</span> Уроки</Link>
  <Link className="home-nav-item" href="/classes"><span>▦</span> Классы</Link>
  <Link className="home-nav-item" href="/admin/roster"><span>♙</span> Участники</Link>
  <Link className="home-nav-item" href="/assignments"><span>☑</span> Задания</Link>
  <Link className="home-nav-item" href="/results"><span>▥</span> Результаты</Link>
  <Link className="home-nav-item" href="/auth-check"><span>◇</span> Доступ</Link>
 </div></nav></header>
 <main className="container home-main">
 <div className="home-hero"><div className="home-hero-copy"><span className="home-eyebrow">ВАША ЦИФРОВАЯ МАТЕМАТИЧЕСКАЯ СРЕДА</span><h1>${readiness==='ready'&&user?'С возвращением в M-academy':'Математика начинается здесь'}</h1><p>Уроки, тематическое планирование, классы и задания — в едином пространстве для учителя и школы.</p><div className="home-hero-actions"><Link href="/overview" className="home-hero-button">Открыть обзор <span aria-hidden="true">↗</span></Link><Link href="/curriculum" className="home-hero-outline">Перейти к КТП</Link></div></div><div className="home-hero-visual" aria-hidden="true"><div className="home-math-circle"><span>∑</span><span>π</span><span>√</span><span>∞</span></div><div className="home-floating-note"><span>✦</span><div>УЧИМСЯ МЫСЛИТЬ <b>ЛОГИЧЕСКИ</b></div></div></div></div>
 <div className="home-section-heading"><div><span className="home-kicker">РАБОЧЕЕ ПРОСТРАНСТВО</span><h2>Ваш кабинет</h2><p>Самое важное — под рукой. Выберите нужное направление.</p></div></div>
 <div className="home-shortcuts"><Link href="/curriculum" className="home-shortcut"><span className="home-shortcut-icon">▤</span><strong>КТП и темы</strong><small>Планирование уроков</small><span className="home-shortcut-arrow">↗</span></Link><Link href="/lessons" className="home-shortcut"><span className="home-shortcut-icon">✎</span><strong>Конструктор уроков</strong><small>Материалы и КСП</small><span className="home-shortcut-arrow">↗</span></Link><Link href="/assignments" className="home-shortcut"><span className="home-shortcut-icon">☑</span><strong>Задания</strong><small>Создание и проверка</small><span className="home-shortcut-arrow">↗</span></Link><Link href="/classes" className="home-shortcut"><span className="home-shortcut-icon">▦</span><strong>Классы</strong><small>Состав и предметы</small><span className="home-shortcut-arrow">↗</span></Link></div>
 <div className="home-pilot-note"><span className="home-note-symbol">ⓘ</span><div><b>Тестовый режим</b><span>Пока не добавляйте персональные данные реальных учеников. Используйте тестовые аккаунты до завершения проверки безопасности и политики обработки данных.</span></div></div>
 <ErrorText value={error}/>
 {readiness==='loading'&&<p>Проверка сеанса…</p>}
 {readiness==='logged_out'&&<section className="card"><h2>Единый Google-вход</h2><p className="muted">Можно использовать тот же Google-аккаунт, что и в ECO CLUB. M-academy проверяет роли отдельно: Google-вход не означает автоматическое разрешение на доступ к классам.</p><p><button type="button" disabled={sending} className="btn primary" onClick={()=>void signInWithGoogle()}>{sending?'Переход в Google…':'Войти через Google'}</button></p><p className="muted">Для тестовых взрослых аккаунтов также доступен резервный вход по ссылке на email.</p><form onSubmit={e=>void sendLogin(e)}><label htmlFor="email">Email</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/><p><button disabled={sending} className="btn primary" type="submit">{sending?'Отправка…':'Получить ссылку для входа'}</button></p></form>{message&&<p className="success">{message}</p>}</section>}
 {readiness==='ready'&&user&&<><section className="card home-session"><h2>Текущий сеанс</h2><p><b>Пользователь:</b> {user.email||shortId(user.id)}</p>{memberships.length===0?<p className="warning">Для аккаунта нет действующих назначений в школах. Роль назначается только через доверенное администрирование — автоматически учителем или администратором стать нельзя.</p>:<><label htmlFor="school">Школа / роль</label><select id="school" value={activeSchoolId} onChange={e=>setActiveSchoolId(e.target.value)}>{memberships.map(v=><option key={v.school.id} value={v.school.id}>{v.school.name} — {v.membership.role}</option>)}</select></>}</section>
 {active&&<><section className="card home-classes"><h2>Доступные классы</h2>{classes.length===0?<p className="muted">В этом аккаунте ещё нет доступных классов.</p>:classes.map(c=><div className="item" key={c.id}><b>{c.label}</b> · {c.academic_year}</div>)}</section>
 {active.membership.role==='admin'&&<section className="card"><h2>Администратор школы</h2><p className="muted">Можно добавить учебный класс. Назначения пользователей и ролей не доступны из браузера.</p><form onSubmit={e=>void addClass(e)} className="grid"><div><label htmlFor="className">Название класса</label><input id="className" value={name} maxLength={40} placeholder="9Ж" onChange={e=>setName(e.target.value)}/></div><div><label htmlFor="year">Учебный год</label><input id="year" value={academicYear} onChange={e=>setAcademicYear(e.target.value)}/></div><p><button className="btn primary" disabled={creating}>{creating?'Сохранение…':'Добавить класс'}</button></p></form></section>}
 {active.membership.role==='teacher'&&<TeacherMaterials schoolId={active.school.id} teacherId={user.id} classes={classes} assignments={teacherClasses}/>}
 {active.membership.role==='teacher'&&<TeacherAssignmentBuilder schoolId={active.school.id} teacherId={user.id} classes={classes} assignments={teacherClasses} onSaved={()=>setRefreshToken(v=>v+1)}/>}
 {active.membership.role==='teacher'&&<div className="grid"><section className="card"><h2>Мои предметы и классы</h2>{teacherClasses.length?teacherClasses.map((x,i)=><div className="item" key={i}>{classes.find(c=>c.id===x.class_id)?.label||shortId(x.class_id)} · {x.subject}</div>):<p className="muted">Назначений пока нет.</p>}</section><section className="card"><h2>Мои КСП</h2>{ksp.length?ksp.map(x=><div className="item" key={x.id}><b>{x.topic}</b><br/><small>Редакция {x.revision}</small></div>):<p className="muted">Серверных документов пока нет. Локальные КСП публичной версии ещё не перенесены.</p>}</section></div>}
 {active.membership.role==='student'&&<section className="card"><h2>Мои учебные классы</h2>{enrolledClasses.length?enrolledClasses.map(x=><div className="item" key={x.class_id}>{classes.find(c=>c.id===x.class_id)?.label||shortId(x.class_id)}</div>):<p className="muted">Аккаунт ещё не назначен в класс.</p>}</section>}
 <section className="card"><h2>{active.membership.role==='student'?'Доступные задания':'Задания школы'}</h2>{assignments.length?assignments.map(a=><div className="item" key={a.id}><a href={'/assignments/'+a.id}><b>{a.topic}</b></a> <span className="tag">{a.published?'Опубликовано':'Черновик'}</span><p className="muted">Класс: {classes.find(c=>c.id===a.class_id)?.label||shortId(a.class_id)}</p></div>):<p className="muted">Пока нет доступных заданий. Редактор заданий и отправка результатов — следующий этап серверного приложения.</p>}</section>
 </>}
 </>}
 </main></div>;
}
