'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {getSupabase} from '@/lib/supabase';
import type {Assignment,ClassRoom,Membership} from '@/lib/types';

const sb=getSupabase();
export default function AssignmentsIndex(){
 const [items,setItems]=useState<Assignment[]>([]);
 const [classes,setClasses]=useState<ClassRoom[]>([]);
 const [role,setRole]=useState<Membership['role']|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let live=true;
  (async()=>{
   if(!sb){setError('Supabase не подключён.');setLoading(false);return}
   const auth=await sb.auth.getUser();
   if(!live)return;
   if(!auth.data.user){setError('Сначала войдите в кабинет.');setLoading(false);return}
   const uid=auth.data.user.id;
   const ms=await sb.from('memberships').select('school_id,role,active').eq('user_id',uid).eq('active',true).limit(1);
   if(!live)return;
   if(ms.error||!ms.data?.length){setError(ms.error?.message||'Роль ещё не назначена.');setLoading(false);return}
   const m=ms.data[0] as Membership;setRole(m.role);
   const [ar,cr]=await Promise.all([
    sb.from('assignments').select('id,school_id,class_id,topic,published,created_at')
     .eq('school_id',m.school_id).order('created_at',{ascending:false}).limit(100),
    sb.from('classes').select('id,school_id,label,academic_year').eq('school_id',m.school_id)
   ]);
   if(!live)return;
   if(ar.error||cr.error)setError(ar.error?.message||cr.error?.message||'Не удалось загрузить задания.');
   setItems((ar.data||[]) as Assignment[]);
   setClasses((cr.data||[]) as ClassRoom[]);
   setLoading(false);
  })();
  return()=>{live=false};
 },[]);
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Задания</small></div><nav className="actions"><Link href="/">Кабинет</Link><Link href="/classes">Классы</Link><Link href="/help">Помощь</Link></nav></div></header>
 <main className="container"><h1>{role==='student'?'Мои задания':'Задания школы'}</h1>
 <p className="muted">Список определяется правами текущего аккаунта в Supabase. Ключи ответов ученикам не показываются.</p>
 {loading&&<p>Загрузка…</p>}{error&&<p className="error" role="alert">{error}</p>}
 {!loading&&role&&<section className="card"><h2>Доступные задания ({items.length})</h2>
 {!items.length?<p className="muted">Пока заданий нет. Учитель может создать первое задание в главном кабинете.</p>:items.map(item=><div className="item" key={item.id}>
 <Link href={`/assignments/${item.id}`}><b>{item.topic}</b></Link> <span className="tag">{item.published?'Опубликовано':'Черновик'}</span>
 <p className="muted">{classes.find(c=>c.id===item.class_id)?.label||'Класс'} · {new Date(item.created_at).toLocaleDateString('ru-RU')}</p></div>)}
 </section>}
 </main></>;
}
