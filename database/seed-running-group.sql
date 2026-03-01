-- =============================================================
-- Seed: "Running More" group — 15 mock users with running goals
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================

do $$
declare
  gid uuid := gen_random_uuid();

  u1  uuid := gen_random_uuid();
  u2  uuid := gen_random_uuid();
  u3  uuid := gen_random_uuid();
  u4  uuid := gen_random_uuid();
  u5  uuid := gen_random_uuid();
  u6  uuid := gen_random_uuid();
  u7  uuid := gen_random_uuid();
  u8  uuid := gen_random_uuid();
  u9  uuid := gen_random_uuid();
  u10 uuid := gen_random_uuid();
  u11 uuid := gen_random_uuid();
  u12 uuid := gen_random_uuid();
  u13 uuid := gen_random_uuid();
  u14 uuid := gen_random_uuid();
  u15 uuid := gen_random_uuid();

  g1  uuid; g2  uuid; g3  uuid; g4  uuid; g5  uuid;
  g6  uuid; g7  uuid; g8  uuid; g9  uuid; g10 uuid;
  g11 uuid; g12 uuid; g13 uuid; g14 uuid; g15 uuid;

  ci1 uuid; ci2 uuid; ci3 uuid; ci4 uuid; ci5 uuid;
begin

-- =====================
-- 1. AUTH USERS
-- =====================
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
values
  (u1,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','marcus.j@mock.test',  crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Marcus Johnson"}'::jsonb,   now(),now(),'',''),
  (u2,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','sarah.l@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Sarah Liu"}'::jsonb,          now(),now(),'',''),
  (u3,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','james.o@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"James O''Brien"}'::jsonb,     now(),now(),'',''),
  (u4,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','priya.k@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Priya Kapoor"}'::jsonb,       now(),now(),'',''),
  (u5,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','david.r@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"David Reyes"}'::jsonb,        now(),now(),'',''),
  (u6,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','emma.t@mock.test',    crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Emma Thompson"}'::jsonb,      now(),now(),'',''),
  (u7,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','carlos.m@mock.test',  crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Carlos Mendez"}'::jsonb,      now(),now(),'',''),
  (u8,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','aisha.w@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Aisha Williams"}'::jsonb,     now(),now(),'',''),
  (u9,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ben.k@mock.test',     crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Ben Kim"}'::jsonb,            now(),now(),'',''),
  (u10, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','olivia.n@mock.test',  crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Olivia Nguyen"}'::jsonb,      now(),now(),'',''),
  (u11, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','tyler.b@mock.test',   crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Tyler Brooks"}'::jsonb,       now(),now(),'',''),
  (u12, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','mia.c@mock.test',     crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Mia Chen"}'::jsonb,           now(),now(),'',''),
  (u13, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','jordan.f@mock.test',  crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Jordan Foster"}'::jsonb,      now(),now(),'',''),
  (u14, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','nina.s@mock.test',    crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Nina Sandoval"}'::jsonb,      now(),now(),'',''),
  (u15, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','alex.p@mock.test',    crypt('MockPass1!',gen_salt('bf')),now(),'{"name":"Alex Petrov"}'::jsonb,        now(),now(),'','');

-- profiles are auto-created by the handle_new_user trigger

-- =====================
-- 2. GROUP + MEMBERS
-- =====================
insert into public.groups (id, name, invite_code, created_by)
values (gid, 'Running More', 'RUN2026', u1);

insert into public.group_members (group_id, user_id) values
  (gid,u1),(gid,u2),(gid,u3),(gid,u4),(gid,u5),
  (gid,u6),(gid,u7),(gid,u8),(gid,u9),(gid,u10),
  (gid,u11),(gid,u12),(gid,u13),(gid,u14),(gid,u15);

-- =====================
-- 3. GOALS (one per user, shared to group)
-- =====================

-- u1 Marcus — complete beginner, overweight, wants to start jogging
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u1, 'Run my first full mile without stopping',
  'I''m 240 lbs and haven''t run since high school PE. My doctor recommended I start moving more after my last checkup. I get winded walking up two flights of stairs. I want to be able to run a full mile by summer — no walking breaks. Starting with run/walk intervals on a treadmill because I''m self-conscious about running outside.',
  'daily', array['Walk 5 min warmup','Jog 60s / walk 90s x 8','Cool-down stretch 5 min','Log how I felt'], '2026-03-01', '2026-06-01', now() - interval '10 days')
returning id into g1;

-- u2 Sarah — intermediate, training for first 5k race
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u2, 'Finish a 5K under 30 minutes',
  'I''ve been jogging casually for about 6 months, usually 1-2 miles at a time. I signed up for the City Fun Run 5K on May 10. My current pace is about 11:30/mile and I want to get it under 9:40/mile. Biggest issue is I always start too fast and die out at mile 2. Need to learn pacing.',
  'daily', array['Dynamic warmup','Run at target pace (9:40/mi)','Negative split on last mile','Post-run foam roll'], '2026-03-01', '2026-05-10', now() - interval '14 days')
returning id into g2;

-- u3 James — recovering from injury, building back up
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u3, 'Return to running post-knee surgery',
  'Had ACL reconstruction 4 months ago. PT cleared me for light jogging two weeks ago. I used to run half marathons but now I can barely do a slow quarter mile. It''s frustrating and honestly depressing. I need to rebuild without reinjuring myself — my PT said to cap it at 15 min of jogging for the first month and increase by 10% per week.',
  'custom', array['5 min walk','Jog at conversational pace','Stop if any sharp pain','Ice knee after','Log pain level 1-10'], '2026-02-15', '2026-08-01', now() - interval '18 days')
returning id into g3;

-- u4 Priya — stress runner, wants consistency
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u4, 'Run 4 days a week consistently',
  'I love running when I do it but I''m so inconsistent. Some weeks I run every day, then I won''t run for three weeks. It''s tied to my anxiety — I either over-exercise or can''t get off the couch. My therapist suggested setting a moderate, sustainable schedule instead of all-or-nothing. 4 days/week, 20-30 min each, no pressure on pace.',
  'weekly', array['Mon: easy 20 min','Wed: 25 min moderate','Fri: 30 min long run','Sun: 20 min recovery jog'], '2026-03-01', null, now() - interval '8 days')
returning id into g4;

-- u5 David — wants to lose weight through running
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u5, 'Lose 30 lbs with a running program',
  'I''m 5''9 and 215 lbs. Running was recommended by my nutritionist alongside a calorie deficit. I need to burn ~300 cal per run. My knees hurt when I run on concrete so I stick to the track or trails. I also eat emotionally after runs — I "reward" myself with junk food which cancels the effort. Need accountability on both running AND not binge-eating after.',
  'daily', array['Run 30 min (track or trail)','No food reward — drink water','Log calories in app','Weigh in weekly'], '2026-03-01', '2026-09-01', now() - interval '12 days')
returning id into g5;

-- u6 Emma — trail runner, wants to go longer
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u6, 'Complete a trail half marathon',
  'I''ve been trail running for a year, comfortably doing 6-8 mile runs on weekends. I want to push to 13.1 on trails by October. The main challenge is elevation — my local trails have 800ft of gain and I walk all the uphills. I also need to figure out nutrition mid-run because I bonk hard after mile 8.',
  'weekly', array['Tues: hill repeats 40 min','Thurs: easy road 5 mi','Sat: long trail run (add 1 mi/wk)','Practice eating gels on long run'], '2026-03-01', '2026-10-15', now() - interval '6 days')
returning id into g6;

-- u7 Carlos — social runner, motivated by group
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u7, 'Join a run club and run 3x a week',
  'I only run when other people are around — solo runs are boring and I quit after 10 minutes. I moved to a new city and don''t know anyone. Joining this group and a local run club to force myself out. I can do about 2 miles at a 10:00 pace. I want to build to 5 miles comfortably and actually make some friends doing it.',
  'weekly', array['Tues: run club meetup','Thurs: solo easy run','Sat: park run with anyone available'], '2026-03-01', null, now() - interval '5 days')
returning id into g7;

-- u8 Aisha — morning runner, fighting schedule
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u8, 'Become a 5 AM runner',
  'I''m a single mom with two kids. The ONLY time I have to run is before they wake up at 6:30. I''ve tried getting up at 5 AM to run but I keep hitting snooze. By the time the kids are in bed I''m too exhausted. Running is the one thing that keeps my mental health in check. I need a system to actually get out the door — maybe sleeping in my running clothes, prepping everything the night before.',
  'daily', array['Lay out clothes night before','Alarm at 4:55 — NO snooze','Out the door by 5:10','Run 25-35 min','Shower before kids wake'], '2026-03-01', null, now() - interval '20 days')
returning id into g8;

-- u9 Ben — speed-focused, wants a faster 10K
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u9, 'Break 45 minutes in the 10K',
  'Current 10K PR is 48:12. I''ve been stuck at this level for over a year. I run 5 days a week but it''s all the same pace — easy jogs. I know I need to add intervals and tempo runs but I hate them. My VO2max is decent (46) but my lactate threshold pace is slow. Need structured speedwork 2x/week.',
  'daily', array['Mon: easy 5 mi','Tues: 800m intervals x 6','Thurs: tempo run 4 mi','Sat: long run 8-10 mi','Sun: recovery jog'], '2026-03-01', '2026-07-01', now() - interval '15 days')
returning id into g9;

-- u10 Olivia — runs for mental health
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u10, 'Run 20 minutes daily for my depression',
  'My psychiatrist and I agreed I''d try exercise before adding another medication. I have moderate depression and running is supposed to help with serotonin. I don''t care about pace or distance — I just need to get out and move for 20 minutes every single day. Even on bad days. Especially on bad days. The streak matters more than the speed.',
  'daily', array['Put on shoes and step outside','Run/walk 20 min minimum','Rate mood before and after (1-10)','Journal 2 sentences about the run'], '2026-02-20', null, now() - interval '22 days')
returning id into g10;

-- u11 Tyler — former athlete, getting back in shape
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u11, 'Get back to my college running shape',
  'I ran D3 cross country — my 5K PR was 17:40. That was 8 years ago. Now I''m 30, work a desk job, and can barely hold 9:00/mile for two miles. It''s humbling. I don''t expect to hit 17:40 again but I want to break 22:00 in the 5K. I still remember proper training structure, I just need discipline and to accept I''m starting over.',
  'daily', array['Mon: easy 4 mi','Wed: track workout','Fri: tempo 3 mi','Sun: long run 7+ mi','Core and stretching daily'], '2026-03-01', '2026-08-01', now() - interval '9 days')
returning id into g11;

-- u12 Mia — treadmill-only, wants to run outside
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u12, 'Transition from treadmill to outdoor running',
  'I''ve been running on a treadmill for two years, usually 3 miles at 6.5 mph. But I tried running outside last week and could barely do 1.5 miles — the uneven ground, wind, and no pace guide messed me up. I want to run a full 5K outside comfortably. I also have mild social anxiety about running in public where people can see me.',
  'weekly', array['Tues: treadmill 3 mi (maintain base)','Thurs: outdoor run 20 min (quiet route)','Sat: outdoor run (gradually add 5 min)','Sun: walk the race route'], '2026-03-01', '2026-05-15', now() - interval '7 days')
returning id into g12;

-- u13 Jordan — ultramarathon aspirations
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u13, 'Train for my first 50K ultra',
  'I''ve done three road marathons (PR 3:42). Ready to try a 50K trail ultra in November. The distance doesn''t scare me but the terrain does — 6,000 feet of elevation gain. I need to build weekly mileage to 50+ and add serious climbing. Also need to practice running on tired legs (back-to-back long runs) and figure out a solid fueling strategy for 6+ hours.',
  'daily', array['Weekday: 6-8 mi with hills','Sat: long trail run','Sun: back-to-back medium trail','Practice fueling every 45 min','Strength train legs 2x/wk'], '2026-03-01', '2026-11-01', now() - interval '11 days')
returning id into g13;

-- u14 Nina — postpartum return to running
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u14, 'Return to running 6 months postpartum',
  'Had my baby in September. I ran through most of my pregnancy but stopped at 7 months. My pelvic floor is still weak — I leak a little when I run hard and it''s embarrassing. My OB said I can run but need to keep it easy and do pelvic floor exercises. I just want to feel like myself again. Pre-pregnancy I was running 25 miles/week.',
  'weekly', array['Mon/Wed/Fri: run/walk 20-25 min','Pelvic floor exercises daily','Stop if any pelvic pressure','Tues/Thurs: strength + core'], '2026-02-25', '2026-06-30', now() - interval '16 days')
returning id into g14;

-- u15 Alex — couch to half marathon challenge
insert into public.goals (user_id, title, description, frequency, checklist, start_date, end_date, created_at)
values (u15, 'Couch to half marathon in 6 months',
  'I made a bet with my brother that I''d run a half marathon by September. I have never run more than 0.5 miles in my life. I''m 26 and relatively fit from lifting but I have zero cardio base. I know this is aggressive but I''m competitive and stubborn. I need a real plan that won''t destroy my joints — I''m heavy (195 lbs) and my shins already ache from my first attempt.',
  'daily', array['Follow C25K program weeks 1-8','Transition to half marathon plan','Cross-train (bike or swim) 2x/wk','Ice shins after every run','Get fitted for real running shoes'], '2026-03-01', '2026-09-01', now() - interval '3 days')
returning id into g15;

-- =====================
-- 4. GOAL VISIBILITY (share all goals to the group)
-- =====================
insert into public.goal_visibility (goal_id, group_id) values
  (g1,gid),(g2,gid),(g3,gid),(g4,gid),(g5,gid),
  (g6,gid),(g7,gid),(g8,gid),(g9,gid),(g10,gid),
  (g11,gid),(g12,gid),(g13,gid),(g14,gid),(g15,gid);

-- =====================
-- 5. GOAL COMPLETIONS (realistic mixed history)
-- =====================

-- Marcus (u1) — spotty first week, getting better
insert into public.goal_completions (goal_id, date, reflection) values
  (g1, current_date - 9, 'Walked more than jogged but I did it'),
  (g1, current_date - 7, 'Made it through 6 intervals before quitting'),
  (g1, current_date - 6, 'Full 8 intervals! Lungs burning but proud'),
  (g1, current_date - 4, 'Skipped yesterday — back today, legs sore'),
  (g1, current_date - 3, 'Bumped jog to 90 seconds for the first 3 intervals'),
  (g1, current_date - 1, 'Rain but went anyway. Felt amazing after');

-- Sarah (u2) — very consistent
insert into public.goal_completions (goal_id, date, reflection) values
  (g2, current_date - 13, 'Easy 2 mi, focused on not going out too fast'),
  (g2, current_date - 12, '3 mi at 10:45 pace, felt controlled'),
  (g2, current_date - 11, 'Rest day — foam rolled instead'),
  (g2, current_date - 10, '2.5 mi with negative split! 11:00 then 10:20'),
  (g2, current_date - 9,  'Tempo run 2 mi at 9:50. Hard but doable'),
  (g2, current_date - 8,  'Easy 2 mi recovery'),
  (g2, current_date - 7,  'Long run 3.5 mi — first time over 5K distance!'),
  (g2, current_date - 5,  '3 mi at 10:30, legs felt heavy'),
  (g2, current_date - 4,  'Speed intervals: 4x400m at 8:30 pace'),
  (g2, current_date - 3,  'Easy 2 mi, felt smooth'),
  (g2, current_date - 2,  '3.1 mi in 30:45 — SO close to sub-30!'),
  (g2, current_date - 1,  'Rest day, stretching only');

-- James (u3) — cautious, some setbacks
insert into public.goal_completions (goal_id, date, reflection) values
  (g3, current_date - 16, '10 min jog, knee felt okay. Pain 2/10'),
  (g3, current_date - 14, '12 min jog, slight twinge at min 10. Pain 3/10'),
  (g3, current_date - 12, 'Skipped — knee was swollen. Iced all day. Frustrated.'),
  (g3, current_date - 10, '8 min very slow jog. Playing it safe. Pain 1/10'),
  (g3, current_date - 8,  '12 min jog, no pain! Best day yet'),
  (g3, current_date - 6,  '15 min jog — hit my cap. Felt great. Pain 0/10'),
  (g3, current_date - 4,  '15 min again. Confident enough to try 17 min next'),
  (g3, current_date - 2,  '17 min! Knee held up. Emotional about it honestly');

-- Priya (u4) — tracking weekly pattern
insert into public.goal_completions (goal_id, date, reflection) values
  (g4, current_date - 7, 'Monday run done. 22 min easy. Felt anxious before but calm after'),
  (g4, current_date - 5, 'Wednesday run. 25 min. Pushed pace a little too hard'),
  (g4, current_date - 3, 'Friday long run 28 min. Best run this week'),
  (g4, current_date - 1, 'Sunday recovery 18 min. 4 for 4 this week!!');

-- David (u5) — struggling with the food part
insert into public.goal_completions (goal_id, date, reflection) values
  (g5, current_date - 11, 'Ran 30 min on track. Then ate a whole pizza. Ugh.'),
  (g5, current_date - 10, 'Ran 25 min. Resisted the drive-thru! Small win.'),
  (g5, current_date - 8,  'Skipped run. Bad mental health day. Ate clean though.'),
  (g5, current_date - 7,  'Ran 30 min. Calories on target. Down 1.5 lbs this week'),
  (g5, current_date - 5,  '35 min on trails. Knees felt better on dirt.'),
  (g5, current_date - 4,  'Ran 30 min. Caught myself heading to Wendy''s — drove home instead'),
  (g5, current_date - 2,  'Weigh-in: 212.5. Down 2.5 lbs total. It''s working'),
  (g5, current_date - 1,  'Ran 32 min. Longest yet. Ate a normal dinner.');

-- Emma (u6) — weekend warrior pattern
insert into public.goal_completions (goal_id, date, reflection) values
  (g6, current_date - 5, 'Hill repeats on the fire road. 6 repeats, quads destroyed'),
  (g6, current_date - 3, 'Easy road 5 mi. Used it as active recovery'),
  (g6, current_date - 1, 'Long trail run 7.5 mi! Tried a gel at mile 5 — stomach okay');

-- Carlos (u7) — social runs tracked
insert into public.goal_completions (goal_id, date, reflection) values
  (g7, current_date - 4, 'Run club! 3 mi with a group of 8. Met two cool people'),
  (g7, current_date - 2, 'Solo run — only made it 15 min before quitting. Need people.'),
  (g7, current_date - 1, 'Park run 5K with a guy from run club. 31:42. Fun!');

-- Aisha (u8) — morning battle
insert into public.goal_completions (goal_id, date, reflection) values
  (g8, current_date - 19, 'Snoozed. Didn''t run. Felt guilty all day.'),
  (g8, current_date - 18, 'GOT UP! 5:05 AM out the door. Only 20 min but I DID IT'),
  (g8, current_date - 17, 'Snoozed again. Slept in running clothes for nothing'),
  (g8, current_date - 15, '5:08 AM. 25 min run. Kids didn''t even know I was gone'),
  (g8, current_date - 13, '5:02 AM! Getting easier. 28 min. Saw the sunrise.'),
  (g8, current_date - 12, 'Baby was up at 3 AM. Too tired. Grace for myself.'),
  (g8, current_date - 10, '5:00 AM sharp. 30 min. I am becoming a morning runner.'),
  (g8, current_date - 8,  '5:05 AM. 32 min. This is changing my whole mood for the day'),
  (g8, current_date - 6,  'Overslept to 5:40. Still got 20 min in before chaos'),
  (g8, current_date - 4,  '4:58 AM. 35 min! Personal best. Cried in the shower (happy tears)'),
  (g8, current_date - 2,  '5:03 AM. Easy 25 min. Consistency > perfection'),
  (g8, current_date - 1,  '5:00 AM. 30 min. 8 out of last 12 days. Getting there.');

-- Ben (u9) — structured training
insert into public.goal_completions (goal_id, date, reflection) values
  (g9, current_date - 14, 'Easy 5 mi. 8:45/mi. Felt flat.'),
  (g9, current_date - 13, '800m x 6 — averaged 3:22. Target is 3:15. Close.'),
  (g9, current_date - 11, 'Tempo 4 mi at 7:40/mi. Held on barely.'),
  (g9, current_date - 9,  'Long run 9 mi. Kept it easy, 8:50/mi'),
  (g9, current_date - 8,  'Recovery jog 3 mi'),
  (g9, current_date - 7,  'Easy 5 mi. Legs still tired from long run'),
  (g9, current_date - 6,  '800m x 6 — 3:18 avg! Getting faster'),
  (g9, current_date - 4,  'Tempo 4 mi at 7:35. Breakthrough!'),
  (g9, current_date - 2,  'Long run 10 mi. Negative split last 3 miles'),
  (g9, current_date - 1,  'Recovery 3 mi. Legs feel fresh for once');

-- Olivia (u10) — daily mental health streaker
insert into public.goal_completions (goal_id, date, reflection) values
  (g10, current_date - 21, 'Mood before: 3. After: 5. Walk/jogged 20 min. It helps.'),
  (g10, current_date - 20, 'Mood before: 2. After: 4. Barely got out the door.'),
  (g10, current_date - 19, 'Mood before: 4. After: 6. Good day! Ran 25 min.'),
  (g10, current_date - 18, 'Mood before: 1. After: 3. Cried during the run. Still went.'),
  (g10, current_date - 17, 'Mood before: 3. After: 5. Ran in the rain. Felt alive.'),
  (g10, current_date - 16, 'Mood before: 2. After: 2. Bad day. Run didn''t help. That''s okay.'),
  (g10, current_date - 15, 'Mood before: 3. After: 6. Ran with a podcast. Laughed out loud.'),
  (g10, current_date - 13, 'Mood before: 4. After: 6. Getting a streak going.'),
  (g10, current_date - 12, 'Mood before: 5. After: 7! Best mood in weeks.'),
  (g10, current_date - 11, 'Mood before: 3. After: 5. Consistent is the goal.'),
  (g10, current_date - 10, 'Mood before: 2. After: 4. Dragged myself out. Worth it.'),
  (g10, current_date - 9,  'Mood before: 4. After: 6. 14 day streak! Told my therapist.'),
  (g10, current_date - 8,  'Missed. Couldn''t get out of bed. Streak broken.'),
  (g10, current_date - 7,  'Mood before: 1. After: 3. Back at it. Starting over.'),
  (g10, current_date - 6,  'Mood before: 3. After: 5. New streak day 2.'),
  (g10, current_date - 4,  'Mood before: 4. After: 6. This is medicine.'),
  (g10, current_date - 3,  'Mood before: 3. After: 5. Steady.'),
  (g10, current_date - 2,  'Mood before: 5. After: 7. Smiled at a stranger. Progress.'),
  (g10, current_date - 1,  'Mood before: 4. After: 6. 6 day streak.');

-- Tyler (u11) — rebuilding former runner
insert into public.goal_completions (goal_id, date, reflection) values
  (g11, current_date - 8, 'Easy 3 mi. 9:15/mi. Humbling.'),
  (g11, current_date - 6, 'Track: 4x400 at 7:00 pace. Legs remembered something'),
  (g11, current_date - 5, 'Tempo 2 mi at 8:20. Felt like old times for 5 min'),
  (g11, current_date - 3, 'Long run 5 mi. Died at mile 4. Used to warm up with 5 mi.'),
  (g11, current_date - 1, 'Easy 4 mi. 8:50. Core work after. Body is responding.');

-- Mia (u12) — indoor to outdoor transition
insert into public.goal_completions (goal_id, date, reflection) values
  (g12, current_date - 6, 'Treadmill 3 mi. Comfortable. My safe space.'),
  (g12, current_date - 4, 'Outdoor 18 min. Took a quiet back street. No one saw me I think.'),
  (g12, current_date - 2, 'Outdoor 22 min! Got a little lost, which forced me to run farther lol'),
  (g12, current_date - 1, 'Walked the 5K route. It''s flat, that helps. Less scary now.');

-- Jordan (u13) — ultra training ramp-up
insert into public.goal_completions (goal_id, date, reflection) values
  (g13, current_date - 10, '7 mi with 1200ft gain. Power hiked the steeps.'),
  (g13, current_date - 8,  'Easy road 6 mi. Legs tired from Saturday'),
  (g13, current_date - 7,  'Back-to-back: 5 mi trail. Running on tired legs is a skill.'),
  (g13, current_date - 5,  '7 mi hilly. Practiced eating gel at mile 4 — no stomach issues'),
  (g13, current_date - 3,  'Strength: squats, lunges, step-ups. Legs are cooked.'),
  (g13, current_date - 1,  '9 mi trail! Longest since starting plan. Felt strong at the end.');

-- Nina (u14) — postpartum journey
insert into public.goal_completions (goal_id, date, reflection) values
  (g14, current_date - 15, 'Run/walk 20 min. No leaking! Pelvic floor exercises helping.'),
  (g14, current_date - 13, 'Run/walk 22 min. Slight leak on a hill. Adjusted intensity.'),
  (g14, current_date - 11, 'Strength day. Focused on glutes and core.'),
  (g14, current_date - 9,  '25 min run/walk. Felt like a runner again for a few minutes.'),
  (g14, current_date - 7,  'Run/walk 25 min. Baby slept through! Victory.'),
  (g14, current_date - 5,  'Strength + core. PT said I''m progressing well.'),
  (g14, current_date - 3,  '28 min! Ran more than walked for the first time.'),
  (g14, current_date - 1,  '25 min easy. Feeling confident. Body is healing.');

-- Alex (u15) — couch to half, early days
insert into public.goal_completions (goal_id, date, reflection) values
  (g15, current_date - 2, 'C25K W1D1. Jog 60s/walk 90s. Shins screaming. Iced after.'),
  (g15, current_date - 1, 'Rest day. Bought real running shoes — Brooks Ghost. Game changer already just walking in them.');

-- =====================
-- 6. CHECK-INS (a few users sharing mood with the group)
-- =====================
insert into public.check_ins (id, user_id, date, mood, reflection, created_at)
values
  (gen_random_uuid(), u1,  current_date - 3, 3, 'Feeling okay. Running is harder than I thought but I''m not quitting.', now())
returning id into ci1;
insert into public.check_in_visibility (check_in_id, group_id) values (ci1, gid);

insert into public.check_ins (id, user_id, date, mood, reflection, created_at)
values
  (gen_random_uuid(), u8,  current_date - 2, 5, 'Best week in months. Morning runs are literally saving me.', now())
returning id into ci2;
insert into public.check_in_visibility (check_in_id, group_id) values (ci2, gid);

insert into public.check_ins (id, user_id, date, mood, reflection, created_at)
values
  (gen_random_uuid(), u10, current_date - 1, 4, 'Streak is back. Therapist noticed I''m more engaged in sessions.', now())
returning id into ci3;
insert into public.check_in_visibility (check_in_id, group_id) values (ci3, gid);

insert into public.check_ins (id, user_id, date, mood, reflection, created_at)
values
  (gen_random_uuid(), u3,  current_date - 4, 2, 'Frustrated with how slow recovery is. Miss my old self.', now())
returning id into ci4;
insert into public.check_in_visibility (check_in_id, group_id) values (ci4, gid);

insert into public.check_ins (id, user_id, date, mood, reflection, created_at)
values
  (gen_random_uuid(), u5,  current_date - 1, 4, 'Scale is moving. Didn''t binge once this week. Huge for me.', now())
returning id into ci5;
insert into public.check_in_visibility (check_in_id, group_id) values (ci5, gid);

raise notice 'Seed complete — group "Running More" (invite code RUN2026) with 15 users';

end $$;
