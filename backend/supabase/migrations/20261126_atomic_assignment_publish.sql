-- Atomic teacher assignment creation, answer key insertion and publication.
-- Depends on 20261126_curriculum_flow.sql.
-- Runs with invoker privileges: all existing table RLS policies stay effective.
begin;
create or replace function public.publish_teacher_assignment(
 p_school uuid,
 p_class uuid,
 p_topic text,
 p_questions jsonb,
 p_curriculum_topic uuid default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
 v_id uuid;
 v_question uuid;
 v_item jsonb;
 v_count integer;
 v_pos integer:=0;
 v_question_text text;
 v_answer_text text;
 v_level text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists (
  select 1 from public.memberships m
  where m.school_id=p_school and m.user_id=auth.uid() and m.active and m.role='teacher'
 ) then raise exception 'No active teacher membership'; end if;
 if not app_private.is_teacher_of(p_class) then raise exception 'Teacher is not assigned to this class'; end if;
 if not exists(select 1 from public.classes c where c.id=p_class and c.school_id=p_school) then
  raise exception 'Class not found in selected school'; end if;
 if p_topic is null or length(btrim(p_topic)) not between 2 and 300 then
  raise exception 'Invalid topic'; end if;
 if p_questions is null or jsonb_typeof(p_questions)<>'array' then
  raise exception 'Questions must be JSON array'; end if;
 v_count:=jsonb_array_length(p_questions);
 if v_count<1 or v_count>50 then raise exception 'Question count must be 1..50'; end if;

 if p_curriculum_topic is not null and not exists(
   select 1 from public.curriculum_topics t
   where t.id=p_curriculum_topic and t.school_id=p_school
     and t.class_id=p_class and t.teacher_id=auth.uid()
 ) then raise exception 'Curriculum topic not available to teacher'; end if;

 -- All statements are part of one transaction; an exception rolls back the whole call.
 insert into public.assignments
 (school_id,class_id,teacher_id,topic,published,curriculum_topic_id)
 values (p_school,p_class,auth.uid(),btrim(p_topic),false,p_curriculum_topic)
 returning id into v_id;

 for v_item in select value from jsonb_array_elements(p_questions)
 loop
  if jsonb_typeof(v_item)<>'object' then raise exception 'Invalid question object'; end if;
  v_question_text:=btrim(coalesce(v_item->>'question',''));
  v_answer_text:=btrim(coalesce(v_item->>'answer',''));
  v_level:=coalesce(v_item->>'level','A');
  if length(v_question_text) not between 1 and 3000
     or length(v_answer_text) not between 1 and 1000
     or v_level not in ('A','B','C') then
   raise exception 'Invalid question or key at position %',v_pos+1;
  end if;
  v_pos:=v_pos+1;
  insert into public.assignment_questions(school_id,assignment_id,position,question_text,level)
   values (p_school,v_id,v_pos,v_question_text,v_level)
   returning id into v_question;
  insert into public.assignment_keys(school_id,question_id,answer_text)
   values (p_school,v_question,v_answer_text);
 end loop;

 update public.assignments set published=true where id=v_id and school_id=p_school;
 return v_id;
end;
$$;
revoke all on function public.publish_teacher_assignment(uuid,uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.publish_teacher_assignment(uuid,uuid,text,jsonb,uuid) to authenticated;
commit;
