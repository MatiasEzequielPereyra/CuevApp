begin;
select plan(56);

-- Isolated fixtures: two students, two linked identities, one administrator.
insert into auth.users(id,aud,role,email,created_at,updated_at)
values
 ('b1000000-0000-4000-8000-000000000001','authenticated','authenticated','notifications-admin@example.test',now(),now()),
 ('b1000000-0000-4000-8000-000000000002','authenticated','authenticated','notifications-student-one@example.test',now(),now()),
 ('b1000000-0000-4000-8000-000000000003','authenticated','authenticated','notifications-student-two@example.test',now(),now());

insert into auth.sessions(id,user_id,created_at,updated_at)
values
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',now(),now()),
 ('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',now(),now()),
 ('b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003',now(),now());

insert into cueva_private.access_state(user_id,ready,session_not_before)
values
 ('b1000000-0000-4000-8000-000000000001',true,now()-interval '1 minute'),
 ('b1000000-0000-4000-8000-000000000002',true,now()-interval '1 minute'),
 ('b1000000-0000-4000-8000-000000000003',true,now()-interval '1 minute');

insert into public.cueva_profiles(user_id,role)
values
 ('b1000000-0000-4000-8000-000000000001','admin'),
 ('b1000000-0000-4000-8000-000000000002','alumno'),
 ('b1000000-0000-4000-8000-000000000003','alumno');

insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values
 ('b3000000-0000-4000-8000-000000000001','Student','One','notifications-student-one@example.test',date '2026-01-01'),
 ('b3000000-0000-4000-8000-000000000002','Student','Two','notifications-student-two@example.test',date '2026-01-02');

insert into public.cueva_student_invitations(
 student_id,email,user_id,state,lease,requested_by
) values
 ('b3000000-0000-4000-8000-000000000001','notifications-student-one@example.test','b1000000-0000-4000-8000-000000000002','sent','b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000002','notifications-student-two@example.test','b1000000-0000-4000-8000-000000000003','sent','b4000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001');

insert into public.cueva_prices(id,effective_month,cents,actor)
values ('b5000000-0000-4000-8000-000000000001',date '2026-11-01',10000,'b1000000-0000-4000-8000-000000000001');

insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor)
values
 ('b6000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',date '2026-11-01',date '2026-11-20',10000,'b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001'),
 ('b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002',date '2026-11-01',date '2026-11-21',12000,'b5000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001');

insert into public.cueva_payments(id,period_id,cents,paid_on,method,actor)
values ('b7000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',2500,date '2026-11-10','transferencia','b1000000-0000-4000-8000-000000000001');

insert into public.cueva_notifications(id,period_id,reminder_days,due_on,scheduled_at)
values
 ('b8000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',5,date '2026-11-20',timestamptz '2026-11-15 12:00:00-03'),
 ('b8000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002',5,date '2026-11-21',timestamptz '2026-11-16 12:00:00-03');

insert into public.cueva_notification_deliveries(
 id,notification_id,channel,status,attempt_count,next_attempt_at,last_attempt_at,lease_token,lease_expires_at
) values
 ('b9000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000001','internal','pending',0,timestamptz '2026-11-15 12:00:00-03',null,null,null),
 ('b9000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000001','push','pending',1,timestamptz '2026-11-15 12:15:00-03',timestamptz '2026-11-15 12:00:00-03',null,null),
 ('b9000000-0000-4000-8000-000000000003','b8000000-0000-4000-8000-000000000002','internal','pending',0,timestamptz '2026-11-16 12:00:00-03',null,null,null),
 ('b9000000-0000-4000-8000-000000000004','b8000000-0000-4000-8000-000000000002','email','pending',0,timestamptz '2026-11-16 12:00:00-03',null,null,null),
 ('b9000000-0000-4000-8000-000000000005','b8000000-0000-4000-8000-000000000002','email','processing',1,timestamptz '2026-11-16 12:00:00-03',clock_timestamp()-interval '10 minutes',gen_random_uuid(),clock_timestamp()-interval '1 minute');

insert into public.cueva_notification_inbox(
 id,delivery_id,notification_id,student_id,user_id,title,body
) values
 ('ba000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','Recordatorio de cuota','Tu período tiene saldo pendiente.');

-- Student one: own preference and inbox only; cannot read operational tables.
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000002','role','authenticated','session_id','b2000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;

select is((select count(*)::integer from public.cueva_notification_preferences),1,'student can read their own push preference');
select is((select count(*)::integer from public.cueva_notification_inbox),1,'student can read their own internal inbox');
select is((select count(*)::integer from public.cueva_notification_inbox where id='ba000000-0000-4000-8000-000000000001'),1,'own inbox row is visible');
update public.cueva_notification_preferences set push_enabled=false where student_id='b3000000-0000-4000-8000-000000000001';
select is((select push_enabled from public.cueva_notification_preferences where student_id='b3000000-0000-4000-8000-000000000001'),false,'student can disable push for their own account');
update public.cueva_notification_preferences set push_enabled=false where student_id='b3000000-0000-4000-8000-000000000002';
-- RLS correctly hides the other student's row from this SELECT. Inspect the
-- persisted value as the database test owner to prove the UPDATE changed nothing.
reset role;
select is((select push_enabled from public.cueva_notification_preferences where student_id='b3000000-0000-4000-8000-000000000002'),true,'student cannot change another student preference');
set local role authenticated;
update public.cueva_notification_inbox set read_at=clock_timestamp() where id='ba000000-0000-4000-8000-000000000001';
select ok((select read_at is not null from public.cueva_notification_inbox where id='ba000000-0000-4000-8000-000000000001'),'student can mark own inbox item as read');
select throws_ok($$select * from public.cueva_notifications$$,'42501',null,'student cannot query operational notification rows');
select throws_ok($$select * from public.cueva_notification_deliveries$$,'42501',null,'student cannot query delivery rows');

reset role;
select ok(has_function_privilege('service_role','public.cueva_notifications_worker_snapshot()','EXECUTE'),'service role can execute the worker snapshot');
select ok(not has_function_privilege('authenticated','public.cueva_notifications_worker_snapshot()','EXECUTE'),'authenticated cannot execute the worker snapshot');
select ok(not has_function_privilege('anon','public.cueva_notifications_worker_snapshot()','EXECUTE'),'anon cannot execute the worker snapshot');
select ok(has_table_privilege('service_role','public.cueva_notification_settings','SELECT'),'worker can read the common schedule');
select ok(has_table_privilege('service_role','public.cueva_notification_preferences','SELECT'),'worker can read push preferences');

-- Both admins use the authenticated schedule RPC; only untouched pending work moves.
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000001','role','authenticated','session_id','b2000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;
select is(public.cueva_update_notification_schedule(time '13:00'),time '13:00','administrator can change the common send time');

-- Operational notification tables are intentionally not readable by admins
-- through the Data API. Inspect the RPC effects as the database test owner.
reset role;
select is((select send_time from public.cueva_notification_settings where singleton),time '13:00','new common send time is persisted');
select is((select count(*)::integer from public.cueva_notification_audit where action='schedule_changed' and actor_id='b1000000-0000-4000-8000-000000000001'),1,'schedule change is audited with its actor');
select is((select scheduled_at from public.cueva_notifications where id='b8000000-0000-4000-8000-000000000001'),timestamptz '2026-11-15 13:00:00-03','pending notification schedule follows the configured local time');
select is((select next_attempt_at from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000001'),timestamptz '2026-11-15 13:00:00-03','unattempted delivery schedule is updated');
select is((select next_attempt_at from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000002'),timestamptz '2026-11-15 12:15:00-03','delivery with a previous attempt keeps its retry schedule');

reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select results_eq(
 $$select balance_cents from public.cueva_notifications_worker_snapshot() where period_id='b6000000-0000-4000-8000-000000000001'$$,
 $$values (7500::bigint)$$,
 'worker snapshot returns current balance after partial payment without exposing payment history'
);

reset role;
select throws_ok($$insert into public.cueva_notifications(id,period_id,reminder_days,due_on,scheduled_at) values ('b8000000-0000-4000-8000-000000000003','b6000000-0000-4000-8000-000000000001',5,date '2026-11-20',now())$$,'23505',null,'logical notification identity is unique by period, type, and due date');
select throws_ok($$insert into public.cueva_notification_deliveries(id,notification_id,channel,status,attempt_count,next_attempt_at,lease_token) values ('b9000000-0000-4000-8000-000000000004','b8000000-0000-4000-8000-000000000002','push','processing',0,now(),gen_random_uuid())$$,'23514',null,'processing delivery requires both lease token and expiry');
select throws_ok($$insert into public.cueva_notification_inbox(id,delivery_id,notification_id,student_id,user_id,title,body) values ('ba000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000003','Wrong owner','Should fail')$$,'23514',null,'internal inbox enforces the delivery, student, and linked user relationship');


-- Atomic worker claims: only service_role may reserve due deliveries.
reset role;
select ok(
  has_function_privilege('service_role','public.cueva_claim_notification_deliveries(integer,integer)','EXECUTE'),
  'service role can claim notification deliveries'
);
select ok(
  not has_function_privilege('authenticated','public.cueva_claim_notification_deliveries(integer,integer)','EXECUTE'),
  'authenticated cannot claim notification deliveries'
);
select ok(
  not has_function_privilege('anon','public.cueva_claim_notification_deliveries(integer,integer)','EXECUTE'),
  'anon cannot claim notification deliveries'
);

update public.cueva_notifications
set scheduled_at = clock_timestamp()
where id = 'b8000000-0000-4000-8000-000000000001';
update public.cueva_notification_deliveries
set next_attempt_at = clock_timestamp()
where id = 'b9000000-0000-4000-8000-000000000001';

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(
  (select count(*)::integer from public.cueva_claim_notification_deliveries(1,300)),
  1,
  'worker atomically claims one due delivery'
);
reset role;
select is(
  (select status from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000001'),
  'processing',
  'claimed delivery moves to processing'
);
select is(
  (select attempt_count::integer from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000001'),
  1,
  'claim increments the attempt counter exactly once'
);
select ok(
  (select lease_token is not null and lease_expires_at > clock_timestamp()
   from public.cueva_notification_deliveries
   where id='b9000000-0000-4000-8000-000000000001'),
  'claim assigns a live unique lease'
);

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(
  (select count(*)::integer from public.cueva_claim_notification_deliveries(1,300)),
  0,
  'active lease prevents the same delivery from being claimed again'
);
reset role;

update public.cueva_notification_deliveries
set lease_expires_at = clock_timestamp() - interval '1 second'
where id='b9000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(
  (select count(*)::integer from public.cueva_claim_notification_deliveries(1,300)),
  0,
  'expired lease is recovered but delayed for its retry interval'
);
reset role;
select is(
  (select count(*)::integer from public.cueva_notification_attempts
   where delivery_id='b9000000-0000-4000-8000-000000000001'
     and attempt_number=1 and outcome='unknown' and error_code='lease_expired'),
  1,
  'expired lease is recorded as an unknown attempt'
);
select is((select status from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000005'),
  'failed','expired email lease is terminal to prevent a duplicate send');
select is((select count(*)::integer from public.cueva_notification_admin_alerts where delivery_id='b9000000-0000-4000-8000-000000000005' and alert_type='provider_outcome_unknown'),
  1,'expired email lease creates an admin reconciliation alert');
select is(
  (select status from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000001'),
  'pending',
  'expired lease returns to pending when retries remain and due date is future'
);


-- Lease-safe finalization: only the active service worker may persist an outcome.
reset role;
select ok(
  has_function_privilege('service_role','public.cueva_finalize_notification_delivery(uuid,uuid,text,text,text)','EXECUTE'),
  'service role can finalize notification deliveries'
);
select ok(
  not has_function_privilege('authenticated','public.cueva_finalize_notification_delivery(uuid,uuid,text,text,text)','EXECUTE'),
  'authenticated cannot finalize notification deliveries'
);
select ok(
  not has_function_privilege('anon','public.cueva_finalize_notification_delivery(uuid,uuid,text,text,text)','EXECUTE'),
  'anon cannot finalize notification deliveries'
);

update public.cueva_notification_deliveries
set next_attempt_at = clock_timestamp()
where id = 'b9000000-0000-4000-8000-000000000001'
  and status = 'pending';

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(
  (select count(*)::integer from public.cueva_claim_notification_deliveries(1,300)),
  1,
  'worker can reclaim a retry after its backoff is due'
);
select set_config(
  'test.cueva_notification_lease_token',
  (select lease_token::text from public.cueva_notification_deliveries
   where id='b9000000-0000-4000-8000-000000000001'),
  true
);
select is(
  (select finalized from public.cueva_finalize_notification_delivery(
    'b9000000-0000-4000-8000-000000000001',
    current_setting('test.cueva_notification_lease_token')::uuid,
    'sent',
    'provider-test-001',
    null
  )),
  true,
  'active lease can be finalized as sent'
);
select is(
  (select status from public.cueva_notification_deliveries
   where id='b9000000-0000-4000-8000-000000000001'),
  'sent',
  'successful finalization clears processing state and marks delivery sent'
);
select is(
  (select count(*)::integer from public.cueva_notification_attempts
   where delivery_id='b9000000-0000-4000-8000-000000000001'
     and attempt_number=2 and outcome='sent' and provider_reference='provider-test-001'),
  1,
  'successful finalization appends exactly one provider outcome'
);
select is(
  (select finalized from public.cueva_finalize_notification_delivery(
    'b9000000-0000-4000-8000-000000000001',
    current_setting('test.cueva_notification_lease_token')::uuid,
    'sent',
    'provider-test-001',
    null
  )),
  false,
  'duplicate finalization is a safe no-op'
);
select is(
  (select count(*)::integer from public.cueva_notification_attempts
   where delivery_id='b9000000-0000-4000-8000-000000000001'
     and attempt_number=2),
  1,
  'duplicate finalization does not duplicate the attempt ledger'
);
reset role;
select ok(
  (select bool_and(recorded_at is not null)
   from public.cueva_notification_attempts
   where delivery_id='b9000000-0000-4000-8000-000000000001'),
  'attempt ledger records when each outcome was persisted'
);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select throws_ok(
  $$select * from public.cueva_finalize_notification_delivery(
    'b9000000-0000-4000-8000-000000000001',
    gen_random_uuid(),
    'sent',
    null,
    null
  )$$,
  '42501',
  null,
  'non-worker role cannot invoke finalization'
);
reset role;


-- Exhausted deliveries create one concise admin alert transactionally.
reset role;
update public.cueva_notification_deliveries
set status = 'failed',
    attempt_count = 5,
    last_error_code = 'provider_error',
    updated_at = clock_timestamp()
where id = 'b9000000-0000-4000-8000-000000000003'
  and status = 'pending';

select is(
  (select count(*)::integer from public.cueva_notification_admin_alerts
   where delivery_id = 'b9000000-0000-4000-8000-000000000003'),
  1,
  'first terminal failure after five attempts creates one admin alert'
);

-- An uncertain Brevo response is terminal before exhausting retries.
update public.cueva_notifications set scheduled_at = clock_timestamp()
where id = 'b8000000-0000-4000-8000-000000000002';
update public.cueva_notification_deliveries set next_attempt_at = clock_timestamp()
where id = 'b9000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is((select count(*)::integer from public.cueva_claim_notification_deliveries(1,300)),1,
  'worker claims the email delivery for uncertain-outcome test');
select is((select delivery_status from public.cueva_finalize_notification_delivery(
  'b9000000-0000-4000-8000-000000000004',
  (select lease_token from public.cueva_notification_deliveries where id='b9000000-0000-4000-8000-000000000004'),
  'unknown',null,'brevo_result_unknown'
)), 'failed', 'uncertain Brevo result becomes terminal instead of retryable');
reset role;
select is((select count(*)::integer from public.cueva_notification_admin_alerts
  where delivery_id='b9000000-0000-4000-8000-000000000004' and alert_type='provider_outcome_unknown' and attempt_count=1),
  1,'uncertain provider result creates an admin reconciliation alert at the actual attempt count');
select ok(
  (select student_name = 'Student Two'
      and period_month = date '2026-11-01'
      and reminder_days = 5
      and channel = 'internal'
      and attempt_count = 5
      and failed_at is not null
   from public.cueva_notification_admin_alerts
   where delivery_id = 'b9000000-0000-4000-8000-000000000003'),
  'admin alert contains the concise student, period, reminder, channel, and exhaustion snapshot'
);

select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000001','role','authenticated','session_id','b2000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;
select is(
  (select count(*)::integer from public.cueva_notification_admin_alerts),
  3,
  'administrator with a valid session can read operational alerts'
);
select throws_ok(
  $$select * from public.cueva_notification_attempts$$,
  '42501',
  null,
  'administrator UI cannot read the restricted technical attempt ledger'
);

reset role;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000002','role','authenticated','session_id','b2000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;
select is(
  (select count(*)::integer from public.cueva_notification_admin_alerts),
  0,
  'student cannot read administrative operational alerts'
);

reset role;
update public.cueva_notification_deliveries
set status = 'failed', updated_at = clock_timestamp()
where id = 'b9000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::integer from public.cueva_notification_admin_alerts
   where delivery_id = 'b9000000-0000-4000-8000-000000000003'),
  1,
  'repeated failed-state update cannot duplicate the admin alert'
);

select * from finish();
rollback;
