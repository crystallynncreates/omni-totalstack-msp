-- Hardening from Supabase security advisor (applied 2026-09-27).
alter function protect_billing_columns() set search_path = public;
alter function touch() set search_path = public;
revoke execute on function enforce_plan_limits() from public, anon, authenticated;
revoke execute on function enforce_seat_limits() from public, anon, authenticated;
revoke execute on function my_role(uuid) from public, anon;
revoke execute on function my_client(uuid) from public, anon;
revoke execute on function org_live(uuid) from public, anon;
grant execute on function my_role(uuid) to authenticated;
grant execute on function my_client(uuid) to authenticated;
grant execute on function org_live(uuid) to authenticated;
