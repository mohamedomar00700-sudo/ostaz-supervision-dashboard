-- أسعار المعلمات المؤقتة: حصة أولى اتسجلت بسعر المعلمة المعتاد لحد ما السعر المتفق عليه يتأكد
alter table public.sessions add column if not exists rate_tentative boolean not null default false;
alter table public.student_subjects add column if not exists rate_confirmed boolean not null default true;

create or replace function public.mark_tentative_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rate_tentative then
    if exists (select 1 from student_subjects where student_id = new.student_id and tutor_id = new.tutor_id) then
      update student_subjects set rate_confirmed = false, tutor_rate_egp = coalesce(tutor_rate_egp, new.tutor_cost_egp)
       where student_id = new.student_id and tutor_id = new.tutor_id and (tutor_rate_egp is null or rate_confirmed = false);
    else
      insert into student_subjects(student_id, tutor_id, subject, tutor_rate_egp, rate_confirmed)
      values (new.student_id, new.tutor_id, coalesce(new.subject, '—'), new.tutor_cost_egp, false);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_mark_tentative_rate on public.sessions;
create trigger trg_mark_tentative_rate after insert or update of rate_tentative on public.sessions
  for each row when (new.rate_tentative) execute function public.mark_tentative_rate();

create or replace function public.confirm_pair_rate(p_student uuid, p_tutor uuid, p_rate numeric) returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  update student_subjects set tutor_rate_egp = p_rate, rate_confirmed = true where student_id = p_student and tutor_id = p_tutor;
  update sessions set tutor_cost_egp = p_rate, rate_tentative = false where student_id = p_student and tutor_id = p_tutor and rate_tentative;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.confirm_pair_rate(uuid, uuid, numeric) to authenticated;
