// Local, offline-only deployment configuration validation.
// This module never calls Supabase or Google and never prints keys.
const forbidden=/^(?:service_role|sb_secret_)/i;
function jwtRole(key){try{const p=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));return p?.role}catch{return null}}
export function analyzeDeployment({siteUrl,supabaseUrl,publicKey,production=true}={}){
 const issues=[];
 const notes=[];
 const safeUrl=(value,label)=>{
  if(typeof value!=='string'||!value.trim()){issues.push(label+': URL отсутствует');return null}
  try{
   const parsed=new URL(value);
   if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash){
    issues.push(label+': URL должен быть без логина, пароля, query и фрагмента');return null
   }
   if(parsed.pathname!=='/'||value.endsWith('//')){issues.push(label+': используйте адрес корня без пути');return null}
   return parsed;
  }catch{issues.push(label+': некорректный URL');return null}
 };
 const site=safeUrl(siteUrl,'M-academy Site URL');
 const project=safeUrl(supabaseUrl,'Supabase URL');
 if(site){
  const local=['localhost','127.0.0.1','[::1]'].includes(site.hostname);
  if(production&&site.protocol!=='https:')issues.push('M-academy: для публичного развёртывания требуется HTTPS');
  if(production&&local)issues.push('M-academy: localhost нельзя считать публичным адресом');
  if(/\.github\.io$/i.test(site.hostname))issues.push('M-academy: GitHub Pages не запускает сервер Next.js');
 }
 if(project){
  const local=['localhost','127.0.0.1','[::1]'].includes(project.hostname);
  if(production&&project.protocol!=='https:')issues.push('Supabase: для размещённого проекта требуется HTTPS');
  if(production&&!/^[a-z0-9-]+\.supabase\.co$/i.test(project.hostname))
   notes.push('Supabase: проверьте, что пользовательский домен действительно относится к вашему проекту');
  if(production&&local)issues.push('Supabase: localhost не является публичным проектом');
 }
 if(typeof publicKey!=='string'||!publicKey.trim())issues.push('Публичный ключ Supabase отсутствует');
 else if(forbidden.test(publicKey.trim())||jwtRole(publicKey.trim())==='service_role')issues.push('Запрещён service_role/секретный ключ в публичных переменных');
 else if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publicKey.trim())&&!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publicKey.trim()))
  notes.push('Проверьте, что используется именно publishable/anon ключ Supabase, а не произвольное значение');
 const callback=project?new URL('/auth/v1/callback',project).toString():null;
 const returnTo=site?site.toString():null;
 return {ok:issues.length===0,issues,notes,callback,returnTo};
}
