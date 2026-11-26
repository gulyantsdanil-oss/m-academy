-- Atomic synchronization of normalized KTP topics; no unsafe deletion or partial writes.
-- Requires 20261126_curriculum_flow.sql.
begin;
create or replace function public.sync_curriculum_topics(
 p_plan uuid,
 p_rows jsonb
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
 v_plan public.curriculum_plans%rowtype;
 v_count integer;
 v_existing integer;
 v_links boolean;
 v_row jsonb;
 v_pos integer:=0;
 v_topic text;
 v_hours integer;
 v_hours_text text;
 v_goals text;
 v_date date;
 v_date_text text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Advisory transaction lock serializes sync calls without granting plan UPDATE privileges.
 -- The existing document-revision RPC deliberately denies direct plan content updates.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_plan::text,0));
 select * into v_plan from public.curriculum_plans p
  where p.id=p_plan and p.teacher_id=auth.uid();
 if not found then raise exception 'Plan unavailable'; end if;
 if not app_private.is_teacher_of(v_plan.class_id) then raise exception 'Teacher not assigned'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Expected array'; end if;
 v_count:=jsonb_array_length(p_rows);
 if v_count<1 or v_count>1000 then raise exception 'Expected 1 to 1000 rows'; end if;
 select count(*) into v_existing from public.curriculum_topics where plan_id=p_plan;
 if v_existing>v_count then raise exception 'Cannot shrink a plan containing existing topics'; end if;
 select exists(
  select 1 from public.curriculum_topics t
  where t.plan_id=p_plan and (
   exists(select 1 from public.lesson_drafts d where d.curriculum_topic_id=t.id)
   or exists(select 1 from public.assignments a where a.curriculum_topic_id=t.id)
   or exists(select 1 from public.ksp_documents k where k.curriculum_topic_id=t.id)
  )
 ) into v_links;
 if v_links then
   -- A linked plan is immutable in this workflow except an exact no-op.
   if v_existing<>v_count then raise exception 'Linked curriculum cannot be resized'; end if;
 end if;

 -- Validate the entire JSON array before performing any inserts/updates.
 for v_row in select value from jsonb_array_elements(p_rows)
 loop
  v_pos:=v_pos+1;
  if jsonb_typeof(v_row)<>'object' then raise exception 'Invalid row %',v_pos; end if;
  v_topic:=btrim(coalesce(v_row->>'topic',''));
  v_hours_text:=v_row->>'hours';
  v_goals:=coalesce(v_row->>'goals','');
  v_date_text:=nullif(v_row->>'scheduled_on','');
  if length(v_topic) not between 2 and 300 or v_hours_text is null
   or v_hours_text !~ '^[0-9]{1,2}$' or length(v_goals)>2000 then
    raise exception 'Invalid row %',v_pos;
  end if;
  v_hours:=v_hours_text::integer;
  if v_hours not between 1 and 50 then raise exception 'Invalid hours at %',v_pos; end if;
  if v_date_text is not null then
   if v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date at %',v_pos; end if;
   v_date:=v_date_text::date;
  else v_date:=null; end if;

  if v_links and not exists(
   select 1 from public.curriculum_topics t
   where t.plan_id=p_plan and t.position=v_pos and t.topic=v_topic
     and t.hours=v_hours and t.goals=v_goals
     and t.scheduled_on is not distinct from v_date
  ) then raise exception 'Linked topic changed at position %',v_pos; end if;
 end loop;

 v_pos:=0;
 for v_row in select value from jsonb_array_elements(p_rows)
 loop
  v_pos:=v_pos+1;
  v_date_text:=nullif(v_row->>'scheduled_on','');
  insert into public.curriculum_topics
   (school_id,class_id,teacher_id,plan_id,position,topic,hours,scheduled_on,goals)
  values(
   v_plan.school_id,v_plan.class_id,auth.uid(),p_plan,v_pos,
   btrim(v_row->>'topic'),(v_row->>'hours')::integer,
   case when v_date_text is null then null else v_date_text::date end,
   coalesce(v_row->>'goals','')
  )
  on conflict(plan_id,position) do update set
   topic=excluded.topic,hours=excluded.hours,
   scheduled_on=excluded.scheduled_on,goals=excluded.goals,
   updated_at=now()
   where public.curriculum_topics.teacher_id=auth.uid()
     and public.curriculum_topics.school_id=v_plan.school_id
     and public.curriculum_topics.class_id=v_plan.class_id
     and (
      public.curriculum_topics.topic is distinct from excluded.topic
      or public.curriculum_topics.hours is distinct from excluded.hours
      or public.curriculum_topics.scheduled_on is distinct from excluded.scheduled_on
      or public.curriculum_topics.goals is distinct from excluded.goals
     );
 end loop;
 return v_count;
end;
$$;
revoke all on function public.sync_curriculum_topics(uuid,jsonb) from public,anon;
grant execute on function public.sync_curriculum_topics(uuid,jsonb) to authenticated;
commit;
