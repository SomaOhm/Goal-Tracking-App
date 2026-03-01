-- =============================================================
-- MindBuddy Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- =============================================================

-- =====================
-- PART 1: CREATE TABLES
-- =====================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text not null default 'User',
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  frequency text not null check (frequency in ('daily', 'weekly', 'custom')),
  custom_days int[],
  checklist text[],
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.goal_completions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  date date not null,
  reflection text,
  created_at timestamptz not null default now(),
  unique(goal_id, date)
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mood int not null check (mood >= 1 and mood <= 5),
  reflection text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.goal_visibility (
  goal_id uuid not null references public.goals(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (goal_id, group_id)
);

create table if not exists public.check_in_visibility (
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (check_in_id, group_id)
);

-- =====================
-- PART 2: INDEXES
-- =====================

create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goal_completions_goal_date on public.goal_completions(goal_id, date);
create index if not exists idx_check_ins_user_date on public.check_ins(user_id, date);
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_groups_invite_code on public.groups(invite_code);

-- =====================
-- PART 3: ENABLE RLS
-- =====================

alter table public.profiles enable row level security;
alter table public.goals enable row level security;
alter table public.goal_completions enable row level security;
alter table public.check_ins enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.goal_visibility enable row level security;
alter table public.check_in_visibility enable row level security;

-- =====================
-- PART 4: RLS POLICIES
-- =====================

-- profiles
create policy "Users can read all profiles"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- goals
create policy "Users can read own goals"
  on public.goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals"
  on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals"
  on public.goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals"
  on public.goals for delete using (auth.uid() = user_id);

-- goal_completions
create policy "Users can read own goal completions"
  on public.goal_completions for select
  using (exists (
    select 1 from public.goals where goals.id = goal_completions.goal_id and goals.user_id = auth.uid()
  ));
create policy "Group members can read shared goal completions"
  on public.goal_completions for select
  using (exists (
    select 1 from public.goal_visibility gv
    join public.group_members gm on gm.group_id = gv.group_id
    where gv.goal_id = goal_completions.goal_id and gm.user_id = auth.uid()
  ));
create policy "Users can insert own goal completions"
  on public.goal_completions for insert
  with check (exists (
    select 1 from public.goals where goals.id = goal_completions.goal_id and goals.user_id = auth.uid()
  ));
create policy "Users can delete own goal completions"
  on public.goal_completions for delete
  using (exists (
    select 1 from public.goals where goals.id = goal_completions.goal_id and goals.user_id = auth.uid()
  ));

-- check_ins
create policy "Users can read own check-ins"
  on public.check_ins for select using (auth.uid() = user_id);
create policy "Users can insert own check-ins"
  on public.check_ins for insert with check (auth.uid() = user_id);

-- groups
create policy "Anyone can read groups"
  on public.groups for select using (true);
create policy "Authenticated users can create groups"
  on public.groups for insert with check (auth.uid() = created_by);
create policy "Creators can delete own groups"
  on public.groups for delete using (auth.uid() = created_by);

-- group_members (using security definer to avoid infinite recursion)
create or replace function public.is_group_member(gid uuid)
returns boolean as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$ language sql security definer stable;

create policy "Members can see group membership"
  on public.group_members for select
  using (public.is_group_member(group_id));
create policy "Authenticated users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);
create policy "Users can leave groups"
  on public.group_members for delete using (auth.uid() = user_id);

-- goal_visibility
create policy "Goal owners manage visibility"
  on public.goal_visibility for all
  using (exists (
    select 1 from public.goals where goals.id = goal_visibility.goal_id and goals.user_id = auth.uid()
  ));
create policy "Group members can see shared goals"
  on public.goal_visibility for select
  using (exists (
    select 1 from public.group_members where group_members.group_id = goal_visibility.group_id and group_members.user_id = auth.uid()
  ));

-- check_in_visibility
create policy "Check-in owners manage visibility"
  on public.check_in_visibility for all
  using (exists (
    select 1 from public.check_ins where check_ins.id = check_in_visibility.check_in_id and check_ins.user_id = auth.uid()
  ));
create policy "Group members can see shared check-ins"
  on public.check_in_visibility for select
  using (exists (
    select 1 from public.group_members where group_members.group_id = check_in_visibility.group_id and group_members.user_id = auth.uid()
  ));

-- =====================
-- PART 5: RPC FUNCTIONS (shared data across groups)
-- =====================

create or replace function public.get_shared_goals()
returns setof public.goals as $$
  select distinct g.*
  from public.goals g
  join public.goal_visibility gv on gv.goal_id = g.id
  join public.group_members gm on gm.group_id = gv.group_id
  where gm.user_id = auth.uid() and g.user_id != auth.uid();
$$ language sql security definer stable;

create or replace function public.get_shared_check_ins()
returns setof public.check_ins as $$
  select distinct ci.*
  from public.check_ins ci
  join public.check_in_visibility civ on civ.check_in_id = ci.id
  join public.group_members gm on gm.group_id = civ.group_id
  where gm.user_id = auth.uid() and ci.user_id != auth.uid();
$$ language sql security definer stable;

-- =====================
-- PART 6: TRIGGER
-- =====================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'User')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
