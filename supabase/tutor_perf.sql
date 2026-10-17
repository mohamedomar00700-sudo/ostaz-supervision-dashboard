-- لوحة أداء المعلمات: الإشراف يشوف الكل، والمعلمة تشوف نفسها بس (تتنفذ مرة واحدة / تتعاد بأمان)
create or replace function public.tutor_perf(p_from timestamptz, p_to timestamptz) returns json
language plpgsql stable security definer set search_path to 'public' as $$
declare staff boolean := public.is_admin() or public.is_active_supervisor(); me uuid := public.my_tutor_id();
  plen interval := p_to - p_from; ack_start timestamptz := '2026-10-17 18:00+00'; res json;
begin
  if not staff and me is null then return '[]'::json; end if;
  with s as (
    select s.* from public.sessions s where s.scheduled_at >= p_from and s.scheduled_at < p_to and s.scheduled_at < now() and (staff or s.tutor_id = me)
  ), occ as ( -- المجموعة = لقاء واحد
    select tutor_id, coalesce(group_key::text, id::text) as gk, scheduled_at, (array_agg(status::text))[1] as status,
      max(coalesce(actual_minutes, duration_minutes)) as mins, max(duration_minutes) as planned, array_agg(id) as ids, (array_agg(group_key))[1] as group_key, bool_or(kind = 'trial') as trial
    from s group by tutor_id, coalesce(group_key::text, id::text), scheduled_at
  ), rep as (
    select o.tutor_id, o.gk, o.scheduled_at, o.status, o.mins, o.planned, o.trial,
      (select r.created_at from public.session_reports r where r.session_id = any(o.ids) or (o.group_key is not null and r.group_key = o.group_key) order by r.created_at limit 1) as rep_at,
      (select r.hw_done from public.session_reports r where r.session_id = any(o.ids) or (o.group_key is not null and r.group_key = o.group_key) limit 1) as hw,
      exists(select 1 from public.session_acks a where a.session_id = any(o.ids) and a.party = 'tutor') as acked
    from occ o
  ), stu_now as (select distinct tutor_id, student_id from s where status = 'done'),
  stu_prev as (select distinct tutor_id, student_id from public.sessions where status = 'done' and scheduled_at >= p_from - plen and scheduled_at < p_from and (staff or tutor_id = me)),
  agg as (
    select t.id, t.name, t.user_id is not null as on_portal,
      count(*) filter (where r.status = 'done') as done_n,
      coalesce(sum(r.mins) filter (where r.status = 'done'), 0) as done_min,
      count(*) filter (where r.status = 'cancelled_by_tutor') as t_cancel,
      count(*) filter (where r.status = 'cancelled_by_student') as s_cancel,
      count(*) filter (where r.status = 'done' and r.mins < r.planned) as short_n,
      count(*) filter (where r.status = 'done' and r.trial) as trials,
      count(*) filter (where r.status = 'done' and r.rep_at is not null) as rep_n,
      count(*) filter (where r.status = 'done' and r.rep_at is not null and r.rep_at <= r.scheduled_at + make_interval(mins => r.mins + 120)) as rep_ontime,
      count(*) filter (where r.status = 'done' and r.hw is not null) as hw_n,
      count(*) filter (where r.status in ('done','cancelled_by_student') and r.scheduled_at >= ack_start) as ack_base,
      count(*) filter (where r.status in ('done','cancelled_by_student') and r.scheduled_at >= ack_start and r.acked) as ack_n,
      (select count(*) from stu_now n where n.tutor_id = t.id) as students,
      (select count(*) from stu_prev p where p.tutor_id = t.id) as prev_students,
      (select count(*) from stu_prev p where p.tutor_id = t.id and exists (select 1 from stu_now n where n.tutor_id = t.id and n.student_id = p.student_id)) as kept
    from public.tutors t left join rep r on r.tutor_id = t.id
    where staff or t.id = me
    group by t.id, t.name, t.user_id
  )
  select coalesce(json_agg(row_to_json(agg) order by agg.done_min desc), '[]'::json) into res from agg
  where agg.done_n > 0 or agg.t_cancel > 0 or agg.prev_students > 0;
  return res;
end $$;
grant execute on function public.tutor_perf(timestamptz, timestamptz) to authenticated;
