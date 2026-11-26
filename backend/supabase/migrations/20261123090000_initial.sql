-- M-academy secure multi-school pilot schema.
-- Target: Supabase-hosted PostgreSQL, AFTER legal/privacy and hosting review.
-- MUST NOT be deployed to live student data without security review.
-- Provision schools and memberships only through trusted administrative service role.
begin;

create extension if not exists pgcrypto;

create schema if not exists app_private;

create table if not exists public.schools (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 200),
 created_at timestamptz not null default now()
);

create table if not exists public.memberships (
 school_id uuid not null references public.schools(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','teacher','student')),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(school_id,user_id)
);

create table if not exists public.classes (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.schools(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 40),
 academic_year text not null check(academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
 created_at timestamptz not null default now(),
 unique(id,school_id),
 unique(school_id,label,academic_year)
);

create table if not exists public.class_teachers (
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 subject text not null check(length(trim(subject)) between 2 and 100),
 primary key(class_id,teacher_id,subject),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id) on delete cascade
);
create index if not exists ct_teacher_idx on public.class_teachers(teacher_id,school_id);

create table if not exists public.class_students (
 school_id uuid not null,
 class_id uuid not null,
 student_id uuid not null,
 primary key(class_id,student_id),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,student_id) references public.memberships(school_id,user_id) on delete cascade
);
create index if not exists cs_student_idx on public.class_students(student_id,school_id);

-- SECURITY DEFINER helpers run as migration owner and avoid recursive membership RLS.
-- Restrict EXECUTE to authenticated; no dynamic SQL or user-selectable privilege input.
create or replace function app_private.has_role(_school uuid, _roles text[])
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.memberships m
  where m.school_id = _school and m.user_id = (select auth.uid())
    and m.active and m.role = any(_roles)
 )
$$;

create or replace function app_private.is_teacher_of(_class uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.class_teachers ct
  join public.memberships m on m.school_id=ct.school_id
   and m.user_id=ct.teacher_id
  where ct.class_id=_class and ct.teacher_id=(select auth.uid())
    and m.active and m.role='teacher'
 )
$$;

create or replace function app_private.is_student_of(_class uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.class_students cs
  join public.memberships m on m.school_id=cs.school_id
   and m.user_id=cs.student_id
  where cs.class_id=_class and cs.student_id=(select auth.uid())
    and m.active and m.role='student'
 )
$$;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
revoke all on function app_private.has_role(uuid,text[]) from public;
revoke all on function app_private.is_teacher_of(uuid) from public;
revoke all on function app_private.is_student_of(uuid) from public;
grant execute on function app_private.has_role(uuid,text[]) to authenticated;
grant execute on function app_private.is_teacher_of(uuid) to authenticated;
grant execute on function app_private.is_student_of(uuid) to authenticated;


create table if not exists public.curriculum_plans (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 subject text not null,
 content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
 revision integer not null default 1 check(revision > 0),
 updated_at timestamptz not null default now(),
 unique(id,school_id),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id)
);
create index if not exists plans_teacher_idx on public.curriculum_plans(teacher_id,school_id);

create table if not exists public.lesson_drafts (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 topic text not null check(length(trim(topic)) between 2 and 300),
 content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
 revision integer not null default 1 check(revision > 0),
 updated_at timestamptz not null default now(),
 unique(id,school_id),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id)
);

create table if not exists public.ksp_documents (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 topic text not null check(length(trim(topic)) between 2 and 300),
 content jsonb not null default '{}'::jsonb check(jsonb_typeof(content)='object'),
 revision integer not null default 1 check(revision > 0),
 updated_at timestamptz not null default now(),
 unique(id,school_id),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id)
);

create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 topic text not null check(length(trim(topic)) between 2 and 300),
 published boolean not null default false,
 due_at timestamptz,
 created_at timestamptz not null default now(),
 unique(id,school_id),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id)
);

-- Questions visible only if published to students. Never include answer keys here.
create table if not exists public.assignment_questions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 assignment_id uuid not null,
 position integer not null check(position between 1 and 100),
 question_text text not null check(length(trim(question_text)) between 1 and 3000),
 level text check(level in ('A','B','C')),
 unique(id,school_id),
 unique(assignment_id,position),
 foreign key(assignment_id,school_id) references public.assignments(id,school_id) on delete cascade
);

-- Separate restricted answer keys. No SELECT privileges for student role.
create table if not exists public.assignment_keys (
 school_id uuid not null,
 question_id uuid not null,
 answer_text text not null,
 explanation text,
 primary key(question_id),
 foreign key(question_id,school_id) references public.assignment_questions(id,school_id) on delete cascade
);

-- Student-controlled answer text is separate from teacher-controlled grading.
create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 assignment_id uuid not null,
 student_id uuid not null,
 submitted_at timestamptz not null default now(),
 unique(id,school_id),
 unique(assignment_id,student_id),
 foreign key(assignment_id,school_id) references public.assignments(id,school_id) on delete cascade,
 foreign key(school_id,student_id) references public.memberships(school_id,user_id)
);

create table if not exists public.submission_answers (
 school_id uuid not null,
 submission_id uuid not null,
 question_id uuid not null,
 answer_text text not null,
 primary key(submission_id,question_id),
 foreign key(submission_id,school_id) references public.submissions(id,school_id) on delete cascade,
 foreign key(question_id,school_id) references public.assignment_questions(id,school_id) on delete cascade
);

create table if not exists public.submission_grades (
 school_id uuid not null,
 submission_id uuid primary key,
 graded_by uuid not null,
 score numeric(6,2) not null check(score >= 0),
 feedback text,
 graded_at timestamptz not null default now(),
 foreign key(submission_id,school_id) references public.submissions(id,school_id) on delete cascade,
 foreign key(school_id,graded_by) references public.memberships(school_id,user_id)
);

-- Enable RLS. No policy grants create/update on schools and memberships:
-- account provisioning must be performed by a trusted service after verifying authority.
alter table public.schools enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_students enable row level security;
alter table public.curriculum_plans enable row level security;
alter table public.lesson_drafts enable row level security;
alter table public.ksp_documents enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.assignment_keys enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_answers enable row level security;
alter table public.submission_grades enable row level security;

-- DROP before CREATE so the script can be re-run during isolated pilot preparation.
drop policy if exists school_member_select on public.schools;
create policy school_member_select on public.schools for select to authenticated using(app_private.has_role(id,array['admin','teacher','student']));
drop policy if exists membership_self_or_admin on public.memberships;
create policy membership_self_or_admin on public.memberships for select to authenticated using(
 user_id=(select auth.uid()) or app_private.has_role(school_id,array['admin'])
);

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated using(
 app_private.has_role(school_id,array['admin'])
 or app_private.is_teacher_of(id) or app_private.is_student_of(id)
);
drop policy if exists classes_admin_insert on public.classes;
create policy classes_admin_insert on public.classes for insert to authenticated with check(app_private.has_role(school_id,array['admin']));
drop policy if exists classes_admin_update on public.classes;
create policy classes_admin_update on public.classes for update to authenticated
 using(app_private.has_role(school_id,array['admin']))
 with check(app_private.has_role(school_id,array['admin']));

drop policy if exists class_teachers_read on public.class_teachers;
create policy class_teachers_read on public.class_teachers for select to authenticated using(
 app_private.has_role(school_id,array['admin']) or
 (teacher_id=(select auth.uid()) and app_private.has_role(school_id,array['teacher']))
);
drop policy if exists class_teachers_admin_write on public.class_teachers;
create policy class_teachers_admin_write on public.class_teachers for all to authenticated
 using(app_private.has_role(school_id,array['admin']))
 with check(app_private.has_role(school_id,array['admin']));

drop policy if exists class_students_read on public.class_students;
create policy class_students_read on public.class_students for select to authenticated using(
 app_private.has_role(school_id,array['admin']) or app_private.is_teacher_of(class_id)
 or (student_id=(select auth.uid()) and app_private.has_role(school_id,array['student']))
);
drop policy if exists class_students_admin_write on public.class_students;
create policy class_students_admin_write on public.class_students for all to authenticated
 using(app_private.has_role(school_id,array['admin']))
 with check(app_private.has_role(school_id,array['admin']));

-- Never allow a teacher to impersonate another teacher by changing teacher_id/class_id.
-- Updates are limited by column privileges below.
drop policy if exists plans_teacher_all on public.curriculum_plans;
create policy plans_teacher_all on public.curriculum_plans for all to authenticated
 using(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id))
 with check(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id));
drop policy if exists drafts_teacher_all on public.lesson_drafts;
create policy drafts_teacher_all on public.lesson_drafts for all to authenticated
 using(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id))
 with check(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id));
drop policy if exists ksp_teacher_all on public.ksp_documents;
create policy ksp_teacher_all on public.ksp_documents for all to authenticated
 using(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id))
 with check(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id));

drop policy if exists assignments_teacher_all on public.assignments;
create policy assignments_teacher_all on public.assignments for all to authenticated
 using(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id))
 with check(teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id));
drop policy if exists assignments_student_select on public.assignments;
create policy assignments_student_select on public.assignments for select to authenticated using(
 published and app_private.is_student_of(class_id)
);

-- Correlated RLS predicates explicitly qualify OUTER row columns.
-- Unqualified references inside subqueries can resolve to the wrong table or fail 42702.
drop policy if exists questions_teacher_all on public.assignment_questions;
create policy questions_teacher_all on public.assignment_questions for all to authenticated
 using(exists(select 1 from public.assignments a
  where a.id=assignment_questions.assignment_id
  and a.school_id=assignment_questions.school_id
  and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id)))
 with check(exists(select 1 from public.assignments a
  where a.id=assignment_questions.assignment_id
  and a.school_id=assignment_questions.school_id
  and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id)));
drop policy if exists questions_student_read on public.assignment_questions;
create policy questions_student_read on public.assignment_questions for select to authenticated
 using(exists(select 1 from public.assignments a
  where a.id=assignment_questions.assignment_id
  and a.school_id=assignment_questions.school_id
  and a.published and app_private.is_student_of(a.class_id)));

drop policy if exists keys_teacher_all on public.assignment_keys;
create policy keys_teacher_all on public.assignment_keys for all to authenticated
 using(exists(select 1 from public.assignment_questions q
  join public.assignments a on a.id=q.assignment_id
  where q.id=assignment_keys.question_id and q.school_id=assignment_keys.school_id
  and a.school_id=assignment_keys.school_id
  and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id)))
 with check(exists(select 1 from public.assignment_questions q
  join public.assignments a on a.id=q.assignment_id
  where q.id=assignment_keys.question_id and q.school_id=assignment_keys.school_id
  and a.school_id=assignment_keys.school_id
  and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id)));

drop policy if exists submission_student_insert on public.submissions;
create policy submission_student_insert on public.submissions for insert to authenticated with check(
 submissions.student_id=(select auth.uid()) and exists(
  select 1 from public.assignments a
  where a.id=submissions.assignment_id and a.school_id=submissions.school_id
   and a.published and app_private.is_student_of(a.class_id)
 )
);
drop policy if exists submission_student_select on public.submissions;
create policy submission_student_select on public.submissions for select to authenticated using(
 submissions.student_id=(select auth.uid()) and app_private.has_role(submissions.school_id,array['student'])
);
drop policy if exists submission_teacher_select on public.submissions;
create policy submission_teacher_select on public.submissions for select to authenticated using(
 exists(select 1 from public.assignments a
  where a.id=submissions.assignment_id and a.school_id=submissions.school_id
  and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id))
);

drop policy if exists answers_student_insert on public.submission_answers;
create policy answers_student_insert on public.submission_answers for insert to authenticated with check(
 exists(select 1 from public.submissions s
  join public.assignments a on a.id=s.assignment_id and a.school_id=s.school_id
  where s.id=submission_answers.submission_id and s.school_id=submission_answers.school_id
   and s.student_id=(select auth.uid()) and a.published
   and app_private.is_student_of(a.class_id)
   and exists(select 1 from public.assignment_questions q
    where q.id=submission_answers.question_id and q.assignment_id=a.id
     and q.school_id=submission_answers.school_id))
);
drop policy if exists answers_student_select on public.submission_answers;
create policy answers_student_select on public.submission_answers for select to authenticated using(
 exists(select 1 from public.submissions s
  where s.id=submission_answers.submission_id and s.school_id=submission_answers.school_id
   and s.student_id=(select auth.uid())
   and app_private.has_role(submission_answers.school_id,array['student']))
);
drop policy if exists answers_teacher_select on public.submission_answers;
create policy answers_teacher_select on public.submission_answers for select to authenticated using(
 exists(select 1 from public.submissions s
  join public.assignments a on a.id=s.assignment_id and a.school_id=s.school_id
  where s.id=submission_answers.submission_id and s.school_id=submission_answers.school_id
   and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id))
);

drop policy if exists grades_teacher_all on public.submission_grades;
create policy grades_teacher_all on public.submission_grades for all to authenticated using(
 submission_grades.graded_by=(select auth.uid()) and exists(
  select 1 from public.submissions s
  join public.assignments a on a.id=s.assignment_id and a.school_id=s.school_id
  where s.id=submission_grades.submission_id and s.school_id=submission_grades.school_id
   and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id))
) with check(
 submission_grades.graded_by=(select auth.uid()) and exists(
  select 1 from public.submissions s
  join public.assignments a on a.id=s.assignment_id and a.school_id=s.school_id
  where s.id=submission_grades.submission_id and s.school_id=submission_grades.school_id
   and a.teacher_id=(select auth.uid()) and app_private.is_teacher_of(a.class_id))
);
drop policy if exists grades_student_select on public.submission_grades;
create policy grades_student_select on public.submission_grades for select to authenticated using(
 exists(select 1 from public.submissions s
  where s.id=submission_grades.submission_id and s.school_id=submission_grades.school_id
   and s.student_id=(select auth.uid())
   and app_private.has_role(submission_grades.school_id,array['student']))
);

-- Defense in depth: roles also need SQL table privileges; authenticated cannot touch memberships.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.schools,public.memberships,public.classes,public.class_teachers,
 public.class_students,public.curriculum_plans,public.lesson_drafts,public.ksp_documents,
 public.assignments,public.assignment_questions,public.assignment_keys,public.submissions,
 public.submission_answers,public.submission_grades to authenticated;

grant insert on public.classes,public.class_teachers,public.class_students,
 public.curriculum_plans,public.lesson_drafts,public.ksp_documents,
 public.assignments,public.assignment_questions,public.assignment_keys,
 public.submissions,public.submission_answers,public.submission_grades to authenticated;

grant update(label,academic_year) on public.classes to authenticated;
grant update(subject) on public.class_teachers to authenticated;
grant update(content,revision,updated_at) on public.curriculum_plans,public.lesson_drafts,public.ksp_documents to authenticated;
grant update(topic,published,due_at) on public.assignments to authenticated;
grant update(position,question_text,level) on public.assignment_questions to authenticated;
grant update(answer_text,explanation) on public.assignment_keys to authenticated;
grant update(score,feedback,graded_at) on public.submission_grades to authenticated;

grant delete on public.class_teachers,public.class_students,
 public.curriculum_plans,public.lesson_drafts,public.ksp_documents,
 public.assignments,public.assignment_questions,public.assignment_keys to authenticated;

-- IMPORTANT: service_role bypasses RLS; keep service key on trusted backend only.
-- Bootstrap memberships and validate role assignments via a protected administrative workflow.
commit;
