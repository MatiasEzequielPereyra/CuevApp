begin;

-- Authenticated clients must enter through the audited guarded wrapper.
-- The wrapper is SECURITY DEFINER and invokes billing_write as its owner.
revoke execute on function cueva_private.billing_write(uuid,jsonb) from authenticated;
revoke execute on function cueva_private.billing_write(uuid,jsonb) from public,anon,service_role;
grant execute on function cueva_private.billing_write_guarded(uuid,jsonb) to authenticated;

commit;
