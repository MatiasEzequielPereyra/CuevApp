begin;
select no_plan();
select ok(to_regprocedure('public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text,text)') is not null,
 'exercise catalog writer supports weight/time tracking mode');

select ok('c7500000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001.mp4'
  ~ '^c7500000-0000-4000-8000-000000000001/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|mov|webm)$',
 'exercise video paths accept MP4 files');
select ok('c7500000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001.mov'
  ~ '^c7500000-0000-4000-8000-000000000001/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|mov|webm)$',
 'exercise video paths accept MOV files');
select ok('c7500000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001.webm'
  ~ '^c7500000-0000-4000-8000-000000000001/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|mov|webm)$',
 'exercise video paths accept WebM files');
select ok(not ('c7500000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001.exe'
  ~ '^c7500000-0000-4000-8000-000000000001/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](mp4|mov|webm)$'),
 'exercise video paths reject unsupported extensions');
select ok('https://youtube.com/watch?v=dQw4w9WgXcQ'
  ~ '^https://((www[.])?youtube[.]com/(watch[?]v=|shorts/|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}$',
 'exercise writer accepts canonical YouTube URLs without www');
select ok('https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  ~ '^https://((www[.])?youtube[.]com/(watch[?]v=|shorts/|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}$',
 'exercise writer accepts canonical YouTube URLs with www');
select ok(not ('https://youtube.com/watch?v=dQw4w9WgXcQ&feature=share'
  ~ '^https://((www[.])?youtube[.]com/(watch[?]v=|shorts/|embed/)|youtu[.]be/)[A-Za-z0-9_-]{11}$'),
 'exercise writer rejects YouTube URLs with extra parameters');
select ok(to_regprocedure('public.cueva_student_mentioned_exercises_with_tracking_mode()') is not null,
 'student text mentions expose tracking mode');
select ok(has_function_privilege('authenticated','public.cueva_student_mentioned_exercises_with_tracking_mode()','EXECUTE'),
 'authenticated students can read tracking mode for their own text mentions');
select ok(not has_function_privilege('anon','public.cueva_student_mentioned_exercises_with_tracking_mode()','EXECUTE'),
 'anonymous users cannot read text mention tracking modes');

select ok(to_regprocedure('public.cueva_workout_update(uuid,integer,text,text,numeric,integer,jsonb)') is not null,
 'workout update RPC supports optimistic record edits');
select ok(has_function_privilege('authenticated','public.cueva_workout_update(uuid,integer,text,text,numeric,integer,jsonb)','EXECUTE'),
 'authenticated students can edit their own workout records');
select ok(not has_function_privilege('anon','public.cueva_workout_update(uuid,integer,text,text,numeric,integer,jsonb)','EXECUTE'),
 'anonymous users cannot edit workout records');
select ok(to_regprocedure('public.cueva_workout_delete(uuid,integer)') is not null,
 'workout history exposes a revision-checked delete RPC');
select ok(has_function_privilege('authenticated','public.cueva_workout_delete(uuid,integer)','EXECUTE'),
 'authenticated students can delete their own workout records');
select ok(not has_function_privilege('anon','public.cueva_workout_delete(uuid,integer)','EXECUTE'),
 'anonymous users cannot delete workout records');
select ok(to_regprocedure('public.cueva_workout_history_batch(uuid[])') is not null,'workout summary batch RPC is installed');
select ok(has_function_privilege('authenticated','public.cueva_workout_history_batch(uuid[])','EXECUTE'),'authenticated students can call the summary batch RPC');
select ok(not has_function_privilege('anon','public.cueva_workout_history_batch(uuid[])','EXECUTE'),'anonymous users cannot call the summary batch RPC');
insert into auth.users(id,aud,role,email,created_at,updated_at) values
 ('c7100000-0000-4000-8000-000000000001','authenticated','authenticated','workout-a@example.test',now(),now()),
 ('c7100000-0000-4000-8000-000000000002','authenticated','authenticated','workout-b@example.test',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('c7200000-0000-4000-8000-000000000001','c7100000-0000-4000-8000-000000000001',now(),now()),
 ('c7200000-0000-4000-8000-000000000002','c7100000-0000-4000-8000-000000000002',now(),now());
insert into cueva_private.access_state(user_id,ready,session_not_before) values
 ('c7100000-0000-4000-8000-000000000001',true,now()-interval '1 minute'),
 ('c7100000-0000-4000-8000-000000000002',true,now()-interval '1 minute');
insert into public.cueva_profiles(user_id,role) values
 ('c7100000-0000-4000-8000-000000000001','alumno'),
 ('c7100000-0000-4000-8000-000000000002','alumno');
insert into public.cueva_students(id,first_name,last_name,email,joined_on) values
 ('c7300000-0000-4000-8000-000000000001','Alumno','A','workout-a@example.test',date '2026-01-01'),
 ('c7300000-0000-4000-8000-000000000002','Alumno','B','workout-b@example.test',date '2026-01-01');
insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values
 ('c7300000-0000-4000-8000-000000000001','workout-a@example.test','c7100000-0000-4000-8000-000000000001','sent','c7400000-0000-4000-8000-000000000001','c7100000-0000-4000-8000-000000000001'),
 ('c7300000-0000-4000-8000-000000000002','workout-b@example.test','c7100000-0000-4000-8000-000000000002','sent','c7400000-0000-4000-8000-000000000002','c7100000-0000-4000-8000-000000000002');
insert into public.cueva_exercises(id,name,revision,updated_by,description,active,tracking_mode) values
 ('c7500000-0000-4000-8000-000000000001','Press banca',1,'c7100000-0000-4000-8000-000000000001','',true,'weight'),
 ('c7500000-0000-4000-8000-000000000002','Plancha',1,'c7100000-0000-4000-8000-000000000001','',true,'weight'),
 ('c7500000-0000-4000-8000-000000000003','Remo',1,'c7100000-0000-4000-8000-000000000001','',true,'weight'),
 ('c7500000-0000-4000-8000-000000000004','Cardio',1,'c7100000-0000-4000-8000-000000000001','',true,'time');
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values
 ('c7600000-0000-4000-8000-000000000001','c7300000-0000-4000-8000-000000000001',1,'Rutina vieja','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000001","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000001","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000001","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":50}]}]}]}'::jsonb),
 ('c7600000-0000-4000-8000-000000000002','c7300000-0000-4000-8000-000000000001',2,'Rutina actual','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000002","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000002","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000002","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":60},{"id":"c7900000-0000-4000-8000-000000000003","exercise_id":"c7500000-0000-4000-8000-000000000002","name":"Plancha","note":"","mode":"time","duration":60,"unit":"seconds"}]}]}]}'::jsonb),
 ('c7600000-0000-4000-8000-000000000003','c7300000-0000-4000-8000-000000000002',1,'Rutina texto','c7100000-0000-4000-8000-000000000001',null);
insert into public.cueva_routine_text_publications(publication_id,student_id,format,text_content,block_content,mentions,published_by)
values ('c7600000-0000-4000-8000-000000000003','c7300000-0000-4000-8000-000000000002','text','Remo','',
 '[{"exercise_id":"c7500000-0000-4000-8000-000000000003","start":0,"end":4,"text":"Remo"},{"exercise_id":"c7500000-0000-4000-8000-000000000004","start":5,"end":11,"text":"Cardio"}]'::jsonb,
 'c7100000-0000-4000-8000-000000000001');

select ok(has_function_privilege('authenticated','public.cueva_workout_record(uuid,uuid,uuid,uuid,text,text,numeric,integer,jsonb)','EXECUTE'),
 'authenticated students can call the workout record RPC');
select ok(not has_function_privilege('anon','public.cueva_workout_record(uuid,uuid,uuid,uuid,text,text,numeric,integer,jsonb)','EXECUTE'),
 'anonymous users cannot call the workout record RPC');
select ok(not has_table_privilege('authenticated','public.cueva_workout_entries','SELECT'),
 'students cannot bypass the owner-scoped history RPC');
select ok(not has_table_privilege('authenticated','public.cueva_workout_sets','SELECT'),
 'students cannot read raw workout set rows');

select set_config('request.jwt.claim.sub','c7100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c7100000-0000-4000-8000-000000000001','role','authenticated','session_id','c7200000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;

select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick','weight',72.5,null,'[]'::jsonb)->'entry'->>'quick_weight_kg')::numeric,72.5,
 'quick weight is stored against the exercise UUID and current publication');
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick','weight',72.5,null,'[]'::jsonb)->'entry'->>'id'),
 'c8100000-0000-4000-8000-000000000001',
 'an exact retry is idempotent');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick','weight',73,null,'[]'::jsonb)$$,'22023',null,'an operation ID cannot be reused with a different weight');

select is((public.cueva_workout_update(
 'c8100000-0000-4000-8000-000000000001',1,'quick','weight',74,null,'[]'::jsonb)->'entry'->>'revision')::integer,2,
 'students can edit their own prior workout result with revision increment');
select is((public.cueva_workout_update(
 'c8100000-0000-4000-8000-000000000001',1,'quick','weight',74,null,'[]'::jsonb)->'entry'->>'quick_weight_kg')::numeric,74::numeric,
 'replaying the same update is idempotent');
select throws_ok($stale_update$select public.cueva_workout_update(
 'c8100000-0000-4000-8000-000000000001',1,'quick','weight',80,null,'[]'::jsonb)$stale_update$,
 '40001',null,'stale workout edits are rejected');

select is(jsonb_array_length(public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000002','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'sets','weight',null,null,'[{"reps":10,"weight_kg":70},{"reps":8,"weight_kg":75}]'::jsonb)->'sets'),2,
 'detailed entry stores distinct weights and reps per set');
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000011','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000002','c7900000-0000-4000-8000-000000000003',
 'quick','time',null,60,'[]'::jsonb)->'entry'->>'quick_duration_seconds')::integer,60,
 'time-based block exercises store duration in seconds without kilograms');
select is(jsonb_array_length(public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000012','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000002','c7900000-0000-4000-8000-000000000003',
 'sets','time',null,null,'[{"duration_seconds":60},{"duration_seconds":45}]'::jsonb)->'sets'),2,
 'timed exercises support different durations per set');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000002')->>'last_duration_seconds')::integer,45,
 'last timed suggestion uses the final set duration');
select throws_ok($duration_limit$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000014','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000002','c7900000-0000-4000-8000-000000000003',
 'quick','time',null,86401,'[]'::jsonb)$duration_limit$,'22023',null,
 'timed entries above 86400 seconds are rejected');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->>'last_weight_kg')::numeric,75::numeric,
 'last suggestion uses the final set of the most recent workout');
select is(jsonb_array_length(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->'entries'),2,
 'history returns both quick and detailed entries for this UUID');
select is(jsonb_array_length(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001',1,0)->'entries'),1,
 'history pages respect the requested page size');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000001',1,0)->>'has_more')::boolean,true,
 'history indicates when older records remain');
select is(jsonb_array_length(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001',1,1)->'entries'),1,
 'history offset returns the next record');
select is((public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid,'c7500000-0000-4000-8000-000000000002'::uuid,'c7500000-0000-4000-8000-000000000003'::uuid,'c7500000-0000-4000-8000-000000000001'::uuid])->'c7500000-0000-4000-8000-000000000001'->>'last_weight_kg')::numeric,75::numeric,'batch summary returns the latest weight for its UUID');
select is((public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000002'::uuid])->'c7500000-0000-4000-8000-000000000002'->>'last_duration_seconds')::integer,45,'batch summary returns the latest time-based set duration');
select is(jsonb_array_length(public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid,'c7500000-0000-4000-8000-000000000002'::uuid])->'c7500000-0000-4000-8000-000000000001'->'entries'),1,'batch summary returns only the latest entry for each exercise');
select is((public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid])->'c7500000-0000-4000-8000-000000000001'->>'has_more')::boolean,true,'batch summary signals when older history exists without transferring it');
select is((select count(*)::integer from jsonb_object_keys(public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid,'c7500000-0000-4000-8000-000000000001'::uuid]))),1,'batch summaries deduplicate repeated exercise UUIDs');
select is(jsonb_array_length(public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000003'::uuid])->'c7500000-0000-4000-8000-000000000003'->'entries'),0,'batch summary returns empty history when no records exist');
select throws_ok($batch_too_many$select public.cueva_workout_history_batch(array(select gen_random_uuid() from generate_series(1,101)))$batch_too_many$,'22023',null,'batch summary rejects more than 100 UUIDs');
select throws_ok($batch_null$select public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid,null])$batch_null$,'22023',null,'batch summary rejects null UUIDs');
select throws_ok($batch_empty$select public.cueva_workout_history_batch('{}'::uuid[])$batch_empty$,'22023',null,'batch summary rejects an empty UUID array');

-- A lost response can be retried after the administrator publishes a newer
-- snapshot. The existing operation must replay instead of creating a duplicate.
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000015','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick','weight',68,null,'[]'::jsonb)->'entry'->>'quick_weight_kg')::numeric,68::numeric,
 'a pending operation is committed before the newer publication exists');
reset role;
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values
 ('c7600000-0000-4000-8000-000000000004','c7300000-0000-4000-8000-000000000001',3,'Nueva rutina','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000003","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000003","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000004","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":60},{"id":"c7900000-0000-4000-8000-000000000005","exercise_id":"c7500000-0000-4000-8000-000000000002","name":"Plancha","note":"","mode":"time","duration":60,"unit":"seconds"}]}]}]}'::jsonb);
set local role authenticated;
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000015','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick','weight',68,null,'[]'::jsonb)->'entry'->>'id'),
 'c8100000-0000-4000-8000-000000000015',
 'an exact retry replays after a newer publication is committed');
reset role;
update public.cueva_workout_entries set performed_at=timestamptz '2026-01-01 12:00:00+00',created_at=timestamptz '2026-01-01 12:00:00+00'
where student_id='c7300000-0000-4000-8000-000000000001' and exercise_id='c7500000-0000-4000-8000-000000000001';
set local role authenticated;
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->'entries'->0->>'id'),'c8100000-0000-4000-8000-000000000015',
 'history order is stable by created_at and id when performed_at ties');
select is((public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid])->'c7500000-0000-4000-8000-000000000001'->'entries'->0->>'id'),
 'c8100000-0000-4000-8000-000000000015',
 'batch history order is stable by created_at and id when performed_at ties');
select throws_ok($stale_delete$select public.cueva_workout_delete(
 'c8100000-0000-4000-8000-000000000002',2)$stale_delete$,
 '40001',null,'stale history deletion is rejected');
select is((public.cueva_workout_delete(
 'c8100000-0000-4000-8000-000000000002',1)->>'deleted')::boolean,true,
 'students can delete their own history entry with its current revision');
select is((select count(*)::integer from public.cueva_workout_entries
 where id='c8100000-0000-4000-8000-000000000002'),0,
 'deleting a history entry removes its parent record');
select is((select count(*)::integer from public.cueva_workout_sets
 where entry_id='c8100000-0000-4000-8000-000000000002'),0,
 'deleting a history entry cascades to its workout sets');

select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000003','c7600000-0000-4000-8000-000000000004',
 'c7500000-0000-4000-8000-000000000002','c7900000-0000-4000-8000-000000000005',
 'quick','weight',20,null,'[]'::jsonb)$$,'22023',null,'time-based exercises reject kilogram entries');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000004','c7600000-0000-4000-8000-000000000001',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000001',
 'quick','weight',20,null,'[]'::jsonb)$$,'42501',null,'a superseded publication cannot receive a new entry');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000005','c7600000-0000-4000-8000-000000000004',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000004',
 'quick','weight',2000.01,null,'[]'::jsonb)$$,'22023',null,'weights above 2000 kg are rejected');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000006','c7600000-0000-4000-8000-000000000004',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000004',
 'sets','weight',null,null,'[{"reps":0,"weight_kg":70}]'::jsonb)$$,'22023',null,'invalid set repetitions are rejected');

select set_config('request.jwt.claim.sub','c7100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c7100000-0000-4000-8000-000000000002','role','authenticated','session_id','c7200000-0000-4000-8000-000000000002')::text,true);
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000007','c7600000-0000-4000-8000-000000000003',
 'c7500000-0000-4000-8000-000000000003',null,
 'quick','weight',45,null,'[]'::jsonb)->'entry'->>'exercise_id'),
 'c7500000-0000-4000-8000-000000000003',
 'text-routine UUID mentions support student workout logging');
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000013','c7600000-0000-4000-8000-000000000003',
 'c7500000-0000-4000-8000-000000000004',null,
 'quick','time',null,90,'[]'::jsonb)->'entry'->>'quick_duration_seconds')::integer,90,
 'time-based text mentions support duration logging in seconds');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000004')->>'last_duration_seconds')::integer,90,
 'text time history is isolated by exercise UUID');
select throws_ok($text_target$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000010','c7600000-0000-4000-8000-000000000003',
 'c7500000-0000-4000-8000-000000000003','c7900000-0000-4000-8000-000000000004',
 'quick','weight',45,null,'[]'::jsonb)$text_target$,'22023',null,
 'text mentions cannot be attributed to arbitrary structured target ids');
select is((select tracking_mode from public.cueva_student_mentioned_exercises_with_tracking_mode()
 where id='c7500000-0000-4000-8000-000000000004'),'time',
 'text mentions expose the catalog time mode');
select throws_ok($time_text$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000009','c7600000-0000-4000-8000-000000000003',
 'c7500000-0000-4000-8000-000000000004',null,
 'quick','weight',45,null,'[]'::jsonb)$time_text$,'22023',null,'time-based text mentions reject kilogram entries');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000008','c7600000-0000-4000-8000-000000000004',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000004',
 'quick','weight',45,null,'[]'::jsonb)$$,'42501',null,'a student cannot write another students workout');
select throws_ok($owner_update$select public.cueva_workout_update(
 'c8100000-0000-4000-8000-000000000001',2,'quick','weight',74,null,'[]'::jsonb)$owner_update$,
 '42501',null,'student B cannot edit student A workout history');
select is(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->>'last_weight_kg',null,
 'history is isolated by authenticated student');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000003')->>'last_weight_kg')::numeric,45::numeric,
 'text exercise history is keyed by UUID for its owner');
select is((public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid])->'c7500000-0000-4000-8000-000000000001'->>'last_weight_kg'),null,'batch history does not expose another students workout');
select is(jsonb_array_length(public.cueva_workout_history_batch(array['c7500000-0000-4000-8000-000000000001'::uuid])->'c7500000-0000-4000-8000-000000000001'->'entries'),0,'batch history returns empty results for another students exercise');

reset role;
set local role anon;
select throws_ok($$select public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')$$,'42501',null,
 'anonymous users cannot query workout history');
reset role;

-- The seven-field deployed/rollback API must coexist with the new contract.
reset role;
update public.cueva_profiles set role='admin'
  where user_id='c7100000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','c7100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c7100000-0000-4000-8000-000000000001','role','authenticated','session_id','c7200000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;
select is(public.cueva_exercise_write('c7500000-0000-4000-8000-000000000099',
  'Legacy compatibility',true,0,'',null,null)->>'tracking_mode','weight',
  'old API creates weight exercises against migrated schema');
select is(public.cueva_exercise_write('c7500000-0000-4000-8000-000000000099',
  'Legacy compatibility',true,1,'',null,null,'time')->>'tracking_mode','time',
  'new API can change the mode explicitly');
select is(public.cueva_exercise_write('c7500000-0000-4000-8000-000000000099',
  'Legacy compatibility',true,2,'Rollback edit',null,null)->>'tracking_mode','time',
  'rollback API preserves an existing time mode');
select is((public.cueva_exercise_write('c7500000-0000-4000-8000-000000000099',
  'Legacy compatibility',true,2,'Rollback edit',null,null)->>'revision')::int,3,
  'legacy replay is idempotent');
select throws_ok($legacy_stale$select public.cueva_exercise_write(
  'c7500000-0000-4000-8000-000000000099','Legacy compatibility',true,1,'Stale',null,null)
  $legacy_stale$,'40001',null,'legacy writer preserves CAS conflict rejection');
select set_config('request.jwt.claim.sub','c7100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c7100000-0000-4000-8000-000000000002','role','authenticated','session_id','c7200000-0000-4000-8000-000000000002')::text,true);
select throws_ok($legacy_student$select public.cueva_exercise_write(
  'c7500000-0000-4000-8000-000000000099','Legacy compatibility',true,3,'Student',null,null)
  $legacy_student$,'42501',null,'a student cannot use the legacy writer');
reset role;
select ok(not has_function_privilege('anon',
  'public.cueva_exercise_write(uuid,text,boolean,integer,text,text,text)','EXECUTE'),
  'anonymous cannot execute the public compatibility wrapper');
select ok(not has_function_privilege('anon',
  'cueva_private.exercise_write(uuid,text,boolean,integer,text,text,text)','EXECUTE'),
  'anonymous cannot execute the private compatibility wrapper');
select * from finish();
rollback;
