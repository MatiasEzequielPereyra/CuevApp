begin;
select plan(22);

insert into public.cueva_students(id,first_name,last_name,email,joined_on)
values
 ('be000000-0000-4000-8000-000000000001','Push','Limit One','push-limit-one@example.test',date '2026-01-01'),
 ('be000000-0000-4000-8000-000000000002','Push','Limit Two','push-limit-two@example.test',date '2026-01-02'),
 ('be000000-0000-4000-8000-000000000003','Push','Revoke One','push-revoke-one@example.test',date '2026-01-03');

insert into public.cueva_push_subscriptions(student_id,endpoint,p256dh,auth_secret)
values
 ('be000000-0000-4000-8000-000000000003','https://push.example.test/revoke-one',repeat('P',87),repeat('Q',22)),
 ('be000000-0000-4000-8000-000000000002','https://push.example.test/revoke-two',repeat('R',87),repeat('S',22));

select ok(
  has_function_privilege('service_role','public.cueva_register_push_subscription(uuid,text,text,text,timestamp with time zone)','EXECUTE'),
  'only the server worker role is granted the registration RPC'
);
select ok(
  not has_function_privilege('authenticated','public.cueva_register_push_subscription(uuid,text,text,text,timestamp with time zone)','EXECUTE'),
  'authenticated users cannot call the registration RPC directly'
);
select ok(
  not has_function_privilege('anon','public.cueva_register_push_subscription(uuid,text,text,text,timestamp with time zone)','EXECUTE'),
  'anonymous users cannot call the registration RPC'
);

select set_config('request.jwt.claims','{"role":"service_role"}',true);
-- Keep the test owner for table assertions; RPC authorization is checked via
-- the JWT role claim and the explicit EXECUTE privilege assertions above.

select is(
  (select count(*)::integer
   from generate_series(1,10) as device(number)
   cross join lateral public.cueva_register_push_subscription(
     'be000000-0000-4000-8000-000000000001',
     'https://push.example.test/atomic-' || device.number,
     repeat('A',87),repeat('B',22),null
   ) registration
   where registration.outcome='registered'),
  10,
  'ten distinct devices can be registered for one student'
);

select is(
  (select count(*)::integer from public.cueva_push_subscriptions
   where student_id='be000000-0000-4000-8000-000000000001' and revoked_at is null),
  10,
  'the student has exactly ten active devices after registration'
);

select is(
  (select outcome from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/atomic-eleven',
    repeat('C',87),repeat('D',22),null
  )),
  'limit_reached',
  'an eleventh distinct active device is rejected'
);

select is(
  (select outcome from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/atomic-1',
    repeat('E',87),repeat('F',22),null
  )),
  'updated',
  're-registering an existing endpoint remains allowed at the limit'
);

select is(
  (select id from public.cueva_push_subscriptions where endpoint='https://push.example.test/atomic-1'),
  (select subscription_id from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/atomic-1',
    repeat('G',87),repeat('H',22),null
  )),
  're-registration updates the existing row instead of creating a duplicate'
);

update public.cueva_push_subscriptions
set revoked_at=clock_timestamp()
where endpoint='https://push.example.test/atomic-1';

select is(
  (select outcome from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/atomic-1',
    repeat('J',87),repeat('K',22),null
  )),
  'updated',
  'a previously revoked endpoint can be reactivated'
);

select is(
  (select count(*)::integer from public.cueva_push_subscriptions
   where student_id='be000000-0000-4000-8000-000000000001' and revoked_at is null),
  10,
  'reactivating an endpoint preserves the ten-device active limit'
);

select is(
  (select outcome from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000002',
    'https://push.example.test/atomic-2',
    repeat('L',87),repeat('M',22),null
  )),
  'endpoint_in_use',
  'an endpoint already owned by another student cannot be reassigned'
);

select is(
  (select outcome from public.cueva_register_push_subscription(
    'be000000-0000-4000-8000-000000000099',
    'https://push.example.test/unknown-student',
    repeat('N',87),repeat('O',22),null
  )),
  'student_not_found',
  'registration for a nonexistent student is rejected'
);

select ok(
  has_function_privilege('service_role','public.cueva_revoke_push_subscription(uuid,text)','EXECUTE'),
  'only the server role can invoke the scoped revocation RPC'
);
select ok(
  not has_function_privilege('authenticated','public.cueva_revoke_push_subscription(uuid,text)','EXECUTE'),
  'authenticated users cannot invoke the revocation RPC directly'
);
select ok(
  not has_function_privilege('anon','public.cueva_revoke_push_subscription(uuid,text)','EXECUTE'),
  'anonymous users cannot invoke the revocation RPC'
);
select ok(
  has_table_privilege('service_role','public.cueva_push_subscriptions','SELECT'),
  'the server worker role can read active subscriptions to dispatch push notifications'
);
select ok(
  not has_table_privilege('authenticated','public.cueva_push_subscriptions','SELECT'),
  'authenticated users cannot read push subscription storage directly'
);
select ok(
  not has_table_privilege('anon','public.cueva_push_subscriptions','SELECT'),
  'anonymous users cannot read push subscription storage directly'
);
select is(
  public.cueva_revoke_push_subscription(
    'be000000-0000-4000-8000-000000000003',
    'https://push.example.test/revoke-one'
  ),
  'removed',
  'the scoped RPC revokes the matching student device'
);
select is(
  public.cueva_revoke_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/revoke-one'
  ),
  'not_found',
  'repeated revocation is an idempotent no-op'
);
select is(
  public.cueva_revoke_push_subscription(
    'be000000-0000-4000-8000-000000000001',
    'https://push.example.test/revoke-two'
  ),
  'not_found',
  'a student cannot revoke another student endpoint'
);
select is(
  (select revoked_at is null from public.cueva_push_subscriptions
   where endpoint='https://push.example.test/revoke-two'),
  true,
  'cross-account revocation leaves the other student's device active'
);

reset role;
select * from finish();
rollback;
