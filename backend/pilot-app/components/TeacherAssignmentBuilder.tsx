'use client';
import {useState} from 'react';
import {getSupabase} from '@/lib/supabase';
import type {ClassRoom,TeacherAssignment} from '@/lib/types';

type Question={question:string;answer:string;level:'A'|'B'|'C'};
const initial=():Question[]=>[
 {question:'',answer:'',level:'A'},
 {question:'',answer:'',level:'B'},
 {question:'',answer:'',level:'C'}
];

export function TeacherAssignmentBuilder({
 schoolId,teacherId,classes,assignments,onSaved
}:{
 schoolId:string;teacherId:string;classes:ClassRoom[];
 assignments:TeacherAssignment[];onSaved:()=>void
}){
 const [classId,setClassId]=useState('');
 const [topic,setTopic]=useState('');
 const [questions,setQuestions]=useState<Question[]>(initial);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const permitted=new Set(assignments.map(x=>x.class_id));
 const options=classes.filter(x=>permitted.has(x.id));
 const chosen=options.some(x=>x.id===classId)?classId:options[0]?.id||'';

 function update(index:number,field:keyof Question,value:string){
  setQuestions(q=>q.map((item,i)=>i===index?{...item,[field]:value}:item))
 }
 async function create(e:React.FormEvent){
  e.preventDefault();
  const sb=getSupabase();
  if(!sb||!chosen||busy)return;
  setError('');setMessage('');
  if(topic.trim().length<2||topic.trim().length>300){
   setError('Название темы: от 2 до 300 символов.');return
  }
  if(questions.some(q=>!q.question.trim()||!q.answer.trim()||q.question.length>3000||q.answer.length>1000)){
   setError('Заполните все вопросы и ответы; проверьте допустимую длину.');return
  }
  setBusy(true);
  let draftId:string|null=null;
  try{
   const inserted=await sb.from('assignments').insert({
    school_id:schoolId,class_id:chosen,teacher_id:teacherId,topic:topic.trim(),published:false
   }).select('id').single();
   if(inserted.error||!inserted.data)throw new Error(inserted.error?.message||'Не удалось создать черновик');
   draftId=inserted.data.id as string;
   const rows=questions.map((x,i)=>({
    school_id:schoolId,assignment_id:draftId,position:i+1,
    question_text:x.question.trim(),level:x.level
   }));
   const savedQuestions=await sb.from('assignment_questions').insert(rows).select('id,position');
   if(savedQuestions.error||!savedQuestions.data||savedQuestions.data.length!==questions.length){
    throw new Error(savedQuestions.error?.message||'Не удалось сохранить вопросы');
   }
   const keys=savedQuestions.data.map(x=>({
    school_id:schoolId,question_id:x.id as string,
    answer_text:questions[Number(x.position)-1].answer.trim()
   }));
   const savedKeys=await sb.from('assignment_keys').insert(keys);
   if(savedKeys.error)throw new Error(savedKeys.error.message);
   const publish=await sb.from('assignments').update({published:true}).eq('id',draftId);
   if(publish.error)throw new Error(publish.error.message);
   setMessage('Задание опубликовано. Ученики назначенного класса могут открыть его после входа.');
   setTopic('');setQuestions(initial());onSaved();
  }catch(err){
   if(draftId){
    const rollback=await sb.from('assignments').delete().eq('id',draftId);
    setError((err instanceof Error?err.message:'Неизвестная ошибка')+
      (rollback.error?' Черновик остался в базе: '+rollback.error.message:' Изменения задания отменены.'));
   }else setError(err instanceof Error?err.message:'Неизвестная ошибка');
  }finally{setBusy(false)}
 }
 if(!options.length)return <section className="card"><h2>Создание задания</h2><p className="muted">Для начала администратор должен назначить учителя на класс и предмет.</p></section>;
 return <section className="card"><h2>Создать задание для класса</h2>
 <p className="muted">В этом прототипе учитель вручную задаёт вопросы и отдельные правильные ответы. После сохранения ключи остаются в закрытой таблице.</p>
 <form onSubmit={e=>void create(e)}>
 <label htmlFor="assignmentClass">Мой класс</label>
 <select id="assignmentClass" value={chosen} onChange={e=>setClassId(e.target.value)}>
 {options.map(x=><option value={x.id} key={x.id}>{x.label} · {x.academic_year}</option>)}
 </select>
 <label htmlFor="assignmentTopic">Тема</label><input id="assignmentTopic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={300} required placeholder="Арифметическая прогрессия"/>
 {questions.map((q,i)=><div className="card" style={{boxShadow:'none'}} key={i}>
 <b>Задание {i+1}</b><label htmlFor={'q'+i}>Условие</label>
 <input id={'q'+i} value={q.question} maxLength={3000} required onChange={e=>update(i,'question',e.target.value)} placeholder="Найдите a₅, если a₁=2, d=3"/>
 <label htmlFor={'a'+i}>Ответ (не виден ученикам)</label>
 <input id={'a'+i} value={q.answer} maxLength={1000} required onChange={e=>update(i,'answer',e.target.value)} placeholder="14"/>
 <label htmlFor={'l'+i}>Уровень</label>
 <select id={'l'+i} value={q.level} onChange={e=>update(i,'level',e.target.value as Question['level'])}>
 <option>A</option><option>B</option><option>C</option>
 </select></div>)}
 <div className="actions"><button className="btn" type="button" disabled={questions.length>=10||busy}
 onClick={()=>setQuestions(xs=>[...xs,{question:'',answer:'',level:'B'}])}>Добавить вопрос</button>
 <button className="btn primary" disabled={busy} type="submit">{busy?'Публикация…':'Опубликовать задание'}</button></div>
 </form>
 {message&&<p className="success" role="status">{message}</p>}
 {error&&<p className="error" role="alert">{error}</p>}
 </section>
}
