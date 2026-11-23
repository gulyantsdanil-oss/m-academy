-- M-academy pilot document update hardening.
-- Run AFTER initial and atomic submissions migrations, in a separate TEST database.
-- Revisions use a compare-and-swap RPC; direct document content updates are revoked.
begin;

revoke update (content,revision,updated_at)
 on public.curriculum_plans, public.lesson_drafts, public.ksp_documents
 from authenticated;

-- Limit payload size before anyone can insert or update JSON contents.
alter table public.curriculum_plans
 add constraint plans_content_size check (octet_length(content::text)<=500000);
alter table public.lesson_drafts
 add constraint drafts_content_size check (octet_length(content::text)<=500000);
alter table public.ksp_documents
 add constraint ksp_content_size check (octet_length(content::text)<=500000);

create or replace function public.save_teacher_material(
 p_kind text,
 p_doc_id uuid,
 p_expected_revision integer,
 p_content jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_revision integer;
 v_uid uuid := (select auth.uid());
begin
 if v_uid is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if p_doc_id is null or p_expected_revision is null or p_expected_revision < 1 then
  raise exception 'Invalid document or revision';
 end if;
 if p_content is null or jsonb_typeof(p_content) <> 'object'
    or octet_length(p_content::text)>500000 then
  raise exception 'Invalid document content';
 end if;

 if p_kind='ksp' then
  update public.ksp_documents d
   set content=p_content,revision=d.revision+1,updated_at=now()
   where d.id=p_doc_id and d.teacher_id=v_uid
    and d.revision=p_expected_revision
    and app_private.is_teacher_of(d.class_id)
   returning d.revision into v_revision;
 elsif p_kind='ktp' then
  update public.curriculum_plans d
   set content=p_content,revision=d.revision+1,updated_at=now()
   where d.id=p_doc_id and d.teacher_id=v_uid
    and d.revision=p_expected_revision
    and app_private.is_teacher_of(d.class_id)
   returning d.revision into v_revision;
 elsif p_kind='lesson' then
  update public.lesson_drafts d
   set content=p_content,revision=d.revision+1,updated_at=now()
   where d.id=p_doc_id and d.teacher_id=v_uid
    and d.revision=p_expected_revision
    and app_private.is_teacher_of(d.class_id)
   returning d.revision into v_revision;
 else
  raise exception 'Unsupported material kind';
 end if;

 if v_revision is null then
  raise exception 'Document not found, access denied, or stale revision'
   using errcode='P0002';
 end if;
 return v_revision;
end;
$$;

revoke all on function public.save_teacher_material(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_teacher_material(text,uuid,integer,jsonb) to authenticated;
commit;
