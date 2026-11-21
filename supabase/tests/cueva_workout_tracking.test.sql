begin;
select no_plan();

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
insert into public.cueva_exercises(id,name,revision,updated_by,description,active) values
 ('c7500000-0000-4000-8000-000000000001','Press banca',1,'c7100000-0000-4000-8000-000000000001','',true),
 ('c7500000-0000-4000-8000-000000000002','Plancha',1,'c7100000-0000-4000-8000-000000000001','',true),
 ('c7500000-0000-4000-8000-000000000003','Remo',1,'c7100000-0000-4000-8000-000000000001','',true);
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values
 ('c7600000-0000-4000-8000-000000000001','c7300000-0000-4000-8000-000000000001',1,'Rutina vieja','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000001","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000001","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000001","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":50}]}]}]}'::jsonb),
 ('c7600000-0000-4000-8000-000000000002','c7300000-0000-4000-8000-000000000001',2,'Rutina actual','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000002","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000002","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000002","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":60},{"id":"c7900000-0000-4000-8000-000000000003","exercise_id":"c7500000-0000-4000-8000-000000000002","name":"Plancha","note":"","mode":"time","duration":60,"unit":"seconds"}]}]}]}'::jsonb),
 ('c7600000-0000-4000-8000-000000000003','c7300000-0000-4000-8000-000000000002',1,'Rutina texto','c7100000-0000-4000-8000-000000000001',null);
insert into public.cueva_routine_text_publications(publication_id,student_id,format,text_content,block_content,mentions,published_by)
values ('c7600000-0000-4000-8000-000000000003','c7300000-0000-4000-8000-000000000002','text','Remo','',
 '[{"exercise_id":"c7500000-0000-4000-8000-000000000003","start":0,"end":4,"text":"Remo"}]'::jsonb,
 'c7100000-0000-4000-8000-000000000001');

select ok(has_function_privilege('authenticated','public.cueva_workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)','EXECUTE'),
 'authenticated students can call the workout record RPC');
select ok(not has_function_privilege('anon','public.cueva_workout_record(uuid,uuid,uuid,uuid,text,numeric,jsonb)','EXECUTE'),
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
 'quick',72.5,'[]'::jsonb)->'entry'->>'quick_weight_kg')::numeric,72.5,
 'quick weight is stored against the exercise UUID and current publication');
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick',72.5,'[]'::jsonb)->'entry'->>'id'),
 'c8100000-0000-4000-8000-000000000001',
 'an exact retry is idempotent');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick',73,'[]'::jsonb)$$,'22023',null,'an operation ID cannot be reused with a different weight');

select is(jsonb_array_length(public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000002','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'sets',null,'[{"reps":10,"weight_kg":70},{"reps":8,"weight_kg":75}]'::jsonb)->'sets'),2,
 'detailed entry stores distinct weights and reps per set');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->>'last_weight_kg')::numeric,75::numeric,
 'last suggestion uses the final set of the most recent workout');
select is(jsonb_array_length(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->'entries'),2,
 'history returns both quick and detailed entries for this UUID');

-- A lost response can be retried after the administrator publishes a newer
-- snapshot. The existing operation must replay instead of creating a duplicate.
reset role;
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values
 ('c7600000-0000-4000-8000-000000000004','c7300000-0000-4000-8000-000000000001',3,'Nueva rutina','c7100000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"c7700000-0000-4000-8000-000000000003","name":"Día","blocks":[{"id":"c7800000-0000-4000-8000-000000000003","name":"Bloque","rounds":3,"exercises":[{"id":"c7900000-0000-4000-8000-000000000004","exercise_id":"c7500000-0000-4000-8000-000000000001","name":"Press banca","note":"","mode":"weight","reps":"8","weight_kg":60},{"id":"c7900000-0000-4000-8000-000000000005","exercise_id":"c7500000-0000-4000-8000-000000000002","name":"Plancha","note":"","mode":"time","duration":60,"unit":"seconds"}]}]}]}'::jsonb);
set local role authenticated;
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000001','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick',72.5,'[]'::jsonb)->'entry'->>'id'),
 'c8100000-0000-4000-8000-000000000001',
 'an exact retry replays after a newer publication is committed');

select throws_ok($select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000003','c7600000-0000-4000-8000-000000000004',
 'c7500000-0000-4000-8000-000000000002','c7900000-0000-4000-8000-000000000005',
 'quick',20,'[]'::jsonb)$$,'22023',null,'time-based exercises reject kilogram entries');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000004','c7600000-0000-4000-8000-000000000001',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000001',
 'quick',20,'[]'::jsonb)$$,'42501',null,'a superseded publication cannot receive a new entry');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000005','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick',2000.01,'[]'::jsonb)$$,'22023',null,'weights above 2000 kg are rejected');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000006','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'sets',null,'[{"reps":0,"weight_kg":70}]'::jsonb)$$,'22023',null,'invalid set repetitions are rejected');

select set_config('request.jwt.claim.sub','c7100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c7100000-0000-4000-8000-000000000002','role','authenticated','session_id','c7200000-0000-4000-8000-000000000002')::text,true);
select is((public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000007','c7600000-0000-4000-8000-000000000003',
 'c7500000-0000-4000-8000-000000000003',null,
 'quick',45,'[]'::jsonb)->'entry'->>'exercise_id'),
 'c7500000-0000-4000-8000-000000000003',
 'text-routine UUID mentions support student workout logging');
select throws_ok($$select public.cueva_workout_record(
 'c8100000-0000-4000-8000-000000000008','c7600000-0000-4000-8000-000000000002',
 'c7500000-0000-4000-8000-000000000001','c7900000-0000-4000-8000-000000000002',
 'quick',45,'[]'::jsonb)$$,'42501',null,'a student cannot write another students workout');
select is(public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')->>'last_weight_kg',null,
 'history is isolated by authenticated student');
select is((public.cueva_workout_history('c7500000-0000-4000-8000-000000000003')->>'last_weight_kg')::numeric,45,
 'text exercise history is keyed by UUID for its owner');

reset role;
set local role anon;
select throws_ok($$select public.cueva_workout_history('c7500000-0000-4000-8000-000000000001')$$,'42501',null,
 'anonymous users cannot query workout history');
reset role;

select * from finish();
rollback;
