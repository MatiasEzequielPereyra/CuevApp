begin;
select plan(18);

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

select * from finish();
rollback;
