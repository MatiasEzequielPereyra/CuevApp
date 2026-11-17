begin;
select plan(37);

-- Stable test identities and sessions. All fixtures are rolled back at the end.
insert into auth.users(id,aud,role,email,created_at,updated_at) values
 ('b1000000-0000-4000-8000-000000000001','authenticated','authenticated','routine-admin@example.test',now(),now()),
 ('b1000000-0000-4000-8000-000000000002','authenticated','authenticated','routine-student-a@example.test',now(),now()),
 ('b1000000-0000-4000-8000-000000000003','authenticated','authenticated','routine-student-b@example.test',now(),now()),
 ('b1000000-0000-4000-8000-000000000004','authenticated','authenticated','routine-no-profile@example.test',now(),now());

insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',now(),now()),
 ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',now(),now()),
 ('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003',now(),now()),
 ('b2000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000004',now(),now());

insert into cueva_private.access_state(user_id,ready,session_not_before) values
 ('b1000000-0000-4000-8000-000000000001',true,now()-interval '1 minute'),
 ('b1000000-0000-4000-8000-000000000002',true,now()-interval '1 minute'),
 ('b1000000-0000-4000-8000-000000000003',true,now()-interval '1 minute'),
 ('b1000000-0000-4000-8000-000000000004',true,now()-interval '1 minute');

insert into public.cueva_profiles(user_id,role) values
 ('b1000000-0000-4000-8000-000000000001','admin'),
 ('b1000000-0000-4000-8000-000000000002','alumno'),
 ('b1000000-0000-4000-8000-000000000003','alumno');

insert into public.cueva_students(id,first_name,last_name,email,joined_on) values
 ('b3000000-0000-4000-8000-000000000001','Student','A','routine-student-a@example.test',date '2026-01-01'),
 ('b3000000-0000-4000-8000-000000000002','Student','B','routine-student-b@example.test',date '2026-01-01'),
 ('b3000000-0000-4000-8000-000000000003','Student','C','routine-student-c@example.test',date '2026-01-01');

insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values
 ('b3000000-0000-4000-8000-000000000001','routine-student-a@example.test','b1000000-0000-4000-8000-000000000002','sent','b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000002','routine-student-b@example.test','b1000000-0000-4000-8000-000000000003','sent','b4000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001');

insert into public.cueva_exercises(id,name,revision,updated_by,description,video_url,active) values
 ('b5000000-0000-4000-8000-000000000001','Press banca',1,'b1000000-0000-4000-8000-000000000001','Ejercicio vigente','https://youtu.be/abcdefghijk',true),
 ('b5000000-0000-4000-8000-000000000002','Sentadilla',1,'b1000000-0000-4000-8000-000000000001','Segundo ejercicio vigente',null,true),
 ('b5000000-0000-4000-8000-000000000003','Ejercicio anterior',1,'b1000000-0000-4000-8000-000000000001','Solo en publicación vieja',null,true),
 ('b5000000-0000-4000-8000-000000000004','Ejercicio de B',1,'b1000000-0000-4000-8000-000000000001','Asignado a otro alumno',null,true),
 ('b5000000-0000-4000-8000-000000000005','Catálogo sin asignar',1,'b1000000-0000-4000-8000-000000000001','No debe aparecer',null,false);

-- A has an older publication and a newer one. The latest plan deliberately
-- repeats Press banca in two blocks to assert the RPC returns distinct exercises.
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by,plan) values
 ('b6000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',1,'Publicación anterior','b1000000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"b7000000-0000-4000-8000-000000000001","name":"Día viejo","blocks":[{"id":"b8000000-0000-4000-8000-000000000001","name":"Bloque viejo","rounds":3,"exercises":[{"id":"b9000000-0000-4000-8000-000000000001","exercise_id":"b5000000-0000-4000-8000-000000000003","name":"Ejercicio anterior","note":""}]}]}]}'::jsonb),
 ('b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',2,'Publicación actual','b1000000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"b7000000-0000-4000-8000-000000000002","name":"Día actual","blocks":[{"id":"b8000000-0000-4000-8000-000000000002","name":"Bloque uno","rounds":3,"exercises":[{"id":"b9000000-0000-4000-8000-000000000002","exercise_id":"b5000000-0000-4000-8000-000000000001","name":"Press banca","note":""},{"id":"b9000000-0000-4000-8000-000000000003","exercise_id":"b5000000-0000-4000-8000-000000000002","name":"Sentadilla","note":""}]},{"id":"b8000000-0000-4000-8000-000000000003","name":"Bloque dos","rounds":2,"exercises":[{"id":"b9000000-0000-4000-8000-000000000004","exercise_id":"b5000000-0000-4000-8000-000000000001","name":"Press banca","note":""}]}]}]}'::jsonb),
 ('b6000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002',1,'Rutina de B','b1000000-0000-4000-8000-000000000001',
  '{"version":2,"days":[{"id":"b7000000-0000-4000-8000-000000000003","name":"Día B","blocks":[{"id":"b8000000-0000-4000-8000-000000000004","name":"Bloque B","rounds":3,"exercises":[{"id":"b9000000-0000-4000-8000-000000000005","exercise_id":"b5000000-0000-4000-8000-000000000004","name":"Ejercicio de B","note":""}]}]}]}'::jsonb);

insert into public.cueva_routine_text_publications(
 publication_id,student_id,format,text_content,block_content,mentions,published_by
) values
 ('b6000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','text','Ejercicio anterior','',
  '[{"exercise_id":"b5000000-0000-4000-8000-000000000003","start":0,"end":18,"text":"Ejercicio anterior"}]'::jsonb,
  'b1000000-0000-4000-8000-000000000001'),
 ('b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','text','Ejercicio extra: Catálogo sin asignar','',
  '[{"exercise_id":"b5000000-0000-4000-8000-000000000005","start":17,"end":37,"text":"Catálogo sin asignar"}]'::jsonb,
  'b1000000-0000-4000-8000-000000000001'),
 ('b6000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002','text','Ejercicio de B','',
  '[{"exercise_id":"b5000000-0000-4000-8000-000000000004","start":0,"end":14,"text":"Ejercicio de B"}]'::jsonb,
  'b1000000-0000-4000-8000-000000000001');

select ok(has_function_privilege('authenticated','public.cueva_student_assigned_exercises()','EXECUTE'),
 'authenticated can call the public assigned-exercises RPC');
select ok(not has_function_privilege('anon','public.cueva_student_assigned_exercises()','EXECUTE'),
 'anonymous users cannot call the assigned-exercises RPC');
select ok(not exists(
 select 1
 from pg_proc p
 cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
 where p.oid='public.cueva_student_assigned_exercises()'::regprocedure
   and privilege.grantee=0 and privilege.privilege_type='EXECUTE'),
 'PUBLIC has no execute grant on the assigned-exercises RPC');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000002','role','authenticated','session_id','b2000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;

select is((select count(*)::integer from public.cueva_student_mentioned_exercises()),1,
 'student A receives only the exercise mentioned in their latest text publication');
select ok(exists(select 1 from public.cueva_student_mentioned_exercises()
 where id='b5000000-0000-4000-8000-000000000005' and name='Catálogo sin asignar'),
 'a text mention resolves its exercise without creating a block assignment');
select ok(not exists(select 1 from public.cueva_student_mentioned_exercises()
 where id in ('b5000000-0000-4000-8000-000000000003','b5000000-0000-4000-8000-000000000004')),
 'older and other-student mentions are excluded');
select is((select count(*)::integer from public.cueva_routine_text_publications),1,
 'student A can read only their latest text publication');
select is((select count(*)::integer from public.cueva_student_assigned_exercises()),2,
 'student A receives only the two distinct exercises in the latest publication');
select ok(exists(select 1 from public.cueva_student_assigned_exercises() where id='b5000000-0000-4000-8000-000000000001' and name='Press banca' and description='Ejercicio vigente' and has_video),
 'assigned exercise details and video availability are returned');
select ok(exists(select 1 from public.cueva_student_assigned_exercises() where id='b5000000-0000-4000-8000-000000000002' and not has_video),
 'assigned exercise without a video is still returned');
select ok(not exists(select 1 from public.cueva_student_assigned_exercises() where id in (
 'b5000000-0000-4000-8000-000000000003','b5000000-0000-4000-8000-000000000004','b5000000-0000-4000-8000-000000000005')),
 'older, other-student and unassigned catalogue exercises are excluded');
select is((select count(*)::integer from public.cueva_exercises),0,
 'students cannot read the general exercise catalogue directly');

-- A second authenticated student can see only their own assigned routine.
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000003','role','authenticated','session_id','b2000000-0000-4000-8000-000000000003')::text,true);
select is((select count(*)::integer from public.cueva_student_mentioned_exercises()),1,
 'student B receives only their own mentioned exercise');
select is((select count(*)::integer from public.cueva_student_assigned_exercises()),1,
 'student B receives only their own assigned exercise');
select ok(exists(select 1 from public.cueva_student_assigned_exercises() where id='b5000000-0000-4000-8000-000000000004'),
 'student B receives their own exercise');
select ok(not exists(select 1 from public.cueva_student_assigned_exercises() where id in (
 'b5000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000002')),
 'student B cannot obtain student A exercises');

-- An authenticated administrator has no student-owner binding and gets no rows.
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000001','role','authenticated','session_id','b2000000-0000-4000-8000-000000000001')::text,true);
select is((select count(*)::integer from public.cueva_student_mentioned_exercises()),0,
 'administrator cannot use the mention RPC to read a student document');
select is((public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',0,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000001',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)->>'revision')::integer,1,'text routine and UUID mention save as one version');

select is((public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',0,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000001',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)->>'revision')::integer,1,'exact retries return the same text revision');

-- Publication snapshots are committed atomically with their text document.
-- Student C has no pre-existing publication, so the test exercises the first
-- publish and its idempotent retry without relying on seeded historical rows.
select is((public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000003',0,'Bloque inicial',null,
 'ba000000-0000-4000-8000-000000000010',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)->>'revision')::integer,1,'publication fixture saves its initial text draft');

select throws_ok($$$select public.cueva_routine_text_write(
 'publish','b3000000-0000-4000-8000-000000000003',1,'Bloque alterado',null,
 'ba000000-0000-4000-8000-000000000011',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)$$,'40001',null,'a text-document mismatch aborts publication');

select is((select count(*)::integer from public.cueva_routine_publications
 where student_id='b3000000-0000-4000-8000-000000000003'),0,
 'a failed text snapshot leaves no base publication behind');

select is((public.cueva_routine_text_write(
 'publish','b3000000-0000-4000-8000-000000000003',1,'Bloque inicial',null,
 'ba000000-0000-4000-8000-000000000012',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)->>'draft_revision')::integer,1,'publication commits the expected draft revision');

select is((public.cueva_routine_text_write(
 'publish','b3000000-0000-4000-8000-000000000003',1,'Bloque inicial',null,
 'ba000000-0000-4000-8000-000000000012',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)->>'draft_revision')::integer,1,'retry after a lost publish response returns the committed snapshot');

select throws_ok($$$select public.cueva_routine_text_write(
 'publish','b3000000-0000-4000-8000-000000000003',1,'Otro bloque',null,
 'ba000000-0000-4000-8000-000000000012',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":11,"text":"Press banca"}]'::jsonb
)$$,'22023',null,'a publication operation ID cannot be replayed with altered snapshot data');

select is((select count(*)::integer from public.cueva_routine_publications p
 join public.cueva_routine_text_publications t on t.publication_id=p.id
 where p.student_id='b3000000-0000-4000-8000-000000000003'),1,
 'one atomic base publication and text snapshot remain after retries');

select throws_ok($$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',0,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000001',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000002","start":0,"end":11,"text":"Press banca"}]'::jsonb
)$$,'40001',null,'a reused save ID cannot replace mention UUIDs');

-- A template may preserve an inactive historical reference, but it must
-- not authorize introducing that exercise into an unrelated student draft.
reset role;
insert into public.cueva_routine_text_drafts(
 kind,owner_id,revision,format,text_content,block_content,mentions,save_id,updated_by
) values (
 'template','ba100000-0000-4000-8000-000000000001',1,'text','Catálogo sin asignar','',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000005","start":0,"end":20,"text":"Catálogo sin asignar"}]'::jsonb,
 'ba200000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select throws_ok($$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',1,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000006',null,'text','Catálogo sin asignar',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000005","start":0,"end":20,"text":"Catálogo sin asignar"}]'::jsonb
)$$,'22023',null,'a new mention of an inactive exercise is rejected');

select throws_ok($$$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',1,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000007',null,'text','Catálogo sin asignar',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000005","start":0,"end":20,"text":"Catálogo sin asignar"}]'::jsonb
)$$,'22023',null,'an inactive reference in any template cannot authorize a new mention in another draft');

select throws_ok($$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',1,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000003',null,'text','Press banca',
 '[{"exercise_id":"not-a-uuid","start":0,"end":11,"text":"Press banca"}]'::jsonb
)$$,'22023',null,'invalid exercise UUIDs are rejected by the database');

select throws_ok($$$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',1,'Notas de bloque',null,
 'ba000000-0000-4000-8000-000000000002',null,'text','Press banca',
 '[{"exercise_id":"b5000000-0000-4000-8000-000000000001","start":0,"end":99,"text":"Press banca"}]'::jsonb
)$$,'22023',null,'invalid mention offsets are rejected in the database');


select is((select count(*)::integer from public.cueva_student_assigned_exercises()),0,
 'administrator cannot use the student RPC to read exercise assignments');

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000003','role','authenticated','session_id','b2000000-0000-4000-8000-000000000003')::text,true);
select throws_ok($$$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',0,'',null,
 'ba000000-0000-4000-8000-000000000004',null,'blocks','', '[]'::jsonb
 )$$,'42501',null,'an authenticated student cannot write routine text');

-- A valid session without a cueva_profiles role is also denied by the owner check.
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000004','role','authenticated','session_id','b2000000-0000-4000-8000-000000000004')::text,true);
select is((select count(*)::integer from public.cueva_student_assigned_exercises()),0,
 'authenticated account without an alumno profile receives no exercises');

reset role;
set local role anon;
select throws_ok($$$select * from public.cueva_student_assigned_exercises()$$,'42501',null,
 'anonymous execution is rejected by database privileges');
select throws_ok($$$select * from public.cueva_student_mentioned_exercises()$$,'42501',null,
 'anonymous mention lookup is rejected by database privileges');
select throws_ok($$$select public.cueva_routine_text_write(
 'draft','b3000000-0000-4000-8000-000000000001',0,'',null,
 'ba000000-0000-4000-8000-000000000005',null,'blocks','', '[]'::jsonb
 )$$,'42501',null,'anonymous routine text writes are rejected by database privileges');
reset role;

select * from finish();
rollback;
