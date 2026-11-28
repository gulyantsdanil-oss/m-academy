'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const navigation=[
 {href:'/',label:'Главная',icon:'⌂'},
 {href:'/overview',label:'Обзор',icon:'◫'},
 {href:'/curriculum',label:'КТП и темы',icon:'▤'},
 {href:'/lessons',label:'Уроки',icon:'✎'},
 {href:'/classes',label:'Классы',icon:'▦'},
 {href:'/admin/roster',label:'Участники',icon:'♙'},
 {href:'/assignments',label:'Задания',icon:'☑'},
 {href:'/results',label:'Результаты',icon:'▥'},
 {href:'/auth-check',label:'Доступ',icon:'◇'}
];
export function SiteHeader(){
 const pathname=usePathname();
 return <header className="home-header inner-header">
  <div className="home-header-inner">
   <Link className="home-wordmark" href="/" aria-label="M-academy — главная">
    <span className="home-logo">M</span>
    <span className="home-wordmark-text">M-academy<small>Математика · возможности · мастерство</small></span>
   </Link>
   <span className="home-stage"><span className="home-stage-dot"/> Тестовая платформа</span>
   <div className="home-header-right"><Link href="/help" className="home-help-link">Помощь</Link><Link className="home-logout" href="/">Личный кабинет <span aria-hidden="true">↗</span></Link></div>
  </div>
  <nav className="home-navigation" aria-label="Разделы платформы">
   <div className="home-navigation-inner">
    {navigation.map(item=>{
     const current=item.href==='/'?pathname==='/':pathname===item.href||pathname?.startsWith(item.href+'/');
     return <Link key={item.href} href={item.href} className={'home-nav-item'+(current?' home-nav-current':'')} aria-current={current?'page':undefined}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
     </Link>
    })}
   </div>
  </nav>
 </header>;
}
