import type {Metadata} from 'next';
import './styles.css';
export const metadata:Metadata={title:'M-academy — защищённый пилот',description:'Пилотная модель кабинетов с проверкой прав на уровне базы данных'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
