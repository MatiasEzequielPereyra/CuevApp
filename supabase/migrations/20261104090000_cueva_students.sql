begin;
create table public.cueva_students (
 id uuid primary key,
 first_name text not null check (first_name = btrim(first_name) and length(first_name) between 1 and 80),
 last_name text not null check (last_name = btrim(last_name) and length(last_name) between 1 and 80),
 email text not null unique check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 dni text unique check (dni is null or dni ~ '^[0-9]{6,10}$'),
 joined_on date not null check (joined_on between date '1900-01-01' and date '2100-12-31'),
 active boolean not null default true
);
alter table public.cueva_students enable row level security;
revoke all on public.cueva_students from public, anon, authenticated, service_role;
grant select, insert on public.cueva_students to authenticated;
grant update (first_name,last_name,email,dni,joined_on,active) on public.cueva_students to authenticated;
create policy students_read on public.cueva_students for select to authenticated using (
 (select cueva_private.ready_for_current_session()) and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin'));
create policy students_insert on public.cueva_students for insert to authenticated with check (
 (select cueva_private.ready_for_current_session()) and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin'));
create policy students_update on public.cueva_students for update to authenticated using (
 (select cueva_private.ready_for_current_session()) and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin')) with check (
 (select cueva_private.ready_for_current_session()) and exists(select 1 from public.cueva_profiles where user_id=(select auth.uid()) and role='admin'));
commit;
