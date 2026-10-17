-- بوابة ولي الأمر + تأكيد التذكيرات (تتنفذ مرة واحدة)
create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);
alter table public.parent_links enable row level security;
create policy parent_links_staff on public.parent_links for all to authenticated
  using (public.is_admin() or public.is_active_supervisor()) with check (public.is_admin() or public.is_active_supervisor());
grant select, insert, update, delete on public.parent_links to authenticated;

create table if not exists public.parent_push (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.parent_links(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.parent_push enable row level security;
create policy parent_push_staff on public.parent_push for select to authenticated using (public.is_admin() or public.is_active_supervisor());
grant select on public.parent_push to authenticated;

create table if not exists public.session_acks (
  session_id uuid not null references public.sessions(id) on delete cascade,
  party text not null check (party in ('parent','tutor')),
  party_id uuid not null,
  acked_at timestamptz not null default now(),
  via text,
  primary key (session_id, party, party_id)
);
alter table public.session_acks enable row level security;
create policy session_acks_staff on public.session_acks for select to authenticated using (public.is_admin() or public.is_active_supervisor());
create policy session_acks_tutor on public.session_acks for select to authenticated using (party = 'tutor' and party_id = public.my_tutor_id());
grant select on public.session_acks to authenticated;

-- الأسرة من التوكن
create or replace function public.parent_family(p_token text) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select family_id from public.parent_links where token = p_token and not revoked limit 1
$$;

create or replace function public.parent_portal(p_token text) returns json
language plpgsql security definer set search_path to 'public' as $$
declare fid uuid; f public.families; res json;
begin
  fid := public.parent_family(p_token);
  if fid is null then return null; end if;
  update public.parent_links set last_seen = now() where token = p_token;
  select * into f from public.families where id = fid;
  select json_build_object(
    'family', json_build_object('id', f.id, 'name', f.name, 'country', f.country),
    'kids', coalesce((select json_agg(json_build_object('id', st.id, 'name', st.name, 'grade', st.grade_level) order by st.name) from public.students st where st.family_id = fid), '[]'::json),
    'upcoming', coalesce((select json_agg(x order by x.scheduled_at) from (
        select s.id, s.scheduled_at, s.duration_minutes, s.subject, s.kind, s.status, st.name as student_name,
          split_part(t.name, ' (', 1) as tutor_name, s.group_name,
          coalesce(s.meeting_link, (select ss.meeting_link from public.student_subjects ss where ss.student_id = s.student_id and ss.tutor_id = s.tutor_id and ss.meeting_link is not null limit 1), t.meeting_link) as meeting_link,
          exists(select 1 from public.session_acks a where a.session_id = s.id and a.party = 'parent' and a.party_id = fid) as acked
        from public.sessions s join public.students st on st.id = s.student_id join public.tutors t on t.id = s.tutor_id
        where st.family_id = fid and s.status in ('scheduled','in_progress')
          and s.scheduled_at >= now() - interval '3 hours' and s.scheduled_at < now() + interval '15 days') x), '[]'::json),
    'past', coalesce((select json_agg(x order by x.scheduled_at desc) from (
        select s.id, s.scheduled_at, coalesce(s.actual_minutes, s.duration_minutes) as minutes, s.subject, s.kind, st.name as student_name,
          split_part(t.name, ' (', 1) as tutor_name,
          (select json_build_object('attended', r.attended, 'topics', r.topics, 'homework', r.homework, 'level', r.level)
             from public.session_reports r where (r.session_id = s.id or (s.group_key is not null and r.group_key = s.group_key)) and r.sent_at is not null limit 1) as report
        from public.sessions s join public.students st on st.id = s.student_id join public.tutors t on t.id = s.tutor_id
        where st.family_id = fid and s.status = 'done' and s.scheduled_at >= now() - interval '45 days'
        order by s.scheduled_at desc limit 60) x), '[]'::json)
  ) into res;
  return res;
end $$;

create or replace function public.parent_ack(p_token text, p_session uuid, p_via text default 'portal') returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare fid uuid;
begin
  fid := public.parent_family(p_token);
  if fid is null then return false; end if;
  if not exists (select 1 from public.sessions s join public.students st on st.id = s.student_id where s.id = p_session and st.family_id = fid) then return false; end if;
  insert into public.session_acks(session_id, party, party_id, via) values (p_session, 'parent', fid, p_via) on conflict do nothing;
  return true;
end $$;

create or replace function public.parent_push_save(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare lid uuid;
begin
  select id into lid from public.parent_links where token = p_token and not revoked;
  if lid is null then return false; end if;
  insert into public.parent_push(link_id, endpoint, p256dh, auth, user_agent) values (lid, p_endpoint, p_p256dh, p_auth, left(p_ua, 200))
    on conflict (endpoint) do update set link_id = excluded.link_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
  return true;
end $$;

create or replace function public.parent_push_remove(p_token text, p_endpoint text) returns boolean
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.parent_push p using public.parent_links l where p.link_id = l.id and l.token = p_token and p.endpoint = p_endpoint;
  return true;
end $$;

create or replace function public.tutor_ack(p_session uuid) returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare tid uuid;
begin
  tid := public.my_tutor_id();
  if tid is null or not exists (select 1 from public.sessions where id = p_session and tutor_id = tid) then return false; end if;
  insert into public.session_acks(session_id, party, party_id, via) values (p_session, 'tutor', tid, 'portal') on conflict do nothing;
  return true;
end $$;

grant execute on function public.parent_portal(text), public.parent_ack(text, uuid, text), public.parent_push_save(text, text, text, text, text), public.parent_push_remove(text, text) to anon, authenticated;
grant execute on function public.tutor_ack(uuid) to authenticated;
revoke execute on function public.parent_family(text) from anon, authenticated, public;
