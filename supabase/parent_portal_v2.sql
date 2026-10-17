-- بوابة ولي الأمر v2: الحساب والباقة والجدول الأسبوعي والطلبات (تتنفذ مرة واحدة)
alter table public.families add column if not exists portal_finance boolean not null default true;

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
          (select json_build_object('attended', r.attended and not (st.id = any(coalesce(r.absent_ids, '{}'::uuid[]))), 'topics', r.topics, 'homework', r.homework, 'level', r.level)
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
    'requests', coalesce((select json_agg(json_build_object('id', r.id, 'at', r.created_at, 'category', r.category, 'text', r.description, 'status', r.status, 'student_name', st.name, 'resolved_at', r.resolved_at) order by r.created_at desc)
        from public.relay_tasks r left join public.students st on st.id = r.student_id
        where r.requested_by = 'parent' and r.created_at >= now() - interval '90 days'
          and (st.family_id = fid or r.session_id in (select s.id from public.sessions s join public.students s2 on s2.id = s.student_id where s2.family_id = fid))), '[]'::json)
  ) into res;
  return res;
end $$;

-- طلب من ولي الأمر (تأجيل / إلغاء / رسالة للمعلم / سؤال) → بيروح لمركز الترحيل عند الإشراف
create or replace function public.parent_request(p_token text, p_student uuid, p_session uuid, p_category text, p_text text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare fid uuid; sid uuid := p_student; tid uuid; rid uuid;
begin
  fid := public.parent_family(p_token);
  if fid is null or coalesce(trim(p_text), '') = '' then return null; end if;
  if p_category not in ('schedule','material','level','complaint','other') then p_category := 'other'; end if;
  if p_session is not null then
    select s.student_id, s.tutor_id into sid, tid from public.sessions s join public.students st on st.id = s.student_id where s.id = p_session and st.family_id = fid;
    if sid is null then return null; end if;
  elsif sid is not null and not exists (select 1 from public.students where id = sid and family_id = fid) then return null;
  end if;
  if (select count(*) from public.relay_tasks r join public.students st on st.id = r.student_id where st.family_id = fid and r.requested_by = 'parent' and r.created_at > now() - interval '1 day') >= 15 then return null; end if;
  if sid is null then select id into sid from public.students where family_id = fid order by name limit 1; end if;
  insert into public.relay_tasks(requested_by, category, student_id, session_id, tutor_id, description, status)
    values ('parent', p_category, sid, p_session, tid, left(trim(p_text), 2000), 'pending') returning id into rid;
  return rid;
end $$;
grant execute on function public.parent_request(text, uuid, uuid, text, text) to anon, authenticated;
