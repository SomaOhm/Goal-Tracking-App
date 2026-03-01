import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

export interface User { id: string; email: string; name: string; avatar?: string }
export interface Goal {
  id: string; userId: string; title: string; description: string;
  frequency: 'daily' | 'weekly' | 'custom'; customDays?: number[]; checklist?: string[];
  startDate?: string; endDate?: string;
  completions: { date: string; reflection?: string }[]; visibleToGroups: string[]; createdAt: string;
}
export interface CheckIn { id: string; userId: string; date: string; mood: number; reflection: string; visibleToGroups: string[] }
export interface Group { id: string; name: string; inviteCode: string; members: string[]; createdBy: string; createdAt: string }

interface AppContextType {
  user: User | null; users: User[]; goals: Goal[]; checkIns: CheckIn[]; groups: Group[]; apiReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  addGoal: (goal: Omit<Goal, 'id' | 'userId' | 'completions' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  completeGoal: (goalId: string, date: string, reflection?: string) => void;
  addCheckIn: (checkIn: Omit<CheckIn, 'id' | 'userId'>) => void;
  createGroup: (name: string) => Group;
  joinGroup: (inviteCode: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

interface GoalRow {
  id: string; user_id: string; title: string; description: string;
  frequency: 'daily' | 'weekly' | 'custom'; custom_days: number[] | null; checklist: string[] | null;
  start_date: string | null; end_date: string | null;
  created_at: string; goal_completions: { date: string; reflection: string | null }[];
  goal_visibility?: { group_id: string }[] | null;
}
function toGroupIds(vis: unknown): string[] {
  if (!vis) return [];
  const arr = Array.isArray(vis) ? vis : [vis];
  return arr.map((v: unknown) => (v && typeof v === 'object' && 'group_id' in v) ? (v as { group_id: string }).group_id : '').filter(Boolean);
}

/** Normalize group_ids from RPC (PostgREST may return UUID[] as array or as string). */
function normalizeGroupIds(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x)).filter(Boolean);
  if (typeof val === 'string') {
    if (val.startsWith('[')) try { return JSON.parse(val).map((x: unknown) => String(x)); } catch { return []; }
    if (val.includes(',')) return val.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    return val ? [val] : [];
  }
  return [];
}
const rowToGoal = (r: GoalRow): Goal => ({
  id: r.id, userId: r.user_id, title: r.title, description: r.description ?? '',
  frequency: r.frequency, customDays: r.custom_days ?? undefined, checklist: r.checklist ?? undefined,
  startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
  completions: (r.goal_completions ?? []).map(c => ({ date: c.date, reflection: c.reflection ?? undefined })),
  visibleToGroups: toGroupIds(r.goal_visibility), createdAt: r.created_at,
});

interface CheckInRow {
  id: string; user_id: string; date: string; mood: number; reflection: string;
  check_in_visibility: { group_id: string }[];
}
const rowToCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id, userId: r.user_id, date: r.date, mood: r.mood, reflection: r.reflection ?? '',
  visibleToGroups: (r.check_in_visibility ?? []).map(v => v.group_id),
});

interface GroupMemberRow {
  group_id: string; user_id: string;
  groups: { id: string; name: string; invite_code: string; created_by: string; created_at: string };
}

function authToUser(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }, fallbackName?: string): User {
  return { id: u.id, email: u.email ?? '', name: (u.user_metadata?.name as string) ?? fallbackName ?? 'User', avatar: undefined };
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [apiReady, setApiReady] = useState(!isSupabaseEnabled());

  const fetchGoals = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('goals')
      .select('*, goal_completions(date, reflection), goal_visibility(group_id)')
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchGoals', error.message); return; }
    const allGoals = (data as GoalRow[]).map(rowToGoal);

    try {
      const { data: withVis } = await supabase.rpc('get_shared_goals_with_visibility');
      if (withVis?.length) {
        const ids = new Set(allGoals.map(g => g.id));
        const sharedGoalIds: string[] = [];
        for (const r of withVis) {
          if (ids.has(r.id)) continue;
          const groupIds = normalizeGroupIds(r.group_ids);
          sharedGoalIds.push(r.id);
          allGoals.push({
            id: r.id, userId: r.user_id, title: r.title, description: r.description ?? '', frequency: r.frequency,
            customDays: r.custom_days ?? undefined, checklist: r.checklist ?? undefined, startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
            completions: [], visibleToGroups: groupIds, createdAt: r.created_at,
          });
        }
        if (sharedGoalIds.length > 0) {
          const { data: comps } = await supabase.from('goal_completions').select('goal_id, date, reflection').in('goal_id', sharedGoalIds);
          if (comps?.length) {
            for (const c of comps as { goal_id: string; date: string; reflection: string | null }[]) {
              const g = allGoals.find((x) => x.id === c.goal_id);
              if (g) g.completions.push({ date: c.date, reflection: c.reflection ?? undefined });
            }
          }
        }
        setGoals(allGoals);
        return;
      }
      const { data: shared } = await supabase.rpc('get_shared_goals');
      if (shared?.length) {
        const ids = new Set(allGoals.map(g => g.id));
        const sharedIds = shared.map((r: { id: string }) => r.id).filter((id: string) => !ids.has(id));
        let visibilityMap: Record<string, string[]> = {};
        if (sharedIds.length > 0) {
          const { data: vis } = await supabase.from('goal_visibility').select('goal_id, group_id').in('goal_id', sharedIds);
          if (vis?.length) {
            for (const v of vis as { goal_id: string; group_id: string }[]) {
              if (!visibilityMap[v.goal_id]) visibilityMap[v.goal_id] = [];
              visibilityMap[v.goal_id].push(v.group_id);
            }
          }
        }
        for (const r of shared) {
          if (!ids.has(r.id)) allGoals.push({
            id: r.id, userId: r.user_id, title: r.title, description: r.description ?? '', frequency: r.frequency,
            customDays: r.custom_days ?? undefined, checklist: r.checklist ?? undefined, startDate: r.start_date ?? undefined, endDate: r.end_date ?? undefined,
            completions: [], visibleToGroups: visibilityMap[r.id] ?? [], createdAt: r.created_at,
          });
        }
        if (sharedIds.length > 0) {
          const { data: comps } = await supabase.from('goal_completions').select('goal_id, date, reflection').in('goal_id', sharedIds);
          if (comps?.length) {
            for (const c of comps as { goal_id: string; date: string; reflection: string | null }[]) {
              const g = allGoals.find((x) => x.id === c.goal_id);
              if (g) g.completions.push({ date: c.date, reflection: c.reflection ?? undefined });
            }
          }
        }
      }
    } catch {}

    setGoals(allGoals);
  }, []);

  const fetchCheckIns = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('check_ins')
      .select('*, check_in_visibility(group_id)')
      .order('date', { ascending: false });
    if (error) { console.error('fetchCheckIns', error.message); return; }
    const allCIs = (data as CheckInRow[]).map(rowToCheckIn);

    try {
      const { data: withVis } = await supabase.rpc('get_shared_check_ins_with_visibility');
      if (withVis?.length) {
        const ids = new Set(allCIs.map(c => c.id));
        for (const r of withVis) {
          if (ids.has(r.id)) continue;
          const groupIds = normalizeGroupIds(r.group_ids);
          allCIs.push({ id: r.id, userId: r.user_id, date: r.date, mood: r.mood, reflection: r.reflection ?? '', visibleToGroups: groupIds });
        }
        setCheckIns(allCIs);
        return;
      }
      const { data: shared } = await supabase.rpc('get_shared_check_ins');
      if (shared?.length) {
        const ids = new Set(allCIs.map(c => c.id));
        const sharedIds = shared.map((r: { id: string }) => r.id).filter((id: string) => !ids.has(id));
        let visibilityMap: Record<string, string[]> = {};
        if (sharedIds.length > 0) {
          const { data: vis } = await supabase.from('check_in_visibility').select('check_in_id, group_id').in('check_in_id', sharedIds);
          if (vis?.length) {
            for (const v of vis as { check_in_id: string; group_id: string }[]) {
              if (!visibilityMap[v.check_in_id]) visibilityMap[v.check_in_id] = [];
              visibilityMap[v.check_in_id].push(v.group_id);
            }
          }
        }
        for (const r of shared) {
          if (!ids.has(r.id)) allCIs.push({ id: r.id, userId: r.user_id, date: r.date, mood: r.mood, reflection: r.reflection ?? '', visibleToGroups: visibilityMap[r.id] ?? [] });
        }
      }
    } catch {}

    setCheckIns(allCIs);
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!supabase) return;
    const { data: { user: au } } = await supabase.auth.getUser();
    if (!au) return;
    const { data, error } = await supabase.from('group_members')
      .select('group_id, user_id, groups(id, name, invite_code, created_by, created_at)')
      .order('joined_at', { ascending: false });
    if (error) { console.error('fetchGroups', error.message); return; }

    const map = new Map<string, Group>();
    for (const row of data as GroupMemberRow[]) {
      const g = row.groups;
      if (!g) continue;
      if (!map.has(g.id)) map.set(g.id, { id: g.id, name: g.name, inviteCode: g.invite_code, members: [], createdBy: g.created_by, createdAt: g.created_at });
      map.get(g.id)!.members.push(row.user_id);
    }
    const list = [...map.values()];
    setGroups(list);

    const ids = [...new Set(list.flatMap(g => g.members))];
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, email, name, avatar').in('id', ids);
      if (profiles) setUsers(profiles as User[]);
    }
  }, []);

  const fetchAll = useCallback(() =>
    Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {}),
    [fetchGoals, fetchCheckIns, fetchGroups]
  );

  useEffect(() => {
    if (!supabase) {
      const stored = (k: string) => localStorage.getItem(k);
      const parse = <T,>(k: string): T | null => { const v = stored(k); return v ? JSON.parse(v) : null; };

      if (!stored('hasInitialized')) {
        const today = new Date(), yesterday = new Date(today), twoDaysAgo = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const demoUsers: User[] = [
          { id: 'demo_user_1', email: 'alex@example.com', name: 'Alex' },
          { id: 'demo_user_2', email: 'sam@example.com', name: 'Sam' },
          { id: 'demo_user_3', email: 'jordan@example.com', name: 'Jordan' },
        ];
        const demoGroup: Group = { id: 'demo_group_1', name: 'Wellness Warriors', inviteCode: 'DEMO99', members: ['demo_user_1', 'demo_user_2', 'demo_user_3'], createdBy: 'demo_user_1', createdAt: new Date().toISOString() };
        const demoGoals: Goal[] = [
          { id: 'demo_goal_1', userId: 'demo_user_1', title: 'Morning Meditation', description: '10 minutes of mindfulness', frequency: 'daily', completions: [{ date: format(today, 'yyyy-MM-dd') }, { date: format(yesterday, 'yyyy-MM-dd') }, { date: format(twoDaysAgo, 'yyyy-MM-dd') }], visibleToGroups: ['demo_group_1'], createdAt: twoDaysAgo.toISOString() },
          { id: 'demo_goal_2', userId: 'demo_user_2', title: 'Gratitude Journal', description: "Write 3 things I'm grateful for", frequency: 'daily', completions: [{ date: format(today, 'yyyy-MM-dd'), reflection: 'Feeling thankful for my friends today' }, { date: format(yesterday, 'yyyy-MM-dd') }], visibleToGroups: ['demo_group_1'], createdAt: yesterday.toISOString() },
        ];
        const demoCIs: CheckIn[] = [
          { id: 'demo_checkin_1', userId: 'demo_user_1', date: format(today, 'yyyy-MM-dd'), mood: 4, reflection: 'Had a productive morning! Feeling good.', visibleToGroups: ['demo_group_1'] },
          { id: 'demo_checkin_2', userId: 'demo_user_2', date: format(today, 'yyyy-MM-dd'), mood: 5, reflection: 'Great day with lots of positive energy', visibleToGroups: ['demo_group_1'] },
        ];
        localStorage.setItem('users', JSON.stringify(demoUsers));
        localStorage.setItem('groups', JSON.stringify([demoGroup]));
        localStorage.setItem('goals', JSON.stringify(demoGoals));
        localStorage.setItem('checkIns', JSON.stringify(demoCIs));
        localStorage.setItem('hasInitialized', 'true');
        setUsers(demoUsers); setGroups([demoGroup]); setGoals(demoGoals); setCheckIns(demoCIs);
      }
      setUser(parse('currentUser')); setUsers(prev => parse('users') ?? prev);
      setGoals(prev => parse('goals') ?? prev); setCheckIns(prev => parse('checkIns') ?? prev);
      setGroups(prev => parse('groups') ?? prev); setApiReady(true);
      return;
    }

    async function resolveUser(au: { id: string; email?: string; user_metadata?: Record<string, unknown> }) {
      const { data } = await supabase.from('profiles').select('id, email, name, avatar').eq('id', au.id).single();
      return data ? (data as User) : authToUser(au);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setApiReady(true); }, 3000);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        clearTimeout(timeout);
        if (session?.user) { setUser(await resolveUser(session.user)); await fetchAll(); }
      } catch { clearTimeout(timeout); }
      setApiReady(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (ev, session) => {
      if (ev === 'SIGNED_OUT' || !session?.user) { setUser(null); setGoals([]); setCheckIns([]); setGroups([]); setUsers([]); return; }
      if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') setUser(await resolveUser(session.user));
    });

    return () => subscription.unsubscribe();
  }, [fetchGoals, fetchCheckIns, fetchGroups, fetchAll]);

  useEffect(() => { if (!isSupabaseEnabled() && user) localStorage.setItem('currentUser', JSON.stringify(user)); else if (!isSupabaseEnabled()) localStorage.removeItem('currentUser'); }, [user]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('users', JSON.stringify(users)); }, [users]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('goals', JSON.stringify(goals)); }, [goals]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('checkIns', JSON.stringify(checkIns)); }, [checkIns]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('groups', JSON.stringify(groups)); }, [groups]);

  const login = async (email: string, password: string) => {
    if (supabase) {
      const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 10000, 'Login timed out. Please try again.');
      if (error) throw new Error(error.message);
      if (data.session?.user) setUser(authToUser(data.session.user));
      await fetchAll();
      return;
    }
    const found = users.find(u => u.email === email);
    if (!found) throw new Error('User not found');
    setUser(found);
  };

  const signup = async (email: string, password: string, name: string) => {
    if (supabase) {
      const { data, error } = await withTimeout(supabase.auth.signUp({ email, password, options: { data: { name } } }), 10000, 'Sign up timed out. Please try again.');
      if (error) throw new Error(error.message);
      if (!data.session) throw new Error('Check your email to confirm your account before logging in.');
      setUser(authToUser(data.session.user, name));
      await fetchAll();
      return;
    }
    if (users.find(u => u.email === email)) throw new Error('User already exists');
    const nu: User = { id: `user_${Date.now()}`, email, name };
    setUsers(prev => [...prev, nu]); setUser(nu);
  };

  const logout = () => { if (supabase) { supabase.auth.signOut(); return; } setUser(null); };

  const addGoal = (goal: Omit<Goal, 'id' | 'userId' | 'completions' | 'createdAt'>) => {
    if (!user) return;
    if (supabase) {
      (async () => {
        const { data, error } = await supabase.from('goals')
          .insert({ user_id: user.id, title: goal.title, description: goal.description, frequency: goal.frequency, custom_days: goal.customDays ?? null, checklist: goal.checklist ?? null, start_date: goal.startDate ?? null, end_date: goal.endDate ?? null })
          .select('*, goal_completions(date, reflection), goal_visibility(group_id)').single();
        if (error) { console.error('addGoal', error.message); return; }
        const ng = rowToGoal(data as GoalRow);
        if (goal.visibleToGroups?.length) {
          await supabase.from('goal_visibility').insert(goal.visibleToGroups.map(gid => ({ goal_id: ng.id, group_id: gid })));
          ng.visibleToGroups = goal.visibleToGroups;
        }
        setGoals(prev => [ng, ...prev]);
      })();
      return;
    }
    setGoals(prev => [...prev, { ...goal, id: `goal_${Date.now()}`, userId: user.id, completions: [], createdAt: new Date().toISOString() }]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    if (supabase) {
      (async () => {
        const db: Record<string, unknown> = {};
        if (updates.title !== undefined) db.title = updates.title;
        if (updates.description !== undefined) db.description = updates.description;
        if (updates.frequency !== undefined) db.frequency = updates.frequency;
        if (updates.customDays !== undefined) db.custom_days = updates.customDays;
        if (updates.checklist !== undefined) db.checklist = updates.checklist;
        if (updates.startDate !== undefined) db.start_date = updates.startDate;
        if (updates.endDate !== undefined) db.end_date = updates.endDate;
        if (Object.keys(db).length) { const { error } = await supabase.from('goals').update(db).eq('id', id); if (error) return; }
        if (updates.visibleToGroups !== undefined) {
          await supabase.from('goal_visibility').delete().eq('goal_id', id);
          if (updates.visibleToGroups.length) await supabase.from('goal_visibility').insert(updates.visibleToGroups.map(gid => ({ goal_id: id, group_id: gid })));
        }
        setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      })();
      return;
    }
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const deleteGoal = (id: string) => {
    if (supabase) { supabase.from('goals').delete().eq('id', id).then(({ error }) => { if (!error) setGoals(prev => prev.filter(g => g.id !== id)); }); return; }
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const completeGoal = (goalId: string, date: string, reflection?: string) => {
    if (supabase) {
      (async () => {
        const exists = goals.find(g => g.id === goalId)?.completions.some(c => c.date === date);
        if (exists) {
          await supabase.from('goal_completions').delete().match({ goal_id: goalId, date });
          setGoals(prev => prev.map(g => g.id === goalId ? { ...g, completions: g.completions.filter(c => c.date !== date) } : g));
        } else {
          await supabase.from('goal_completions').insert({ goal_id: goalId, date, reflection: reflection ?? null });
          setGoals(prev => prev.map(g => g.id === goalId ? { ...g, completions: [...g.completions, { date, reflection }] } : g));
        }
      })();
      return;
    }
    setGoals(prev => prev.map(g => {
      if (g.id !== goalId) return g;
      return g.completions.some(c => c.date === date)
        ? { ...g, completions: g.completions.filter(c => c.date !== date) }
        : { ...g, completions: [...g.completions, { date, reflection }] };
    }));
  };

  const addCheckIn = (ci: Omit<CheckIn, 'id' | 'userId'>) => {
    if (!user) return;
    if (supabase) {
      (async () => {
        const { data, error } = await supabase.from('check_ins')
          .insert({ user_id: user.id, date: ci.date, mood: ci.mood, reflection: ci.reflection })
          .select('*, check_in_visibility(group_id)').single();
        if (error) return;
        const nc = rowToCheckIn(data as CheckInRow);
        if (ci.visibleToGroups?.length) {
          await supabase.from('check_in_visibility').insert(ci.visibleToGroups.map(gid => ({ check_in_id: nc.id, group_id: gid })));
          nc.visibleToGroups = ci.visibleToGroups;
        }
        setCheckIns(prev => [nc, ...prev]);
      })();
      return;
    }
    setCheckIns(prev => [{ ...ci, id: `checkin_${Date.now()}`, userId: user.id }, ...prev]);
  };

  const createGroup = (name: string): Group => {
    if (!user) throw new Error('Must be logged in');
    if (supabase) {
      let created: Group = null!;
      (async () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data, error } = await supabase.from('groups').insert({ name, invite_code: code, created_by: user.id }).select().single();
        if (error) return;
        await supabase.from('group_members').insert({ group_id: data.id, user_id: user.id });
        created = { id: data.id, name: data.name, inviteCode: data.invite_code, members: [user.id], createdBy: data.created_by, createdAt: data.created_at };
        setGroups(prev => [created, ...prev]);
      })();
      return created;
    }
    const ng: Group = { id: `group_${Date.now()}`, name, inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(), members: [user.id], createdBy: user.id, createdAt: new Date().toISOString() };
    setGroups(prev => [...prev, ng]);
    return ng;
  };

  const joinGroup = async (inviteCode: string): Promise<boolean> => {
    if (!user) return false;
    if (supabase) {
      const { data: group } = await supabase.from('groups').select('id, name, invite_code, created_by, created_at').eq('invite_code', inviteCode.trim().toUpperCase()).single();
      if (!group) return false;
      const { error } = await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });
      if (error && error.code !== '23505') return false;
      await fetchGroups();
      return true;
    }
    const group = groups.find(g => g.inviteCode === inviteCode);
    if (!group) return false;
    if (!group.members.includes(user.id)) setGroups(prev => prev.map(g => g.id === group.id ? { ...g, members: [...g.members, user.id] } : g));
    return true;
  };

  const leaveGroup = (groupId: string) => {
    if (!user) return;
    if (supabase) { supabase.from('group_members').delete().match({ group_id: groupId, user_id: user.id }).then(({ error }) => { if (!error) setGroups(prev => prev.filter(g => g.id !== groupId)); }); return; }
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members: g.members.filter(m => m !== user.id) } : g));
  };

  const deleteGroup = (groupId: string) => {
    if (!user) return;
    const group = groups.find(g => g.id === groupId);
    if (!group || group.createdBy !== user.id) return;
    if (supabase) { supabase.from('groups').delete().eq('id', groupId).then(({ error }) => { if (!error) setGroups(prev => prev.filter(g => g.id !== groupId)); }); return; }
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  return (
    <AppContext.Provider value={{ user, users, goals, checkIns, groups, apiReady, login, signup, logout, addGoal, updateGoal, deleteGoal, completeGoal, addCheckIn, createGroup, joinGroup, leaveGroup, deleteGroup }}>
      {children}
    </AppContext.Provider>
  );
};
