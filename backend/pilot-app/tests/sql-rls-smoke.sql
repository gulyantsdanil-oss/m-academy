-- Behavioral RLS smoke against PostgreSQL with the minimal CI auth shim.
-- Fake UUIDs only; this file must never touch a production project.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into public.schools(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','School A'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','School B');
insert into public.memberships(school_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','teacher'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','student');
insert into public.classes(id,school_id,label,academic_year) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','9Ж','2026-2027'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10Д','2026-2027');
insert into public.class_teachers(school_id,class_id,teacher_id,subject) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Алгебра');
insert into public.class_students(school_id,class_id,student_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222');
insert into public.curriculum_plans(id,school_id,class_id,teacher_id,subject,content) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','Алгебра','{"rows":[{"topic":"Арифметическая прогрессия","hours":1}]}');

set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.sync_curriculum_topics('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 '[{"topic":"Арифметическая прогрессия","hours":1,"goals":"Применение формул","scheduled_on":null}]'::jsonb);
do $$
declare
 v_topic uuid;
 v_assignment uuid;
begin
 select id into v_topic from public.curriculum_topics where plan_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if v_topic is null then raise exception 'Teacher could not create a curriculum topic'; end if;
 v_assignment:=public.publish_teacher_assignment(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Арифметическая прогрессия',
  '[{"question":"Найдите a5 при a1=2,d=3","answer":"14","level":"A"}]'::jsonb,
  v_topic);
 if v_assignment is null then raise exception 'Assignment not published'; end if;
 if (select count(*) from public.assignment_keys)<>1 then
  raise exception 'Teacher expected to read one answer key';
 end if;
 if (select count(*) from public.classes where school_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0 then
  raise exception 'Teacher accessed another school';
 end if;
end
$$;

set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
begin
 if (select count(*) from public.assignments where published)<>1 then
  raise exception 'Student did not see assigned published work';
 end if;
 if (select count(*) from public.assignment_questions)<>1 then
  raise exception 'Student could not read the assigned question';
 end if;
 if (select count(*) from public.assignment_keys)<>0 then
  raise exception 'Student could read confidential answer keys';
 end if;
 if (select count(*) from public.curriculum_topics)<>0 then
  raise exception 'Student accessed teacher curriculum topics';
 end if;
 if (select count(*) from public.classes where school_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>0 then
  raise exception 'Student accessed another school';
 end if;
end
$$;
rollback;
