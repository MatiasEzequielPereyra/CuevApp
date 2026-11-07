begin;

-- Scope the read by the current ready session and the existing invitation
-- binding. Keep administrative table policies and ledger writers intact.
create function cueva_private.membership_snapshot()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  member_id uuid;
  member_active boolean;
  local_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  current_month date := date_trunc('month', local_today::timestamp)::date;
  result jsonb;
begin
  if not cueva_private.ready_for_current_session() then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  select i.student_id, s.active into member_id, member_active
  from public.cueva_student_invitations i
  join public.cueva_profiles profile on profile.user_id = i.user_id
  join public.cueva_students s on s.id = i.student_id
  where i.user_id = auth.uid() and profile.role = 'alumno';

  if not found then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;

  with periods as (
    select p.month, p.due_on, p.cents, coalesce(sum(m.cents), 0) as paid,
      max(m.paid_on) as last_paid_on,
      coalesce(jsonb_agg(
        jsonb_build_object('paid_on', m.paid_on, 'cents', m.cents::text)
        order by m.paid_on desc, m.id
      ) filter (where m.id is not null), '[]'::jsonb) as payments
    from public.cueva_periods p
    left join public.cueva_payments m on m.period_id = p.id
      and not exists (select 1 from public.cueva_reversals r where r.payment_id = m.id)
    where p.student_id = member_id and p.month <= current_month
    group by p.id
  ), entries as (
    select month, last_paid_on, jsonb_build_object(
      'month', month, 'due_on', due_on, 'cents', cents::text, 'paid', paid::text,
      'balance', (cents - paid)::text, 'payments', payments,
      'status', case when cents = paid then 'paid'
        when due_on < local_today then 'overdue' else 'pending' end
    ) as entry
    from periods
  )
  select jsonb_build_object(
    'active', member_active, 'last_paid_on', max(last_paid_on),
    'current', (select entry from entries where month = current_month),
    'history', coalesce(jsonb_agg(entry order by month desc)
      filter (where month < current_month), '[]'::jsonb)
  ) into result
  from entries;

  return result;
end;
$$;

create function public.cueva_membership_snapshot()
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select cueva_private.membership_snapshot()
$$;

revoke all on function cueva_private.membership_snapshot(), public.cueva_membership_snapshot()
  from public, anon, authenticated, service_role;
grant execute on function cueva_private.membership_snapshot(), public.cueva_membership_snapshot()
  to authenticated;

commit;
