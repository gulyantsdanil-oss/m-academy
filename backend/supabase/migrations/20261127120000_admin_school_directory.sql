-- Admin-only display directory for active memberships of one school.
-- Profile metadata is cosmetic only, NEVER used for authorization.
begin;
create or replace function public.admin_school_directory(p_school uuid)
returns table(user_id uuid, display_name text, member_role text)
language plpgsql security definer
set search_path = ''
as $$
begin
 if (select auth.uid()) is null or not exists(
  select 1 from public.memberships m
   where m.school_id=p_school
    and m.user_id=(select auth.uid())
    and m.active=true and m.role='admin'
 ) then
  raise exception 'Administrator access to this school is required' using errcode='42501';
 end if;
 return query
 select m.user_id,
  coalesce(
   nullif(pg_catalog.btrim(u.raw_user_meta_data->>'full_name'),''),
   nullif(pg_catalog.btrim(u.raw_user_meta_data->>'name'),''),
   'Участник ' || pg_catalog.left(m.user_id::text,8)
  )::text as display_name,
  m.role::text as member_role
 from public.memberships m
 join auth.users u on u.id=m.user_id
 where m.school_id=p_school and m.active=true
 order by m.role,m.user_id
 limit 1000;
end
$$;
revoke all on function public.admin_school_directory(uuid) from public,anon,authenticated;
grant execute on function public.admin_school_directory(uuid) to authenticated;
commit;