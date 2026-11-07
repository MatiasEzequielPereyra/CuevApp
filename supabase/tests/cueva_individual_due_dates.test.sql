begin;
select plan(96);

-- Pure date helper coverage.
select is(cueva_private.monthly_due_date(1::smallint,date '2026-01-01'),date '2026-01-01','day 1');
select is(cueva_private.monthly_due_date(18::smallint,date '2026-04-01'),date '2026-04-18','day 18');
select is(cueva_private.monthly_due_date(28::smallint,date '2026-02-01'),date '2026-02-28','day 28 in common February');
select is(cueva_private.monthly_due_date(29::smallint,date '2026-02-01'),date '2026-02-28','day 29 clamps in common February');
select is(cueva_private.monthly_due_date(29::smallint,date '2028-02-01'),date '2028-02-29','day 29 in leap February');
select is(cueva_private.monthly_due_date(30::smallint,date '2026-02-01'),date '2026-02-28','day 30 clamps in February');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-02-01'),date '2026-02-28','day 31 clamps in common February');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-04-01'),date '2026-04-30','day 31 clamps in April');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-06-01'),date '2026-06-30','day 31 clamps in June');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-09-01'),date '2026-09-30','day 31 clamps in September');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-11-01'),date '2026-11-30','day 31 clamps in November');
select is(cueva_private.monthly_due_date(31::smallint,date '2026-03-01'),date '2026-03-31','original day recovers after February');
select is(cueva_private.monthly_due_date(31::smallint,date '2027-01-01'),date '2027-01-31','year boundary');
select is(cueva_private.monthly_due_date(31::smallint,date '2028-01-01'),date '2028-01-31','leap-year boundary');
select is(cueva_private.monthly_due_date(30::smallint,date '2026-12-01'),date '2026-12-30','December');
select throws_ok($$select cueva_private.monthly_due_date(0::smallint,date '2026-01-01')$$,'22023',null,'rejects day zero');
select throws_ok($$select cueva_private.monthly_due_date(32::smallint,date '2026-01-01')$$,'22023',null,'rejects day 32');
select throws_ok($$select cueva_private.monthly_due_date(31::smallint,date '2026-01-02')$$,'22023',null,'requires first day of month');

-- Build a real admin/session context. These fixtures exist only in this test transaction.
insert into auth.users(id,aud,role,email,created_at,updated_at)
values ('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','due-date-admin@example.test',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at)
values ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',now(),now());
insert into cueva_private.access_state(user_id,ready,session_not_before)
values ('a1000000-0000-4000-8000-000000000001',true,now()-interval '1 minute');
insert into public.cueva_profiles(user_id,role)
values ('a1000000-0000-4000-8000-000000000001','admin');
insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values ('a3000000-0000-4000-8000-000000000001','Test','Student','due-date-student@example.test',date '2026-01-31');

select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','a1000000-0000-4000-8000-000000000001','role','authenticated','session_id','a2000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;

select ok(not has_function_privilege('authenticated','cueva_private.billing_write(uuid,jsonb)','EXECUTE'),
 'authenticated cannot execute the private financial writer directly');
select throws_ok($q$select cueva_private.billing_write('a3f00000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period'))$q$,
 '42501',null,'authenticated must use the guarded billing wrapper instead of the private writer');

select is((select count(*)::integer from public.cueva_due_schedules where student_id='a3000000-0000-4000-8000-000000000001'),1,'new student receives one initial due schedule');
select is(public.cueva_billing_write('a4000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','price','month',to_char(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'),'YYYY-MM'),'cents','10000')),
 'a4000000-0000-4000-8000-000000000001'::uuid,'admin can create the current monthly price');
select is(public.cueva_billing_write('a5000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','period','student_id','a3000000-0000-4000-8000-000000000001','month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'))),
 'a5000000-0000-4000-8000-000000000001'::uuid,'admin can create the next period');
select is((select due_on from public.cueva_periods where id='a5000000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '2 months - 1 day')::date,
 'period due date is derived from the student day and clamps at month end');

select is(public.cueva_billing_write('a6000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','15','expected_old_due_day','31',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Initial schedule adjustment')),
 'a6000000-0000-4000-8000-000000000001'::uuid,'admin can change the next period due day');
select is((select due_on from public.cueva_periods where id='a5000000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date+14,
 'changing due day updates an existing unpaid period');
select is(public.cueva_billing_write('a6000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','15','expected_old_due_day','31',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Initial schedule adjustment')),
 'a6000000-0000-4000-8000-000000000001'::uuid,'identical operation retry is idempotent');

-- Reproduce a legacy row created by the previous wrapper bug: a rejected
-- payload was recorded for an operation that had already succeeded.
reset role;
insert into public.cueva_due_date_attempts(
 operation_id,student_id,actor,actor_email,requested_due_day,requested_reason,
 effective_month,scope,error_code,error_message,payload
) values (
 'a6000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',
 'a1000000-0000-4000-8000-000000000001','due-date-admin@example.test','16',
 'Changed retry payload',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'next_period','P0001','legacy conflicting attempt',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001',
 'due_day','16','expected_old_due_day','31',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Changed retry payload')
);
set local role authenticated;
select throws_ok($q$select public.cueva_billing_write('a6000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','16','expected_old_due_day','31',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Changed retry payload'))$q$,
 'P0001',null,'successful operation key rejects a different payload without recording a rejected attempt');
select is(public.cueva_billing_write('a6000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','15','expected_old_due_day','31',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Initial schedule adjustment')),
 'a6000000-0000-4000-8000-000000000001'::uuid,'original successful operation remains idempotently recoverable');
select is((select count(*)::integer from public.cueva_due_date_attempts where operation_id='a6000000-0000-4000-8000-000000000001'),
 1,'legacy rejected-attempt row remains singular and cannot block a successful key');
select ok((select payload->>'due_day'='16' from public.cueva_due_date_attempts where operation_id='a6000000-0000-4000-8000-000000000001'),
 'successful-key recovery does not overwrite the legacy attempt payload');

select is(public.cueva_billing_write('a7000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','payment','student_id','a3000000-0000-4000-8000-000000000001',
 'period_id','a5000000-0000-4000-8000-000000000001','cents','4000','paid_on',current_date::text,'method','efectivo')),
 'a7000000-0000-4000-8000-000000000001'::uuid,'partial payment is accepted');
select is(public.cueva_billing_write('a8000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','16','expected_old_due_day','15',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Adjust partially paid period')),
 'a8000000-0000-4000-8000-000000000001'::uuid,'partially paid period can have its due day changed');
select is((select due_on from public.cueva_periods where id='a5000000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date+15,
 'partial payment does not prevent due date update');
select is(public.cueva_billing_write('b1040000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','period','student_id','a3000000-0000-4000-8000-000000000001',
 'month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '2 months')::date,'YYYY-MM'))),
 'b1040000-0000-4000-8000-000000000001'::uuid,'period after the changed schedule is created');
select is((select due_on from public.cueva_periods where id='b1040000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '2 months')::date+15,
 'future period uses the latest effective individual due day');
select is((select cents from public.cueva_periods where id='b1040000-0000-4000-8000-000000000001'),
 10000::bigint,'future period preserves the applicable monthly price snapshot');

select is(public.cueva_billing_write('a9000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','payment','student_id','a3000000-0000-4000-8000-000000000001',
 'period_id','a5000000-0000-4000-8000-000000000001','cents','6000','paid_on',current_date::text,'method','transferencia')),
 'a9000000-0000-4000-8000-000000000001'::uuid,'remaining balance can be paid');
select is(public.cueva_billing_write('aa000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','17','expected_old_due_day','16',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Must reject fully paid period')),null::uuid,
 'fully paid period rejects due day change and is audited');
select is(public.cueva_billing_write('ab000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','reverse','student_id','a3000000-0000-4000-8000-000000000001',
 'payment_id','a9000000-0000-4000-8000-000000000001','reason','Reverse test payment')),
 'ab000000-0000-4000-8000-000000000001'::uuid,'payment reversal is accepted');
select is(public.cueva_billing_write('ac000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','18','expected_old_due_day','16',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Change after payment reversal')),
 'ac000000-0000-4000-8000-000000000001'::uuid,'reversed payment is excluded from the paid balance');
select is(public.cueva_billing_write('ad100000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','21','expected_old_due_day','18',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period')),
 'ad100000-0000-4000-8000-000000000001'::uuid,'ordinary due-day change accepts an omitted reason');
select is((select due_on from public.cueva_periods where id='b1040000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '2 months')::date+20,
 'later unpaid existing period is recalculated when effective schedule changes');
select is((select reason from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),null,
 'omitted optional reason is stored as null');
select is((select actor from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),
 'a1000000-0000-4000-8000-000000000001'::uuid,'audit stores the authenticated administrator as actor');
select is((select old_due_day from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),
 18::smallint,'audit stores the previous due day');
select is((select new_due_day from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),
 21::smallint,'audit stores the new due day');
select ok((select recorded_at is not null and recorded_at<=clock_timestamp() from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),
 'audit timestamp is generated by the database');

-- Student deletion remains compatible with due schedules while audit history is retained.
insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values ('af200000-0000-4000-8000-000000000001','Audited','Student','audited-due-student@example.test',current_date);
select is(public.cueva_billing_write('af300000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','af200000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day',extract(day from current_date)::text,
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period')),
 'af300000-0000-4000-8000-000000000001'::uuid,'audited student receives an individual due-day change');
select is(public.cueva_delete_empty_student('af200000-0000-4000-8000-000000000001',
 'audited-due-student@example.test',true),'protected',
 'student with due-date audit history cannot be deleted');
select is((select count(*)::integer from public.cueva_due_date_audit where student_id='af200000-0000-4000-8000-000000000001'),
 1,'student deletion preserves due-date audit history');

insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values ('af400000-0000-4000-8000-000000000001','Empty','Student','empty-due-student@example.test',current_date);
select is(public.cueva_delete_empty_student('af400000-0000-4000-8000-000000000001',
 'empty-due-student@example.test',true),'deleted',
 'empty student without audit history remains deletable');
select is((select count(*)::integer from public.cueva_due_schedules where student_id='af400000-0000-4000-8000-000000000001'),
 0,'deleting an empty student cascades only its due schedule');

-- Rejected attempts are also retained as administrative history and protect the fiche.
insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values ('af500000-0000-4000-8000-000000000001','Rejected','Attempt','rejected-attempt-student@example.test',current_date);
select is(public.cueva_billing_write('af600000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','af500000-0000-4000-8000-000000000001','due_day','0',
 'expected_old_due_day',extract(day from current_date)::text,
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period')),
 null::uuid,'invalid due-day attempt is retained for the student');
select is(public.cueva_delete_empty_student('af500000-0000-4000-8000-000000000001',
 'rejected-attempt-student@example.test',true),'protected',
 'student with rejected due-date attempt history cannot be deleted');


select is((select count(*)::integer from public.cueva_due_date_audit where student_id='a3000000-0000-4000-8000-000000000001'),
 4,'only successfully applied due day changes are audited');

select is(public.cueva_billing_write('b1080000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','19','expected_old_due_day','31',
 'effective_month',to_char(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM'),
 'scope','current_period','reason','Missing explicit confirmation')),null::uuid,
 'current-period change without explicit confirmation is rejected and audited');
select is(public.cueva_billing_write('b1000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','19','expected_old_due_day','31',
 'effective_month',to_char(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'YYYY-MM'),
 'scope','current_period','confirm_current_period',true,'reason','Explicit current period change')),
 'b1000000-0000-4000-8000-000000000001'::uuid,'explicit current-period change is accepted');
select is((select due_day from public.cueva_due_schedules
 where student_id='a3000000-0000-4000-8000-000000000001'
 and effective_month=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date
 order by recorded_at desc,id desc limit 1),
 19::smallint,'current-period change becomes effective in the selected month');
select is(public.cueva_billing_write('b1010000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','current_period','reason','Mismatched scope')),null::uuid,
 'current-period scope cannot target the next month and is audited');
select is(public.cueva_billing_write('b1060000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope',null)),null::uuid,'missing scope is rejected and audited');
select is(public.cueva_billing_write('b1070000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','future_period')),null::uuid,'unknown scope is rejected and audited');
select is(public.cueva_billing_write('b1020000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','0','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Invalid day test')),null::uuid,
 'due-day writer rejects day zero and records the failure');
select is(public.cueva_billing_write('b1030000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','ab')),null::uuid,
 'due-day writer rejects a reason shorter than three characters and records the failure');
select is(public.cueva_billing_write('b1050000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','22','expected_old_due_day','20',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Stale preview test')),null::uuid,
 'stale due-day preview is rejected and audited');
select is((select due_day from public.cueva_due_schedules where student_id='a3000000-0000-4000-8000-000000000001'
 and effective_month=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date
 order by recorded_at desc,id desc limit 1),
 21::smallint,'stale preview does not overwrite the newer due-day rule');

select is((select count(*)::integer from public.cueva_due_date_attempts where student_id='a3000000-0000-4000-8000-000000000001'),
 9,'all nine rejected due-day attempts are retained separately');
select is((select actor_email from public.cueva_due_date_audit where id='ad100000-0000-4000-8000-000000000001'),
 'due-date-admin@example.test','audit identifies the administrator by account email');
select is((select actor_email from public.cueva_due_date_attempts where operation_id='b1020000-0000-4000-8000-000000000001'),
 'due-date-admin@example.test','failed attempt identifies the administrator by account email');
select ok((select error_code='22023' and length(error_message)>0 from public.cueva_due_date_attempts where operation_id='b1020000-0000-4000-8000-000000000001'),
 'failed attempt stores the database error code and explanation');

select is(public.cueva_billing_write('b1020000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','0','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Invalid day test')),null::uuid,
 'retrying the same rejected operation returns the same rejected result');
select throws_ok($q$select public.cueva_billing_write('b1020000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','21','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Changed retry payload'))$q$,
 '23505',null,'reusing a rejected operation id with a different payload is rejected');
select is((select count(*)::integer from public.cueva_due_date_attempts
 where operation_id='b1020000-0000-4000-8000-000000000001'),1,
 'a rejected operation id is retained only once');
select ok((select payload is not null and actor='a1000000-0000-4000-8000-000000000001'::uuid
 from public.cueva_due_date_attempts where operation_id='b1020000-0000-4000-8000-000000000001'),
 'rejected attempt persists its payload and original actor');

select throws_ok($$insert into public.cueva_due_schedules(id,student_id,due_day,effective_month,actor)
 values('b2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',20,date '2026-01-01','a1000000-0000-4000-8000-000000000001')$$,
 '42501',null,'admin cannot insert due schedules outside the audited RPC');
select throws_ok($$update public.cueva_due_schedules set due_day=21 where id='a6000000-0000-4000-8000-000000000001'$$,
 '42501',null,'admin cannot edit due schedules directly');
select throws_ok($$delete from public.cueva_due_schedules where id='a6000000-0000-4000-8000-000000000001'$$,
 '42501',null,'admin cannot delete due schedules directly');
select throws_ok($$insert into public.cueva_due_date_audit(id,student_id,actor,old_due_day,new_due_day,effective_month,scope,reason,result)
 values('b2010000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',19,20,date '2026-11-01','current_period','Manual audit','applied')$$,
 '42501',null,'admin cannot insert audit rows directly');
select throws_ok($$update public.cueva_due_date_audit set reason='tampered' where id='a6000000-0000-4000-8000-000000000001'$$,
 '42501',null,'admin cannot edit audit history directly');
select throws_ok($$delete from public.cueva_due_date_audit where id='a6000000-0000-4000-8000-000000000001'$$,
 '42501',null,'admin cannot delete audit history directly');
select throws_ok($$insert into public.cueva_due_date_attempts(operation_id,student_id,actor,actor_email,requested_due_day,effective_month,scope,error_code,error_message)
 values('b2020000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','spoof@example.test','20','2026-12','next_period','22023','spoof')$$,
 '42501',null,'admin cannot insert rejected-attempt audit rows directly');


-- A failure while appending the audit must roll back the schedule and all period updates.
reset role;
create function cueva_private.test_fail_due_audit_insert()
returns trigger language plpgsql set search_path='' as $audit_failure$
begin
 raise exception 'forced audit insert failure' using errcode='P0001';
end;
$audit_failure$;
create trigger zz_test_fail_due_audit_insert
 before insert on public.cueva_due_date_audit
 for each row execute function cueva_private.test_fail_due_audit_insert();
set local role authenticated;
select is(public.cueva_billing_write('b3000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','22','expected_old_due_day','21',
 'effective_month',to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM'),
 'scope','next_period','reason','Rollback when audit insert fails')),null::uuid,
 'audit insertion failure is returned as a rejected operation');
reset role;
drop trigger zz_test_fail_due_audit_insert on public.cueva_due_date_audit;
drop function cueva_private.test_fail_due_audit_insert();
set local role authenticated;
select is((select due_day from public.cueva_due_schedules where student_id='a3000000-0000-4000-8000-000000000001'
 and effective_month=(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date
 order by recorded_at desc,id desc limit 1),21::smallint,
 'audit failure rolls back the newly inserted due schedule');
select is((select due_on from public.cueva_periods where id='b1040000-0000-4000-8000-000000000001'),
 (date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '2 months')::date+20,
 'audit failure rolls back recalculated future period dates');
select is((select count(*)::integer from public.cueva_due_date_audit where id='b3000000-0000-4000-8000-000000000001'),
 0,'audit failure leaves no successful audit record');
select is((select count(*)::integer from public.cueva_due_date_attempts where operation_id='b3000000-0000-4000-8000-000000000001'),
 1,'audit failure is recorded as one rejected attempt');
reset role;
select is((select count(*)::integer from cueva_private.billing_operations where id='b3000000-0000-4000-8000-000000000001'),
 0,'audit failure does not persist a successful billing operation');
set local role authenticated;

select ok(not has_table_privilege('anon','public.cueva_due_schedules','SELECT')
 and not has_table_privilege('anon','public.cueva_due_schedules','INSERT')
 and not has_table_privilege('anon','public.cueva_due_schedules','UPDATE')
 and not has_table_privilege('anon','public.cueva_due_schedules','DELETE'),
 'anon has no direct access to due schedules');
select ok(not has_table_privilege('anon','public.cueva_due_date_audit','SELECT')
 and not has_table_privilege('anon','public.cueva_due_date_audit','INSERT')
 and not has_table_privilege('anon','public.cueva_due_date_audit','UPDATE')
 and not has_table_privilege('anon','public.cueva_due_date_audit','DELETE'),
 'anon has no direct access to due date audit');
select ok(not has_table_privilege('anon','public.cueva_due_date_attempts','SELECT')
 and not has_table_privilege('anon','public.cueva_due_date_attempts','INSERT')
 and not has_table_privilege('anon','public.cueva_due_date_attempts','UPDATE')
 and not has_table_privilege('anon','public.cueva_due_date_attempts','DELETE'),
 'anon has no direct access to rejected attempts');
select ok(not has_function_privilege('anon','public.cueva_billing_write(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('anon','cueva_private.billing_write_guarded(uuid,jsonb)','EXECUTE'),
 'anon cannot execute either billing writer');

reset role;

-- A real authenticated alumno has a valid session but no administrative visibility or write access.
insert into auth.users(id,aud,role,email,created_at,updated_at)
values ('ad000000-0000-4000-8000-000000000001','authenticated','authenticated','due-date-alumno@example.test',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at)
values ('ae000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001',now(),now());
insert into cueva_private.access_state(user_id,ready,session_not_before)
values ('ad000000-0000-4000-8000-000000000001',true,now()-interval '1 minute');
insert into public.cueva_profiles(user_id,role)
values ('ad000000-0000-4000-8000-000000000001','alumno');
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','ad000000-0000-4000-8000-000000000001','role','authenticated','session_id','ae000000-0000-4000-8000-000000000001')::text,true);
set local role authenticated;

select is((select count(*)::integer from public.cueva_due_schedules where student_id='a3000000-0000-4000-8000-000000000001'),0,'alumno cannot read administrative due schedules');
select is((select count(*)::integer from public.cueva_due_date_audit where student_id='a3000000-0000-4000-8000-000000000001'),0,'alumno cannot read administrative due date audit');
select is((select count(*)::integer from public.cueva_due_date_attempts where student_id='a3000000-0000-4000-8000-000000000001'),0,'alumno cannot read rejected administrative attempts');
select throws_ok(format($q$select public.cueva_billing_write('af000000-0000-4000-8000-000000000001',
 jsonb_build_object('kind','due_day','student_id','a3000000-0000-4000-8000-000000000001','due_day','20','expected_old_due_day',extract(day from current_date)::text,
 'effective_month',%L,'scope','next_period','reason','Alumno must not change rules'))$q$,
 to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month')::date,'YYYY-MM')),
 '42501',null,'alumno cannot change administrative due day through the RPC');
select throws_ok($$insert into public.cueva_due_schedules(id,student_id,due_day,effective_month,actor)
 values('b0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001',20,date '2026-01-01','ad000000-0000-4000-8000-000000000001')$$,
 '42501',null,'alumno cannot write directly to due schedule table');

select * from finish();
rollback;
