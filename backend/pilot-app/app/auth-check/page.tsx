'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
type Phase='loading'|'unconfigured'|'logged_out'|'no_role'|'error'|'ready';
type Role='admin'|'teacher'|'student';
type RoleCheck={school:string;role:Role;schoolName:string;classCount:number;verified:boolean;message:string};
const sb=getSupabase();
export default function AuthCheck(){
 const [phase,setPhase]=useState<Phase>('loading');
 const [email,setEmail]=useState('');
 const [uid,setUid]=useState('');
 const [checks,setChecks]=useState<RoleCheck[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const verify=useCallback(async()=>{
  setBusy(true);setError('');setChecks([]);
  if(!sb){setPhase('unconfigured');setBusy(false);return}
  const session=await sb.auth.getUser();
  if(session.error||!session.data.user){setPhase('logged_out');setBusy(false);return}
  const user=session.data.user;setUid(user.id);setEmail(user.email||'');
  const membership=await sb.from('memberships')
   .select('school_id,role,active').eq('user_id',user.id).eq('active',true).limit(100);
  if(membership.error){setError('Ошибка чтения назначений: '+membership.error.message);setPhase('error');setBusy(false);return}
  const valid=(membership.data||[]).filter(m=>['admin','teacher','student'].includes(m.role)) as {school_id:string;role:Role;active:boolean}[];
  if(!valid.length){setPhase('no_role');setBusy(false);return}
  const schools=await sb.from('schools').select('id,name').in('id',valid.map(v=>v.school_id)).limit(100);
  if(schools.error){setError('Не удалось проверить школу: '+schools.error.message);setPhase('error');setBusy(false);return}
  const names=new Map((schools.data||[]).map(v=>[v.id as string,v.name as string]));
  const rows:RoleCheck[]=[];
  for(const m of valid){
   if(!names.has(m.school_id)){
    rows.push({school:m.school_id,role:m.role,schoolName:'Школа недоступна',classCount:0,verified:false,message:'Нет доступа к школе — проверьте RLS и назначение.'});continue
   }
   // The backend's own RLS policies enforce each role; never infer rights from
   // Google display name, email, requested ECO CLUB role, or browser state.
   const table=m.role==='teacher'?'class_teachers':m.role==='student'?'class_students':'classes';
   const query=sb.from(table).select(m.role==='admin'?'id':'class_id',{count:'exact',head:true}).eq('school_id',m.school_id);
   const result=m.role==='teacher'?await query.eq('teacher_id',user.id)
    :m.role==='student'?await query.eq('student_id',user.id):await query;
   if(result.error){
    rows.push({school:m.school_id,role:m.role,schoolName:names.get(m.school_id)!,classCount:0,verified:false,message:'Ошибка прав: '+result.error.message});
   }else{
    rows.push({school:m.school_id,role:m.role,schoolName:names.get(m.school_id)!,classCount:result.count??0,verified:true,
     message:m.role==='admin'?'Администратор: разрешено просматривать классы этой школы.'
      :result.count===0?'Роль подтверждена, но назначений на классы пока нет.':'Роль и назначения на классы подтверждены.'});
   }
  }
  setChecks(rows);
  setPhase('ready');setBusy(false);
 },[]);
 useEffect(()=>{void verify()},[verify]);
 const labels:Record<Role,string>={admin:'Администратор',teacher:'Учитель',student:'Ученик'};
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Проверка входа</small></div>
 <nav className="actions"><Link href="/">Кабинет</Link><Link href="/help">Помощь</Link><Link href="/admin/roster">Участники</Link></nav></div></header>
 <main className="container"><h1>Диагностика Google-входа и ролей</h1>
 <p className="muted">Проверка использует текущий сеанс Supabase и реальные ограничения доступа базы. Она не обращается к Firebase ECO CLUB, не импортирует пользователей и не выдаёт новые права.</p>
 <div className="warning">Только тестовые аккаунты взрослых. Статус на этой странице не подтверждает настройку внешнего Google OAuth, пока приложение не развернуто и вход не пройден в браузере.</div>
 {phase==='loading'&&<p role="status">Проверка входа…</p>}
 {phase==='unconfigured'&&<p className="warning">Supabase ещё не настроен для серверного пилота. Вход не проверен.</p>}
 {phase==='logged_out'&&<section className="card"><h2>Вход не выполнен</h2><p>Откройте кабинет, авторизуйтесь через Google и вернитесь сюда.</p><Link href="/">Открыть вход →</Link></section>}
 {phase==='error'&&<p className="error" role="alert">{error}</p>}
 {phase==='no_role'&&<section className="card"><h2>Google-аккаунт опознан, школьных прав нет</h2>
 <p>Supabase успешно установил личность пользователя, но действующая запись в <code>memberships</code> отсутствует. Это безопасное состояние: доступ к классам и оценкам не открывается.</p>
 <p>Назначение выполняется уполномоченным администратором после проверки соответствия аккаунтов.</p></section>}
 {phase==='ready'&&<><section className="card"><h2>Сеанс подтверждён</h2>
 <p><b>Аккаунт:</b> {email||uid.slice(0,8)+'…'}</p><p className="muted">Данные отображаются только владельцу текущего сеанса. Google-профиль сам по себе не даёт школьную роль.</p></section>
 <div className="grid">{checks.map((r,i)=><section key={r.school+'-'+r.role+'-'+i} className="card">
 <h2>{labels[r.role]}</h2><p><b>Школа:</b> {r.schoolName}</p>
 <p><b>Результат:</b> {r.verified?'Проверка прошла':'Требует настройки'}</p>
 <p>{r.message}</p><p className="muted">{r.role==='admin'?'Доступных классов':'Назначений на классы'}: {r.classCount}</p>
 </section>)}</div></>}
 <button className="btn" type="button" disabled={busy} onClick={()=>void verify()}>{busy?'Проверка…':'Проверить снова'}</button>
 <section className="card"><h2>Порядок приёмки</h2>
 <p>Для каждого отдельного тестового аккаунта взрослого участника сначала выполните Google-вход в основном кабинете, затем откройте этот экран. Проверьте роль администратора, учителя и ученика по очереди, а также отсутствие доступа у пользователя без назначения.</p>
 <p className="muted">Итоги не записываются в базу автоматически и не подменяют серверную проверку RLS.</p></section>
 </main></>;
}
