begin;
select plan(18);

-- These synthetic Auth users and sessions exist only inside this rollback.
insert into auth.users
 (id,aud,role,email,created_at,updated_at,confirmation_sent_at,email_confirmed_at,raw_user_meta_data)
values
 ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','new-self@example.test',
  now()-interval '10 minutes',now(),now()-interval '8 minutes',now()-interval '5 minutes',
  '{"first_name":"Ana","last_name":"Prueba","full_name":"Ana Prueba"}'::jsonb),
 ('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','unverified-self@example.test',
  now()-interval '10 minutes',now(),now()-interval '8 minutes',null,
  '{"first_name":"Sin","last_name":"Validar"}'::jsonb),
 ('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','manual-self@example.test',
  now()-interval '10 minutes',now(),now()-interval '8 minutes',now()-interval '5 minutes',
  '{"first_name":"Ya","last_name":"Existe"}'::jsonb),
 ('d1000000-0000-4000-8000-000000000004','authenticated','authenticated','no-confirm-self@example.test',
  now()-interval '10 minutes',now(),null,now()-interval '5 minutes',
  '{"first_name":"Auto","last_name":"Confirmada"}'::jsonb),
 ('d1000000-0000-4000-8000-000000000005','authenticated','authenticated','admin-self@example.test',
  now()-interval '10 minutes',now(),now()-interval '8 minutes',now()-interval '5 minutes',
  '{"first_name":"Admin","last_name":"Real"}'::jsonb);

insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',now()-interval '1 minute',now()),
 ('d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002',now()-interval '1 minute',now()),
 ('d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003',now()-interval '1 minute',now()),
 ('d2000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004',now()-interval '1 minute',now()),
 ('d2000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000005',now()-interval '1 minute',now());

insert into public.cueva_students
 (id,first_name,last_name,email,joined_on,active) values
 ('d3000000-0000-4000-8000-000000000001','Existente','Reservada','manual-self@example.test',date '2026-09-01',true);

insert into cueva_private.access_state(user_id,ready,session_not_before)
 values ('d1000000-0000-4000-8000-000000000005',true,now()-interval '10 minutes');
insert into public.cueva_profiles(user_id,role)
 values ('d1000000-0000-4000-8000-000000000005','admin');

select ok(has_function_privilege('authenticated','public.cueva_complete_self_registration()','EXECUTE'),
 'verified authenticated users can invoke the enrollment function');
select ok(not has_function_privilege('anon','public.cueva_complete_self_registration()','EXECUTE'),
 'anonymous users cannot invoke self registration');
select ok(not exists(
 select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) permission
 where p.oid='public.cueva_complete_self_registration()'::regprocedure
   and permission.grantee=0 and permission.privilege_type='EXECUTE'),
 'PUBLIC cannot invoke the privileged enrollment function');

select set_config('request.jwt.claims',
 jsonb_build_object('sub','d1000000-0000-4000-8000-000000000002',
 'role','authenticated','session_id','d2000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;
select is(public.cueva_complete_self_registration(),'unverified','no email confirmation means no enrollment');
reset role;

select set_config('request.jwt.claims',
 jsonb_build_object('sub','d1000000-0000-4000-8000-000000000004',
 'role','authenticated','session_id','d2000000-0000-4000-8000-000000000004')::text,true);
set local role authenticated;
select is(public.cueva_complete_self_registration(),'unverified','auto-confirm without any confirmation mail is rejected');
reset role;

select set_config('request.jwt.claims',
 jsonb_build_object('sub','d1000000-0000-4000-8000-000000000003',
 'role','authenticated','session_id','d2000000-0000-4000-8000-000000000003')::text,true);
set local role authenticated;
select is(public.cueva_complete_self_registration(),'needs_review','verified email cannot claim existing administrative student file');
reset role;
select is((select count(*)::integer from public.cueva_student_invitations where student_id='d3000000-0000-4000-8000-000000000001'),0,
 'existing student remains unlinked');

select set_config('request.jwt.claims',
 jsonb_build_object('sub','d1000000-0000-4000-8000-000000000005',
 'role','authenticated','session_id','d2000000-0000-4000-8000-000000000005')::text,true);
set local role authenticated;
select is(public.cueva_complete_self_registration(),'existing','administrator can never be converted into a student');
reset role;
select is((select role from public.cueva_profiles where user_id='d1000000-0000-4000-8000-000000000005'),'admin',
 'administrator role remains unchanged');

select set_config('request.jwt.claims',
 jsonb_build_object('sub','d1000000-0000-4000-8000-000000000001',
 'role','authenticated','session_id','d2000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;
select is(public.cueva_complete_self_registration(),'created','verified new identity is enrolled');
select is((select role from public.cueva_profiles),'alumno',
 'self registered user sees their own student role through the existing gate');
select is((select count(*)::integer from public.cueva_students),0,
 'new user still cannot read student records directly');
select is(public.cueva_complete_self_registration(),'existing',
 'repeating enrollment never duplicates accounts');
reset role;

select is((select count(*)::integer from public.cueva_students where email='new-self@example.test'),1,
 'exactly one private student record is created');
select ok(not (select active from public.cueva_students where email='new-self@example.test'),
 'new membership stays inactive until administrative validation');
select is((select state from public.cueva_student_invitations where user_id='d1000000-0000-4000-8000-000000000001'),'self_registered',
 'self-registration has a distinct state, not a forged admin invitation');
select is((select email from public.cueva_students where id=(
 select student_id from public.cueva_student_invitations where user_id='d1000000-0000-4000-8000-000000000001')),'new-self@example.test',
 'UUID ownership points only to the newly created student');

select * from finish();
rollback;
