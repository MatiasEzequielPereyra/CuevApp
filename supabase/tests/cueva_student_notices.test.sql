begin;
select no_plan();

insert into auth.users(id,email) select
  ('aa100000-0000-4000-8000-00000000000'||i)::uuid, 'notice-'||i||'@example.test' from generate_series(1,4) i;
insert into auth.sessions(id,user_id,created_at) select
  ('aa200000-0000-4000-8000-00000000000'||i)::uuid,
  ('aa100000-0000-4000-8000-00000000000'||i)::uuid, now() from generate_series(1,4) i;
insert into cueva_private.access_state(user_id,ready,session_not_before) select
  ('aa100000-0000-4000-8000-00000000000'||i)::uuid, i<>4, now()-interval '1 minute' from generate_series(1,4) i;
insert into public.cueva_profiles(user_id,role) select
  ('aa100000-0000-4000-8000-00000000000'||i)::uuid, case when i=1 then 'admin' else 'alumno' end from generate_series(1,4) i;
insert into public.cueva_students(id,first_name,last_name,email,joined_on) select
  ('aa300000-0000-4000-8000-00000000000'||i)::uuid, 'Prueba','Avisos','notice-'||i||'@example.test',current_date from generate_series(2,4) i;
insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) select
  ('aa300000-0000-4000-8000-00000000000'||i)::uuid, 'notice-'||i||'@example.test',
  ('aa100000-0000-4000-8000-00000000000'||i)::uuid,case when i=3 then 'self_registered' else 'sent' end,
  gen_random_uuid(),'aa100000-0000-4000-8000-000000000001' from generate_series(2,4) i;
insert into public.cueva_push_subscriptions(id,student_id,endpoint,p256dh,auth_secret) select
  ('aa400000-0000-4000-8000-00000000000'||i)::uuid,('aa300000-0000-4000-8000-00000000000'||i)::uuid,
  'https://fcm.googleapis.com/fcm/send/synthetic-'||i,repeat('a',65),repeat('b',22) from generate_series(2,4) i;
update public.cueva_notification_preferences set push_enabled=false where student_id='aa300000-0000-4000-8000-000000000003';

select ok(not has_function_privilege('anon','public.cueva_send_student_broadcast(uuid,text,text)','execute'),'visitor cannot broadcast');
select ok(not has_function_privilege('authenticated','public.cueva_claim_student_notice_push()','execute'),'authenticated accounts cannot claim device secrets');
select ok(not has_table_privilege('authenticated','cueva_private.student_notice_push','select'),'outbox is private');

insert into public.cueva_routine_drafts(student_id,revision,content,updated_by,save_id) values
 ('aa300000-0000-4000-8000-000000000002',1,'Borrador','aa100000-0000-4000-8000-000000000001',gen_random_uuid());
select is((select count(*) from cueva_private.student_notices),0::bigint,'a draft does not send anything');
insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by) values
 ('aa500000-0000-4000-8000-000000000002','aa300000-0000-4000-8000-000000000002',1,'Rutina nueva','aa100000-0000-4000-8000-000000000001');
select is((select array_agg(user_id::text) from public.cueva_notification_inbox where student_notice_id is not null),
 array['aa100000-0000-4000-8000-000000000002'],'publication reaches only its own student');
select is((select count(*) from cueva_private.student_notice_push),1::bigint,'one device queued for the publication');

set local role authenticated;
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"aa100000-0000-4000-8000-000000000002","session_id":"aa200000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select public.cueva_send_student_broadcast('aa600000-0000-4000-8000-000000000001','Título','Texto')$$,
 '42501','Acceso restringido','student cannot broadcast even with a valid session');
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"aa100000-0000-4000-8000-000000000001","session_id":"aa200000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select public.cueva_send_student_broadcast('aa600000-0000-4000-8000-000000000001','Título',chr(9))$$,
 '22023','Comunicado inválido','direct calls cannot broadcast whitespace-only content');
select is(public.cueva_send_student_broadcast('aa600000-0000-4000-8000-000000000001','Título','Texto'),
 '{"recipients":2,"devices":1}'::jsonb,'broadcast includes invited and self-registered, excludes pending, honors opt-out');
select is(public.cueva_send_student_broadcast('aa600000-0000-4000-8000-000000000001','Título','Texto'),
 '{"recipients":2,"devices":1}'::jsonb,'replay returns same counts');
select throws_ok($$select public.cueva_send_student_broadcast('aa600000-0000-4000-8000-000000000001','Título nuevo','Texto')$$,
 '23505','Identificador de comunicado en uso','same key cannot change message');
select set_config('request.jwt.claim.sub','aa100000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"aa100000-0000-4000-8000-000000000003","session_id":"aa200000-0000-4000-8000-000000000003"}',true);
select is((select array_agg(title) from public.cueva_notification_inbox where student_notice_id is not null),
 array['Título'],'RLS hides the other student routine and keeps the broadcast visible');
reset role;

create temporary table claimed_notice as select * from public.cueva_claim_student_notice_push();
select is((select count(*) from claimed_notice),2::bigint,'claim gets one routine and one broadcast, once each');
select is((select count(*) from public.cueva_claim_student_notice_push()),0::bigint,'a repeated claim does not return reserved jobs');
select is((select count(*) from claimed_notice where routine),1::bigint,'claim distinguishes routine and broadcast');
select ok((select not public.cueva_finish_student_notice_push(job_id,gen_random_uuid(),'accepted') from claimed_notice where routine),
 'a different lease cannot finalize the job');
select ok((select public.cueva_finish_student_notice_push(job_id,job_lease,'rate_limited') from claimed_notice where routine),
 'explicit rate limit is recorded');
select is((select status from cueva_private.student_notice_push j join claimed_notice c on c.job_id=j.id where c.routine),
 'pending','rate limit schedules a bounded retry');
update cueva_private.student_notice_push j set lease_until=now()-interval '1 second' from claimed_notice c where c.job_id=j.id and not c.routine;
update public.cueva_notification_preferences set push_enabled=false where student_id='aa300000-0000-4000-8000-000000000002';
select is((select count(*) from public.cueva_claim_student_notice_push()),0::bigint,'expired lease and opt-out produce no more sends');
select is((select status from cueva_private.student_notice_push where notice_id='aa600000-0000-4000-8000-000000000001'),
 'unknown','interrupted external outcome is never retried');
select is((select count(*) from cueva_private.student_notice_push where status='cancelled'),1::bigint,'later opt-out cancels the pending push');
select is((select count(*) from public.cueva_notification_inbox where student_notice_id='aa600000-0000-4000-8000-000000000001'),
 2::bigint,'idempotency and opt-out preserve inbox copies');

update public.cueva_notification_preferences set push_enabled=true where student_id='aa300000-0000-4000-8000-000000000002';
insert into public.cueva_push_subscriptions(student_id,endpoint,p256dh,auth_secret)
select 'aa300000-0000-4000-8000-000000000002','https://fcm.googleapis.com/fcm/send/cap-'||i,repeat('a',65),repeat('b',22)
from generate_series(1,9) i;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is((select outcome from public.cueva_register_push_subscription('aa300000-0000-4000-8000-000000000002',
 'https://fcm.googleapis.com/fcm/send/replacement',repeat('a',65),repeat('b',22),null)),
 'limit_reached','ten devices fill the real registration cap');

insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by) values
 ('aa500000-0000-4000-8000-000000000003','aa300000-0000-4000-8000-000000000002',2,'Rutina para comprobar vencimientos','aa100000-0000-4000-8000-000000000001');
create temporary table expiration_claims as select * from public.cueva_claim_student_notice_push();
select is((select count(*) from expiration_claims),10::bigint,'all ten devices without an expiry date were initially eligible');
select ok((select not public.cueva_finish_student_notice_push(job_id,gen_random_uuid(),'expired') from expiration_claims where endpoint like '%/synthetic-2'),
 'a wrong lease cannot finalize an expired response');
select ok((select revoked_at is null from public.cueva_push_subscriptions where endpoint like '%/synthetic-2'),
 'a wrong lease leaves the subscription active');

update cueva_private.student_notice_push j set lease_until=clock_timestamp()-interval '1 second'
from expiration_claims c where c.job_id=j.id and c.endpoint like '%/cap-2';
select ok((select not public.cueva_finish_student_notice_push(job_id,job_lease,'expired') from expiration_claims where endpoint like '%/cap-2'),
 'an expired lease cannot finalize an expired response');
select ok((select revoked_at is null from public.cueva_push_subscriptions where endpoint like '%/cap-2'),
 'an expired lease leaves the subscription active');

-- The real registration path refreshes an existing endpoint even with identical keys.
select is((select outcome from public.cueva_register_push_subscription('aa300000-0000-4000-8000-000000000002',
 'https://fcm.googleapis.com/fcm/send/cap-1',repeat('a',65),repeat('b',22),null)),
 'updated','re-registering the same endpoint renews its version');
select ok((select public.cueva_finish_student_notice_push(job_id,job_lease,'expired') from expiration_claims where endpoint like '%/cap-1'),
 'the old delivery result is still recorded after renewal');
select ok((select revoked_at is null from public.cueva_push_subscriptions where endpoint like '%/cap-1'),
 'the old response cannot revoke the renewed subscription');
select ok((select not public.cueva_finish_student_notice_push(job_id,job_lease,'expired') from expiration_claims where endpoint like '%/cap-1'),
 'a consumed lease cannot finalize again');
select ok((select revoked_at is null from public.cueva_push_subscriptions where endpoint like '%/cap-1'),
 'a replay cannot revoke the renewed subscription');

select ok((select public.cueva_finish_student_notice_push(job_id,job_lease,'expired') from expiration_claims where endpoint like '%/synthetic-2'),
 'a valid lease records confirmed device expiration');
select ok((select revoked_at is not null from public.cueva_push_subscriptions where endpoint like '%/synthetic-2'),
 'the expired version is revoked even without an expiration date');
select is((select j.status from cueva_private.student_notice_push j join expiration_claims c on c.job_id=j.id where c.endpoint like '%/synthetic-2'),
 'expired','revocation preserves the expired delivery history');

insert into public.cueva_routine_publications(id,student_id,draft_revision,content,published_by) values
 ('aa500000-0000-4000-8000-000000000004','aa300000-0000-4000-8000-000000000002',3,'Rutina posterior','aa100000-0000-4000-8000-000000000001');
select is((select count(*) from cueva_private.student_notice_push j join cueva_private.student_notices n on n.id=j.notice_id
 join public.cueva_push_subscriptions s on s.id=j.subscription_id
 where n.publication_id='aa500000-0000-4000-8000-000000000004' and s.endpoint like '%/synthetic-2'),
 0::bigint,'the next notice does not queue the revoked endpoint');
select is((select outcome from public.cueva_register_push_subscription('aa300000-0000-4000-8000-000000000002',
 'https://fcm.googleapis.com/fcm/send/replacement',repeat('a',65),repeat('b',22),null)),
 'registered','the replacement device uses the released slot');
select * from finish();
rollback;
