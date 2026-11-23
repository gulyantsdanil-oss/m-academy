-- Atomic, authenticated student submission.
-- Install AFTER 20261123_initial.sql. SECURITY DEFINER is limited to this function.
begin;
create or replace function public.submit_assignment_answers(
 p_assignment uuid,
 p_answers jsonb
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
 v_assignment public.assignments%rowtype;
 v_user uuid := auth.uid();
 v_submission uuid;
 v_n integer;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
   raise exception 'Answers must be an object';
 end if;
 select * into v_assignment
 from public.assignments where id=p_assignment and published=true;
 if not found then raise exception 'Assignment not available'; end if;

 if not app_private.is_student_of(v_assignment.class_id) then
   raise exception 'Not enrolled in this class';
 end if;
 if not app_private.has_role(v_assignment.school_id, array['student']) then
   raise exception 'Student role is required';
 end if;

 select count(*) into v_n from public.assignment_questions
 where assignment_id=p_assignment;
 if v_n < 1 or v_n > 100 then raise exception 'Invalid assignment questions'; end if;

 if (select count(*) from pg_catalog.jsonb_each_text(p_answers)) <> v_n then
   raise exception 'All questions must have answers';
 end if;

 if exists(
  select 1 from pg_catalog.jsonb_each_text(p_answers) as a(key,value)
  left join public.assignment_questions q on q.id::text=a.key
   and q.assignment_id=p_assignment
  where q.id is null or pg_catalog.length(a.value)>1000 or pg_catalog.length(pg_catalog.btrim(a.value))=0
 ) then raise exception 'Unknown question or invalid answer'; end if;

 insert into public.submissions(school_id,assignment_id,student_id)
 values(v_assignment.school_id,p_assignment,v_user)
 returning id into v_submission;

 insert into public.submission_answers(school_id,submission_id,question_id,answer_text)
 select v_assignment.school_id,v_submission,q.id,a.value
 from pg_catalog.jsonb_each_text(p_answers) a(key,value)
 join public.assignment_questions q on q.id::text=a.key and q.assignment_id=p_assignment;

 return v_submission;
end;
$$;

revoke all on function public.submit_assignment_answers(uuid,jsonb) from public, anon;
grant execute on function public.submit_assignment_answers(uuid,jsonb) to authenticated;

-- No direct partial writes by students; only the transactional RPC can submit.
revoke insert on public.submissions,public.submission_answers from authenticated;
commit;
