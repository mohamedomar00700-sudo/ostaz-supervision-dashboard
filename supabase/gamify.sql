-- الجيميفيكيشن: واجب الحصة اللي فاتت + تاريخ الحضور للسلاسل والشارات والشهادة (تتنفذ مرة واحدة)
alter table public.session_reports add column if not exists hw_done text check (hw_done in ('done','partial','not','none'));

create or replace function public.tutor_report_hw(p_session uuid, p_hw text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare tid uuid; gk uuid;
begin
  tid := public.my_tutor_id();
  if tid is null or (p_hw is not null and p_hw not in ('done','partial','not','none')) then return false; end if;
  select group_key into gk from public.sessions where id = p_session and tutor_id = tid;
  if not found then return false; end if;
  update public.session_reports set hw_done = p_hw where tutor_id = tid and sent_at is null and (session_id = p_session or (gk is not null and group_key = gk));
  return true;
end $$;
grant execute on function public.tutor_report_hw(uuid, text) to authenticated;

create or replace function public.parent_portal(p_token text) returns json
language plpgsql security definer set search_path to 'public' as $$
declare fid uuid; f public.families; res json; win timestamptz := date_trunc('month', now()) - interval '5 months';
begin
  fid := public.parent_family(p_token);
  if fid is null then return null; end if;
  update public.parent_links set last_seen = now() where token = p_token;
  select * into f from public.families where id = fid;
  select json_build_object(
    'family', json_build_object('id', f.id, 'name', f.name, 'country', f.country, 'currency', f.currency, 'billing_cycle', coalesce(f.billing_cycle, 'monthly'),
        'package_size', f.package_size, 'cycle_start', f.cycle_start, 'show_finance', f.portal_finance),
    'kids', coalesce((select json_agg(json_build_object('id', st.id, 'name', st.name, 'grade', st.grade_level, 'curriculum', st.curriculum,
        'subjects', coalesce((select json_agg(json_build_object('subject', ss.subject, 'tutor_name', split_part(t.name, ' (', 1), 'weekly', ss.weekly_sessions) order by ss.subject)
           from public.student_subjects ss join public.tutors t on t.id = ss.tutor_id where ss.student_id = st.id), '[]'::json)) order by st.name)
      from public.students st where st.family_id = fid), '[]'::json),
    'upcoming', coalesce((select json_agg(x order by x.scheduled_at) from (
        select s.id, s.scheduled_at, s.duration_minutes, s.subject, s.kind, s.status, s.student_id, st.name as student_name,
          split_part(t.name, ' (', 1) as tutor_name, s.group_name, s.makeup_of is not null as is_makeup,
          coalesce(s.meeting_link, (select ss.meeting_link from public.student_subjects ss where ss.student_id = s.student_id and ss.tutor_id = s.tutor_id and ss.meeting_link is not null limit 1), t.meeting_link) as meeting_link,
          exists(select 1 from public.session_acks a where a.session_id = s.id and a.party = 'parent' and a.party_id = fid) as acked
        from public.sessions s join public.students st on st.id = s.student_id join public.tutors t on t.id = s.tutor_id
        where st.family_id = fid and s.status in ('scheduled','in_progress')
          and s.scheduled_at >= now() - interval '3 hours' and s.scheduled_at < now() + interval '30 days') x), '[]'::json),
    'past', coalesce((select json_agg(x order by x.scheduled_at desc) from (
        select s.id, s.scheduled_at, coalesce(s.actual_minutes, s.duration_minutes) as minutes, s.subject, s.kind, s.status, s.student_id, st.name as student_name,
          split_part(t.name, ' (', 1) as tutor_name, s.group_name,
          case when f.portal_finance and s.status = 'done' then s.student_charge end as charge,
          case when s.status <> 'done' then s.cancel_reason end as cancel_reason,
          exists(select 1 from public.sessions m where m.makeup_of = s.id and m.status in ('scheduled','in_progress','done')) as made_up,
          (select json_build_object('attended', r.attended and not (st.id = any(coalesce(r.absent_ids, '{}'::uuid[]))), 'topics', r.topics, 'homework', r.homework, 'level', r.level, 'hw_done', r.hw_done)
             from public.session_reports r where (r.session_id = s.id or (s.group_key is not null and r.group_key = s.group_key)) and r.sent_at is not null limit 1) as report
        from public.sessions s join public.students st on st.id = s.student_id join public.tutors t on t.id = s.tutor_id
        where st.family_id = fid and s.scheduled_at >= win and s.scheduled_at < now()
          and (s.status = 'done' or s.status in ('cancelled_by_student','cancelled_by_tutor'))
        order by s.scheduled_at desc limit 400) x), '[]'::json),
    'finance', case when f.portal_finance then json_build_object(
        'paid', coalesce((select sum(case when t.type = 'refund' then -t.amount else t.amount end) from public.family_transactions t where t.family_id = fid), 0),
        'consumed', coalesce((select sum(s.student_charge) from public.sessions s join public.students st on st.id = s.student_id where st.family_id = fid and s.status = 'done'), 0),
        'window_start', win,
        'pkg_minutes', case when f.billing_cycle = 'prepaid' and f.cycle_start is not null then
            (select coalesce(sum(coalesce(s.actual_minutes, s.duration_minutes)), 0) from public.sessions s join public.students st on st.id = s.student_id
              where st.family_id = fid and s.status = 'done' and coalesce(s.student_charge, 0) > 0 and s.scheduled_at >= f.cycle_start::timestamp at time zone 'Africa/Cairo') end,
        'transactions', coalesce((select json_agg(json_build_object('at', t.created_at, 'amount', t.amount, 'currency', t.currency, 'type', t.type, 'method', t.method) order by t.created_at desc)
            from public.family_transactions t where t.family_id = fid), '[]'::json)
      ) end,
    'history', coalesce((select json_agg(json_build_array(h.scheduled_at, h.student_id, h.subject, h.minutes, h.att, h.hw) order by h.scheduled_at) from (
        select s.scheduled_at, s.student_id, s.subject, coalesce(s.actual_minutes, s.duration_minutes) as minutes,
          (select r.attended and not (s.student_id = any(r.absent_ids)) from public.session_reports r where (r.session_id = s.id or (s.group_key is not null and r.group_key = s.group_key)) and r.sent_at is not null limit 1) as att,
          (select r.hw_done from public.session_reports r where (r.session_id = s.id or (s.group_key is not null and r.group_key = s.group_key)) and r.sent_at is not null limit 1) as hw
        from public.sessions s join public.students st on st.id = s.student_id
        where st.family_id = fid and s.status = 'done' and s.kind <> 'trial') h), '[]'::json),
    'requests', coalesce((select json_agg(json_build_object('id', r.id, 'at', r.created_at, 'category', r.category, 'text', r.description, 'status', r.status, 'student_name', st.name, 'resolved_at', r.resolved_at) order by r.created_at desc)
        from public.relay_tasks r left join public.students st on st.id = r.student_id
        where r.requested_by = 'parent' and r.created_at >= now() - interval '90 days'
          and (st.family_id = fid or r.session_id in (select s.id from public.sessions s join public.students s2 on s2.id = s.student_id where s2.family_id = fid))), '[]'::json)
  ) into res;
  return res;
end $$;

