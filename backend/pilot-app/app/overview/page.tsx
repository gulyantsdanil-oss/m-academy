'use client';
import {SiteHeader} from '@/components/SiteHeader';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {Membership,Role,School,ClassRoom,TeacherAssignment,StudentEnrollment} from '@/lib/types';

type Workspace={membership:Membership;school:School};
type Entry={class_id:string;subject?:string};
type Plan={id:string;class_id:string;subject:string;revision:number;updated_at:string};
type Draft={id:string;class_id:string;topic:string;revision:number;updated_at:string};
type AssignmentRow={id:string;class_id:string;topic:string;published:boolean;created_at:string};
type KspRow={id:string;class_id:string;topic:string;revision:number;updated_at:string};
type Snapshot={classes:ClassRoom[];teachers:TeacherAssignment[];students:StudentEnrollment[];plans:Plan[];drafts:Draft[];ksp:KspRow[];assignments:AssignmentRow[]};
const sb=getSupabase();
const empty:Snapshot={classes:[],teachers:[],students:[],plans:[],drafts:[],ksp:[],assignments:[]};
const roleName:Record<Role,string>={admin:'Администратор',teacher:'Учитель',student:'Ученик'};
function Stat({value,label}:{value:number;label:string}){return <div className="stat4"><strong>{value}</strong><span>{label}</span></div>}
function nameFor(classes:ClassRoom[],id:string){return classes.find(c=>c.id===id)?.label||'Класс недоступен'}
export default function OverviewPage(){
 const [workspaces,setWorkspaces]=useState<Workspace[]>([]);
 const [selected,setSelected]=useState('');
 const [identity,setIdentity]=useState('');
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [snapshot,setSnapshot]=useState<Snapshot>(empty);
 const [reload,setReload]=useState(0);
 const active=useMemo(()=>workspaces.find(w=>w.school.id===selected)||null,[workspaces,selected]);
 useEffect(()=>{
  let live=true;
  (async()=>{
   setLoading(true);setError('');
   if(!sb){setError('Серверный пилот не настроен: отсутствуют параметры Supabase.');setLoading(false);return}
   const {data:auth,error:authError}=await sb.auth.getUser();
   if(!live)return;
   if(authError||!auth.user){setError('Сначала войдите в аккаунт на главной странице серверного кабинета.');setLoading(false);return}
   setIdentity(auth.user.id);
   const {data:members,error:membersError}=await sb.from('memberships')
    .select('school_id,role,active').eq('user_id',auth.user.id).eq('active',true);
   if(!live)return;
   if(membersError){setError('Ошибка проверки ролей: '+membersError.message);setLoading(false);return}
   const memberships=(members||[]) as Membership[];
   if(!memberships.length){setError('Действующих назначений в школах нет.');setLoading(false);return}
   const {data:schools,error:schoolsError}=await sb.from('schools').select('id,name').in('id',memberships.map(m=>m.school_id));
   if(!live)return;
   if(schoolsError){setError('Не удалось получить список школ: '+schoolsError.message);setLoading(false);return}
   const lookup=new Map(((schools||[]) as School[]).map(s=>[s.id,s]));
   const views=memberships.flatMap(m=>{const school=lookup.get(m.school_id);return school?[{membership:m,school}]:[]});
   setWorkspaces(views);setSelected(current=>views.some(x=>x.school.id===current)?current:views[0]?.school.id||'');
   setLoading(false);
  })();
  return()=>{live=false};
 },[]);
 useEffect(()=>{
  if(!sb||!identity||!active){setSnapshot(empty);return}
  let live=true;
  (async()=>{
   setPending(true);setError('');setSnapshot(empty);
   const school=active.school.id,role=active.membership.role;
   // Every request is independently checked by Supabase RLS; filtering here is presentation only.
   const classesRequest=sb.from('classes').select('id,school_id,label,academic_year').eq('school_id',school).order('label').limit(500);
   const teacherRequest=role==='teacher'?sb.from('class_teachers').select('school_id,class_id,subject').eq('school_id',school).eq('teacher_id',identity).limit(500):Promise.resolve({data:[],error:null});
   const studentRequest=role==='student'?sb.from('class_students').select('school_id,class_id').eq('school_id',school).eq('student_id',identity).limit(500):Promise.resolve({data:[],error:null});
   const plansRequest=role==='teacher'?sb.from('curriculum_plans').select('id,class_id,subject,revision,updated_at').eq('school_id',school).eq('teacher_id',identity).limit(500):Promise.resolve({data:[],error:null});
   const draftsRequest=role==='teacher'?sb.from('lesson_drafts').select('id,class_id,topic,revision,updated_at').eq('school_id',school).eq('teacher_id',identity).limit(500):Promise.resolve({data:[],error:null});
   const kspRequest=role==='teacher'?sb.from('ksp_documents').select('id,class_id,topic,revision,updated_at').eq('school_id',school).eq('teacher_id',identity).limit(500):Promise.resolve({data:[],error:null});
   const assignmentsRequest=sb.from('assignments').select('id,class_id,topic,published,created_at').eq('school_id',school).order('created_at',{ascending:false}).limit(500);
   const [cr,tr,sr,pr,dr,kr,ar]=await Promise.all([classesRequest,teacherRequest,studentRequest,plansRequest,draftsRequest,kspRequest,assignmentsRequest]);
   if(!live)return;
   setPending(false);
   const errors=[cr,tr,sr,pr,dr,kr,ar].flatMap(x=>x.error?[x.error.message]:[]);
   if(errors.length){setError('Не все данные доступны: '+errors.join(' / '));return}
   const classes=(cr.data||[]) as ClassRoom[],teachers=(tr.data||[]) as TeacherAssignment[],students=(sr.data||[]) as StudentEnrollment[];
   const permitted=new Set(role==='admin'?classes.map(c=>c.id):role==='teacher'?teachers.map(t=>t.class_id):students.map(s=>s.class_id));
   setSnapshot({
    classes:classes.filter(c=>permitted.has(c.id)),
    teachers,students,
    plans:(pr.data||[]) as Plan[],
    drafts:(dr.data||[]) as Draft[],
    ksp:(kr.data||[]) as KspRow[],
    assignments:((ar.data||[]) as AssignmentRow[]).filter(a=>permitted.has(a.class_id))
   });
  })();
  return()=>{live=false};
 },[identity,active,reload]);
 const ownClasses=snapshot.classes;
 const countPublished=snapshot.assignments.filter(a=>a.published).length;
 return <><SiteHeader />
 <main className="container inner-main">
  <h1>Единая рабочая панель 4.0</h1><p className="muted">Классы, КТП, документы и задания из одной базы. Состав данных ограничивается действующей ролью и политиками доступа Supabase.</p>
  <div className="warning"><b>Не для реальных данных детей до проверки безопасности.</b> Серверный пилот требует развёртывания, проверки RLS, соответствия требованиям хранения данных и резервного копирования. Публичный GitHub Pages не подключён к этому серверу.</div>
  {loading&&<p role="status">Проверка сеанса и ролей…</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {!!workspaces.length&&<section className="card"><label htmlFor="v4school">Школа и роль</label><select id="v4school" value={selected} onChange={e=>setSelected(e.target.value)}>{workspaces.map(w=><option key={w.school.id} value={w.school.id}>{w.school.name} · {roleName[w.membership.role]}</option>)}</select><div className="actions"><button className="btn" type="button" disabled={pending} onClick={()=>setReload(v=>v+1)}>{pending?'Загрузка…':'Обновить сведения'}</button></div></section>}
  {active&&!pending&&<><div className="stat-grid">
   <Stat value={ownClasses.length} label="Доступных классов"/>
   <Stat value={active.membership.role==='teacher'?snapshot.plans.length:0} label="Мои КТП (для учителя)"/>
   <Stat value={snapshot.assignments.length} label="Видимых заданий"/>
   <Stat value={countPublished} label="Опубликованных заданий"/>
  </div>
  <div className="grid"><section className="card"><h2>Мои классы</h2>{ownClasses.length===0?<p className="muted">Назначенных классов нет.</p>:ownClasses.map(c=><div className="item" key={c.id}><b>{c.label}</b> · {c.academic_year}{active.membership.role==='teacher'&&<p className="muted">{snapshot.teachers.filter(t=>t.class_id===c.id).map(t=>t.subject).join(', ')}</p>}</div>)}<p><Link href="/classes">Открыть классы →</Link></p></section>
  <section className="card"><h2>Последние задания</h2>{!snapshot.assignments.length?<p className="muted">Нет доступных работ.</p>:snapshot.assignments.slice(0,8).map(a=><div className="item" key={a.id}><Link href={'/assignments/'+a.id}><b>{a.topic}</b></Link><p className="muted">{nameFor(ownClasses,a.class_id)} · {a.published?'Опубликовано':'Черновик'}</p></div>)}<p><Link href="/assignments">Все задания →</Link></p></section></div>
  {active.membership.role==='teacher'&&<section className="card">
   <h2>Подготовка урока — три шага</h2>
   <p className="muted">Начните с КТП, свяжите тему с уроком и подготовьте задания. Каждое действие проверяется правами вашего аккаунта.</p>
   <div className="teacher-workflow">
    <Link href="/"><b>01 · Загрузить КТП</b><small>Откройте редактор КТП / КСП, импортируйте Excel или создайте план вручную.</small></Link>
    <Link href="/curriculum"><b>02 · Выбрать тему</b><small>Согласуйте темы и создайте черновик связанного урока.</small></Link>
    <Link href="/lessons"><b>03 · Подготовить урок</b><small>Заполните этапы и оценивание, сохраните новую редакцию.</small></Link>
   </div>
   <p><Link href="/curriculum">Перейти к планированию →</Link></p>
  </section>}
  {active.membership.role==='teacher'&&<div className="grid"><section className="card"><h2>КТП и проекты уроков</h2><p>Сохранённых КТП: <strong>{snapshot.plans.length}</strong></p><p>Черновиков уроков: <strong>{snapshot.drafts.length}</strong></p>{snapshot.plans.slice(0,6).map(p=><div key={p.id} className="item">{nameFor(ownClasses,p.class_id)} · {p.subject}<small className="muted"> · редакция {p.revision}</small></div>)}<p className="muted">Редактирование КТП и КСП доступно на главной странице серверного кабинета.</p></section>
  <section className="card"><h2>КСП</h2><p>Документов: <strong>{snapshot.ksp.length}</strong></p>{snapshot.ksp.slice(0,7).map(k=><div key={k.id} className="item"><b>{k.topic}</b><p className="muted">{nameFor(ownClasses,k.class_id)} · редакция {k.revision}</p></div>)}</section></div>}
  {active.membership.role==='admin'&&<section className="card"><h2>Администрирование</h2><p className="muted">Сводка ограничена доступными классами и заданиями. Назначения ролей выполняются через доверенный административный процесс, не переключением роли в браузере.</p><Link href="/">Управление учебными классами →</Link></section>}
  {active.membership.role==='student'&&<section className="card"><h2>Мои работы</h2><p className="muted">Откройте опубликованное задание из списка выше. Ключи ответов скрыты серверными правилами доступа.</p></section>}
  </>}
 </main></>;
}
