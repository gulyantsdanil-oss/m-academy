-- Ensure class roster members have the appropriate active school role.
-- RLS on class_teachers and class_students still enforces administrator-only writes.
begin;
create or replace function app_private.validate_class_roster_role()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
 v_role text;
 v_user uuid;
begin
 if tg_table_name='class_teachers' then
  v_role:='teacher';
  v_user:=new.teacher_id;
 elsif tg_table_name='class_students' then
  v_role:='student';
  v_user:=new.student_id;
 else
  raise exception 'Unexpected roster table';
 end if;
 if not exists(
  select 1 from public.memberships m
   where m.school_id=new.school_id and m.user_id=v_user
    and m.role=v_role and m.active=true
 ) then raise exception 'Class roster member lacks active % role in this school',v_role;
 end if;
 return new;
end
$$;
revoke all on function app_private.validate_class_roster_role() from public,anon,authenticated;

drop trigger if exists class_teachers_valid_role on public.class_teachers;
create trigger class_teachers_valid_role before insert or update
on public.class_teachers for each row
execute function app_private.validate_class_roster_role();

drop trigger if exists class_students_valid_role on public.class_students;
create trigger class_students_valid_role before insert or update
on public.class_students for each row
execute function app_private.validate_class_roster_role();

commit;
