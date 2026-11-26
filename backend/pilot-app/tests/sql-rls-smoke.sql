-- Behavioral RLS smoke against PostgreSQL with the minimal CI auth shim.
-- Fake UUIDs only; this file must never touch a production project.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
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

-- Students may submit their own published assignment exactly once.
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$
declare
 v_assignment uuid;
 v_question uuid;
 v_submission uuid;
 v_duplicate_blocked boolean:=false;
 v_write_blocked boolean:=false;
 v_affected integer:=0;
begin
 select id into v_assignment from public.assignments where published limit 1;
 select id into v_question from public.assignment_questions where assignment_id=v_assignment;
 v_submission:=public.submit_assignment_answers(v_assignment,jsonb_build_object(v_question::text,'14'));
 if v_submission is null then raise exception 'Submission was not created'; end if;
 if (select count(*) from public.submissions where id=v_submission)<>1 then
  raise exception 'Student cannot read own submission';
 end if;
 if (select count(*) from public.submission_answers where submission_id=v_submission)<>1 then
  raise exception 'Student answer not persisted';
 end if;
 begin
  perform public.submit_assignment_answers(v_assignment,jsonb_build_object(v_question::text,'15'));
 exception when unique_violation then v_duplicate_blocked:=true;
 end;
 if not v_duplicate_blocked then raise exception 'Duplicate student submission was accepted'; end if;
 begin
  update public.assignment_keys set answer_text='999' where question_id=v_question;
  get diagnostics v_affected = row_count;
  v_write_blocked:=v_affected=0;
 exception when insufficient_privilege then v_write_blocked:=true;
 end;
 if not v_write_blocked then raise exception 'Student could modify answer keys'; end if;
end
$$;

-- Grade a submitted work as the assigned teacher, then verify student read access.
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $grade_teacher$
declare
 v_submission uuid;
begin
 select s.id into v_submission from public.submissions s limit 1;
 if v_submission is null then raise exception 'Missing submission for grading'; end if;
 insert into public.submission_grades(school_id,submission_id,graded_by,score,feedback)
 values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',v_submission,auth.uid(),1,'Верно');
 if (select count(*) from public.submission_grades where submission_id=v_submission)<>1 then
  raise exception 'Teacher cannot read assigned grade';
 end if;
end
$grade_teacher$;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $grade_student$
declare
 v_row record;
 v_blocked boolean:=false;
 v_affected integer:=0;
begin
 select g.* into v_row from public.submission_grades g;
 if not found or v_row.score<>1 or v_row.feedback<>'Верно' then
  raise exception 'Student cannot read own score or feedback';
 end if;
 begin
  update public.submission_grades set score=99 where submission_id=v_row.submission_id;
  get diagnostics v_affected = row_count;
  v_blocked:=v_affected=0;
 exception when insufficient_privilege then v_blocked:=true;
 end;
 if not v_blocked then raise exception 'Student changed teacher grade'; end if;
end
$grade_student$;

-- Unassigned users cannot read assignments, self-provision membership or publish.
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $$
declare
 v_blocked boolean:=false;
 v_assignment uuid;
 v_topic uuid;
begin
 if (select count(*) from public.classes)<>0 then raise exception 'Unassigned user read classes'; end if;
 if (select count(*) from public.assignments)<>0 then raise exception 'Unassigned user read assignments'; end if;
 if (select count(*) from public.submission_grades)<>0 then raise exception 'Unassigned user read grades'; end if;
 begin
  insert into public.memberships(school_id,user_id,role)
   values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth.uid(),'admin');
 exception when insufficient_privilege then v_blocked:=true;
 end;
 if not v_blocked then raise exception 'User provisioned admin membership'; end if;
 v_blocked:=false;
 begin
  perform public.publish_teacher_assignment(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'Unauthorized', '[{"question":"1+1?","answer":"2","level":"A"}]'::jsonb,null);
 exception when others then v_blocked:=true;
 end;
 if not v_blocked then raise exception 'Unassigned user published assignment'; end if;
end
$$;

rollback;
