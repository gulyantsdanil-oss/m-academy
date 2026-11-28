'use client';
import {SiteHeader} from '@/components/SiteHeader';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,Membership,TeacherAssignment,StudentEnrollment} from '@/lib/types';

type View={role:Membership['role'];schoolId:string;schoolName:string};
const sb=getSupabase();
export default function ClassesPage(){
 const [view,setView]=useState<View|null>(null);
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [subjects,setSubjects]=useState<TeacherAssignment[]>([]);
 const [enrollments,setEnrollments]=useState<StudentEnrollment[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  (async()=>{
   if(!sb){setError('Настройте подключение к Supabase.');setLoading(false);return}
   const auth=await sb.auth.getUser();
   if(!alive)return;
   if(!auth.data.user){setError('Войдите в аккаунт на главной странице.');setLoading(false);return}
   const uid=auth.data.user.id;
   const {data:ms,error:me}=await sb.from('memberships').select('school_id,role,active')
     .eq('user_id',uid).eq('active',true).limit(1);
   if(!alive)return;
   if(me||!ms?.length){setError(me?.message||'Нет действующей роли в школе.');setLoading(false);return}
   const m=ms[0] as Membership;
   const [sc,cr,tc,cs]=await Promise.all([
    sb.from('schools').select('id,name').eq('id',m.school_id).single(),
    sb.from('classes').select('id,school_id,label,academic_year').eq('school_id',m.school_id).order('label'),
    m.role==='teacher'?sb.from('class_teachers').select('school_id,class_id,subject').eq('school_id',m.school_id).eq('teacher_id',uid):Promise.resolve({data:[],error:null}),
    m.role==='student'?sb.from('class_students').select('school_id,class_id').eq('school_id',m.school_id).eq('student_id',uid):Promise.resolve({data:[],error:null})
   ]);
   if(!alive)return;
   const failed=[sc,cr,tc,cs].find(x=>x.error);
   if(failed?.error)setError(failed.error.message);
   setView({role:m.role,schoolId:m.school_id,schoolName:sc.data?.name||'Школа'});
   setClasses((cr.data||[]) as ClassRoom[]);
   setSubjects((tc.data||[]) as TeacherAssignment[]);
   setEnrollments((cs.data||[]) as StudentEnrollment[]);
   setLoading(false);
  })();
  return()=>{alive=false};
 },[]);
 const allowed=classes.filter(c=>view?.role==='admin'||(view?.role==='teacher'&&subjects.some(s=>s.class_id===c.id))||(view?.role==='student'&&enrollments.some(e=>e.class_id===c.id)));
 return <><SiteHeader />
 <main className="container inner-main"><h1>Мои классы</h1><p className="muted">Список доступен по назначенной роли и ограничениям Supabase.</p>
 {loading&&<p>Загружаем классы…</p>}{error&&<p className="error" role="alert">{error}</p>}
 {view&&<><p className="tag">{view.schoolName} · {view.role}</p>
 <section className="card"><h2>Доступные классы ({allowed.length})</h2>
 {allowed.length===0?<p className="muted">Пока нет назначенных классов.</p>:allowed.map(c=><div key={c.id} className="item"><b>{c.label}</b> · {c.academic_year}{view.role==='teacher'&&<p className="muted">Предметы: {subjects.filter(t=>t.class_id===c.id).map(t=>t.subject).join(', ')}</p>}</div>)}
 </section>
 {view.role==='admin'&&<p className="muted">Добавление классов доступно на <Link href="/">главной странице кабинета</Link>.</p>}
 </>}
 </main></>;
}
