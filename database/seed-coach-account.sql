-- =============================================================
-- Seed: Coach account with 2 months of check-ins and goals
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
--
-- Login: coach@flock.demo / CoachPass1!
--
-- Creates:
-- - 6 goals: Run 3x/week, 10k steps daily, Morning stretch,
--   1:1 with each report weekly, Team standup, Review priorities
-- - Goal completions spread over the last 60 days (for graphs)
-- - 60 check-ins with mood 2-5 and assorted reflections
--
-- Use this account to test Home graphs (weekly completions, mood)
-- and the AI coach.
-- =============================================================

do $$
declare
  coach_id uuid := gen_random_uuid();
  g1 uuid; g2 uuid; g3 uuid; g4 uuid; g5 uuid; g6 uuid;
  d date;
  i int;
  moods int[] := array[2, 3, 3, 4, 4, 4, 5, 3, 4, 5];
  refs text[] := array[
    'Good energy this morning.',
    'Struggled to get out of bed but ran anyway.',
    'Team standup went well.',
    'Had 1:1s with three reports.',
    'Skipped run, feeling guilty.',
    'Prioritized well today.',
    'Great workout, hit 10k steps.',
    'Stretched 15 min before work.',
    'Reviewed Q1 priorities with team.',
    'Feeling balanced.'
  ];
begin
  -- =====================
  -- 1. AUTH USER (coach)
  -- =====================
  -- All token columns must be '' not NULL to avoid "Database error querying schema" on login
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    coach_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'coach@flock.demo',
    crypt('CoachPass1!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Coach"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Identity (required for email sign-in)
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (
    coach_id,
    coach_id,
    coach_id,
    jsonb_build_object('sub', coach_id::text, 'email', 'coach@flock.demo'),
    'email',
    now(),
    now()
  );

  -- Profile (in case trigger doesn't run on direct auth insert)
  insert into public.profiles (id, email, name)
  values (coach_id, 'coach@flock.demo', 'Coach')
  on conflict (id) do update set email = excluded.email, name = excluded.name;

  -- =====================
  -- 2. GOALS (exercise + managing teams)
  -- =====================
  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, 'Run 3x per week',
     'Build consistency with three runs per week. Mix of easy and one longer run.',
     'weekly', array['Mon: easy 30 min', 'Wed: tempo 25 min', 'Sat: long 45 min'],
     current_date - interval '60 days', current_date + interval '90 days', now() - interval '60 days')
    returning id into g1;

  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, '10k steps daily',
     'Hit 10,000 steps every day. Use watch to track.',
     'daily', array['Morning walk', 'Lunch walk', 'Evening steps'],
     current_date - interval '60 days', null, now() - interval '55 days')
    returning id into g2;

  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, 'Morning stretch',
     '10 minutes of stretching before starting work. Reduces back pain.',
     'daily', array['Hip flexors', 'Hamstrings', 'Back', 'Shoulders'],
     current_date - interval '50 days', null, now() - interval '50 days')
    returning id into g3;

  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, '1:1 with each report weekly',
     'Schedule and complete a 30-min 1:1 with every direct report every week.',
     'weekly', array['Prep talking points', 'Send agenda', 'Take notes', 'Follow-up items'],
     current_date - interval '60 days', null, now() - interval '60 days')
    returning id into g4;

  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, 'Team standup',
     'Run daily 15-min standup. Keep it focused: blockers and priorities only.',
     'daily', array['Start on time', 'Each person: yesterday, today, blockers', 'End on time'],
     current_date - interval '60 days', null, now() - interval '58 days')
    returning id into g5;

  insert into public.goals (id, user_id, title, description, frequency, checklist, start_date, end_date, created_at)
  values
    (gen_random_uuid(), coach_id, 'Review team priorities',
     'Every Friday, review and update priorities for the team. Align with company goals.',
     'weekly', array['Review OKRs', 'Update board', 'Share with team', 'Send weekly summary'],
     current_date - interval '55 days', null, now() - interval '55 days')
    returning id into g6;

  -- =====================
  -- 3. GOAL COMPLETIONS (spread over 60 days for graphs)
  -- =====================
  for i in 0..59 loop
    d := current_date - (60 - i);
    -- Run 3x: ~3 days per week
    if extract(dow from d) in (1, 3, 6) and (i % 3 <> 0) then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g1, d, refs[1 + (i % 3)])
      on conflict (goal_id, date) do nothing;
    end if;
    -- 10k steps: most days
    if (i % 7) <> 2 and (i % 7) <> 5 then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g2, d, case when i % 4 = 0 then refs[7] else null end)
      on conflict (goal_id, date) do nothing;
    end if;
    -- Morning stretch: weekdays
    if extract(dow from d) between 1 and 5 and (i % 5 <> 1) then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g3, d, null)
      on conflict (goal_id, date) do nothing;
    end if;
    -- 1:1s: once per week (e.g. Friday)
    if extract(dow from d) = 5 then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g4, d, refs[4])
      on conflict (goal_id, date) do nothing;
    end if;
    -- Standup: every weekday
    if extract(dow from d) between 1 and 5 then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g5, d, refs[3])
      on conflict (goal_id, date) do nothing;
    end if;
    -- Review priorities: Friday
    if extract(dow from d) = 5 then
      insert into public.goal_completions (goal_id, date, reflection)
      values (g6, d, refs[9])
      on conflict (goal_id, date) do nothing;
    end if;
  end loop;

  -- =====================
  -- 4. CHECK-INS (2 months, varied mood + reflections)
  -- =====================
  for i in 0..59 loop
    d := current_date - (60 - i);
    insert into public.check_ins (user_id, date, mood, reflection)
    values (
      coach_id,
      d,
      moods[1 + (i % 10)],
      case when i % 3 = 0 then refs[1 + (i % 10)] else '' end
    )
    on conflict do nothing;
  end loop;

  raise notice 'Coach account created: coach@flock.demo / CoachPass1! (user_id: %)', coach_id;
end $$;
