insert into locations (id, name, timezone, suite_count, minimum_session_minutes, booking_increment_minutes, turnover_buffer_minutes, access_before_minutes, access_after_minutes, play_now_enabled)
values ('00000000-0000-0000-0000-000000000001', 'Fairway Network Location #1', 'America/Chicago', 12, 30, 15, 15, 15, 15, true)
on conflict (id) do nothing;

insert into suites (location_id, name, status)
select '00000000-0000-0000-0000-000000000001', 'Practice Suite ' || n, 'available'
from generate_series(1, 12) as n
on conflict (location_id, name) do nothing;

insert into membership_plans (id, code, name, monthly_credits, booking_window_days, max_active_future_reservations, play_now_enabled, guest_allowance)
values ('00000000-0000-0000-0000-000000000101', 'TEST_BIRDIE', 'Test Birdie', 24, 7, 2, true, 1)
on conflict (code) do nothing;
