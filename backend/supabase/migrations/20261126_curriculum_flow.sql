-- M-academy: canonical topics and typed links for KTP -> lesson -> assignment.
-- Applies after 20261123_initial.sql and later pilot migrations.
-- Run in an isolated test project and validate RLS before using live data.
begin;

create table if not exists public.curriculum_topics (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null,
 class_id uuid not null,
 teacher_id uuid not null,
 plan_id uuid not null,
 position integer not null check(position between 1 and 1000),
 topic text not null check(length(trim(topic)) between 2 and 300),
 hours integer not null check(hours between 1 and 50),
 scheduled_on date,
 goals text not null default '' check(length(goals)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(plan_id,position),
 unique(id,school_id,class_id,teacher_id),
 foreign key(plan_id,school_id) references public.curriculum_plans(id,school_id) on delete cascade,
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(school_id,teacher_id) references public.memberships(school_id,user_id)
);

-- Keep topic's class and teacher consistent with the plan, not merely the school.
-- The unique constraint permits a composite FK without a SECURITY DEFINER trigger.
alter table public.curriculum_plans
 add constraint curriculum_plans_link_identity_unique unique(id,school_id,class_id,teacher_id);
alter table public.curriculum_topics
 add constraint curriculum_topics_plan_owner_fk
 foreign key(plan_id,school_id,class_id,teacher_id)
 references public.curriculum_plans(id,school_id,class_id,teacher_id) on delete cascade;

create index if not exists curriculum_topics_class_idx
 on public.curriculum_topics(school_id,class_id,teacher_id,plan_id,position);

-- Existing lesson drafts and assignments continue to work without a KTP reference.
alter table public.lesson_drafts
 add column if not exists curriculum_topic_id uuid;
alter table public.assignments
 add column if not exists curriculum_topic_id uuid;

alter table public.lesson_drafts
 add constraint lesson_drafts_curriculum_topic_fk
 foreign key(curriculum_topic_id,school_id,class_id,teacher_id)
 references public.curriculum_topics(id,school_id,class_id,teacher_id);
alter table public.assignments
 add constraint assignments_curriculum_topic_fk
 foreign key(curriculum_topic_id,school_id,class_id,teacher_id)
 references public.curriculum_topics(id,school_id,class_id,teacher_id);

create index if not exists lesson_drafts_curriculum_idx on public.lesson_drafts(curriculum_topic_id);
create index if not exists assignments_curriculum_idx on public.assignments(curriculum_topic_id);

alter table public.curriculum_topics enable row level security;
drop policy if exists topics_teacher_select on public.curriculum_topics;
create policy topics_teacher_select on public.curriculum_topics
 for select to authenticated using (
  teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id)
 );
drop policy if exists topics_teacher_insert on public.curriculum_topics;
create policy topics_teacher_insert on public.curriculum_topics
 for insert to authenticated with check (
  teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id)
 );
drop policy if exists topics_teacher_update on public.curriculum_topics;
create policy topics_teacher_update on public.curriculum_topics
 for update to authenticated
 using (teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id))
 with check (teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id));
drop policy if exists topics_teacher_delete on public.curriculum_topics;
create policy topics_teacher_delete on public.curriculum_topics
 for delete to authenticated using (
  teacher_id=(select auth.uid()) and app_private.is_teacher_of(class_id)
 );

revoke all on public.curriculum_topics from anon,authenticated;
grant select,insert on public.curriculum_topics to authenticated;
grant update(topic,hours,scheduled_on,goals,updated_at) on public.curriculum_topics to authenticated;
grant delete on public.curriculum_topics to authenticated;

-- Linking an assignment to a topic is possible only for its assigned teacher;
-- the composite FK disallows linking another class or another teacher's topic.
grant update(curriculum_topic_id) on public.lesson_drafts,public.assignments to authenticated;

commit;
