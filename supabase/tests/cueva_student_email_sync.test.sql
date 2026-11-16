begin;
select plan(8);

insert into auth.users(id,aud,role,email,created_at,updated_at) values
 ('c1000000-0000-4000-8000-000000000001','authenticated','authenticated','email-admin@example.test',now(),now()),
 ('c1000000-0000-4000-8000-000000000002','authenticated','authenticated','email-student@example.test',now(),now());

insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001',now(),now()),
 ('c2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002',now(),now());

insert into cueva_private.access_state(user_id,ready,session_not_before) values
 ('c1000000-0000-4000-8000-000000000001',true,now()-interval '1 minute'),
 ('c1000000-0000-4000-8000-000000000002',true,now()-interval '1 minute');

insert into public.cueva_profiles(user_id,role) values
 ('c1000000-0000-4000-8000-000000000001','admin'),
 ('c1000000-0000-4000-8000-000000000002','alumno');

insert into public.cueva_students(id,first_name,last_name,email,joined_on) values
 ('c3000000-0000-4000-8000-000000000001','Alumno','Prueba','email-student@example.test',date '2026-01-01');

insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values
 ('c3000000-0000-4000-8000-000000000001','email-student@example.test','c1000000-0000-4000-8000-000000000002','sent','c4000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001');

select ok(not has_function_privilege('authenticated','cueva_private.sync_student_email_after_auth_change()','EXECUTE'),
 'authenticated users cannot execute the internal Auth synchronization function');
select ok(exists(select 1 from pg_trigger where tgname='cueva_sync_student_email_after_auth_change' and not tgisinternal),
 'the synchronization is attached to Auth email changes');

-- Simulate the final Auth confirmation: the email column changes only now.
update auth.users set email='alumno.nuevo@example.test',updated_at=now()
 where id='c1000000-0000-4000-8000-000000000002';

select is((select email from public.cueva_students where id='c3000000-0000-4000-8000-000000000001'),
 'alumno.nuevo@example.test','the student record changes only after Auth commits the new email');
select is((select email from public.cueva_student_invitations where student_id='c3000000-0000-4000-8000-000000000001'),
 'alumno.nuevo@example.test','the invitation record stays synchronized with Auth');
select ok(current_setting('cueva.syncing_student_email',true) is distinct from 'on',
 'the internal synchronization flag is restored after the update');

-- Ordinary administrative edits remain blocked once an invitation is bound.
select set_config('request.jwt.claim.sub','c1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','c1000000-0000-4000-8000-000000000001','role','authenticated','session_id','c2000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;
select throws_ok($$update public.cueva_students set email='manual@example.test' where id='c3000000-0000-4000-8000-000000000001'$$,
 'P0001','La ficha tiene una invitación registrada. El cambio de correo requiere reconciliación administrativa.',
 'an administrator cannot bypass the verified Auth email-change flow');
reset role;

-- Auth email changes for accounts without a student mapping do not alter student records.
update auth.users set email='email-admin-renamed@example.test',updated_at=now()
 where id='c1000000-0000-4000-8000-000000000001';
select is((select email from public.cueva_students where id='c3000000-0000-4000-8000-000000000001'),
 'alumno.nuevo@example.test','unmapped Auth accounts do not affect student email records');

select * from finish();
rollback;
