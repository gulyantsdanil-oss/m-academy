import Link from 'next/link';
export default function HelpPage(){
 return <><header className="top"><div className="bar"><div className="brand"><span>M</span>-academy <small className="tag">Навигация</small></div><nav className="actions"><Link href="/">Кабинет</Link><Link href="/classes">Классы</Link><Link href="/assignments">Задания</Link></nav></div></header>
 <main className="container"><h1>Как пользоваться M-academy</h1><p className="muted">Краткая инструкция для тестового серверного кабинета.</p>
 <div className="grid">
 <section className="card"><h2>Администратор</h2><p>Создаёт учебные классы в главном кабинете. Роли и участников назначают только через доверенное администрирование Supabase, а не открытую регистрацию.</p><Link href="/">Открыть кабинет</Link></section>
 <section className="card"><h2>Учитель</h2><p>Работает с назначенными классами, создаёт КТП, КСП и задания. После публикации работа становится доступной участникам соответствующего класса.</p><Link href="/classes">Мои классы</Link></section>
 <section className="card"><h2>Ученик</h2><p>Видит только назначенные опубликованные задания, отправляет ответы один раз и получает оценку после проверки учителем.</p><Link href="/assignments">Мои задания</Link></section>
 <section className="card"><h2>Открытые уроки</h2><p>Каталог математики, лаборатория, тренажёры и конструкторы документов доступны в публичной версии. Данные браузера не синхронизируются автоматически с сервером.</p><a href="https://gulyantsdanil-oss.github.io/m-academy/" target="_blank" rel="noreferrer">Открыть публичную версию</a></section>
 </div>
 <div className="warning"><b>Только тестовый режим.</b> Не загружайте персональные данные школьников, пока не проведены юридическая проверка, аудит безопасности и проверка хранения данных.</div>
 </main></>;
}
