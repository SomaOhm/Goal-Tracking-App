import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
  customDays?: number[];
  checklist?: string[];
  completions: { date: string; reflection?: string }[];
  visibleToGroups: string[];
  createdAt: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  mood: number;
  reflection: string;
  visibleToGroups: string[];
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  members: string[];
  createdBy: string;
  createdAt: string;
}

interface AppContextType {
  user: User | null;
  users: User[];
  goals: Goal[];
  checkIns: CheckIn[];
  groups: Group[];
  apiReady: boolean;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// ── Supabase row → frontend model helpers ──

interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'custom';
  custom_days: number[] | null;
  checklist: string[] | null;
  created_at: string;
  goal_completions: { date: string; reflection: string | null }[];
  goal_visibility: { group_id: string }[];
}

function rowToGoal(r: GoalRow): Goal {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description ?? '',
    frequency: r.frequency,
    customDays: r.custom_days ?? undefined,
    checklist: r.checklist ?? undefined,
    completions: (r.goal_completions ?? []).map((c) => ({
      date: c.date,
      reflection: c.reflection ?? undefined,
    })),
    visibleToGroups: (r.goal_visibility ?? []).map((v) => v.group_id),
    createdAt: r.created_at,
  };
}

interface CheckInRow {
  id: string;
  user_id: string;
  date: string;
  mood: number;
  reflection: string;
  check_in_visibility: { group_id: string }[];
}

function rowToCheckIn(r: CheckInRow): CheckIn {
  return {
    id: r.id,
    userId: r.user_id,
    date: r.date,
    mood: r.mood,
    reflection: r.reflection ?? '',
    visibleToGroups: (r.check_in_visibility ?? []).map((v) => v.group_id),
  };
}

interface GroupMemberRow {
  group_id: string;
  user_id: string;
  groups: {
    id: string;
    name: string;
    invite_code: string;
    created_by: string;
    created_at: string;
  };
}

// ── Provider ──

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [apiReady, setApiReady] = useState(!isSupabaseEnabled());

  // ── Supabase data fetchers ──

  const fetchGoals = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('goals')
      .select('*, goal_completions(date, reflection), goal_visibility(group_id)')
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchGoals', error); return; }
    setGoals((data as GoalRow[]).map(rowToGoal));
  }, []);

  const fetchCheckIns = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('check_ins')
      .select('*, check_in_visibility(group_id)')
      .order('date', { ascending: false });
    if (error) { console.error('fetchCheckIns', error); return; }
    setCheckIns((data as CheckInRow[]).map(rowToCheckIn));
  }, []);

  const fetchGroups = useCallback(async () => {
    if (!supabase) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, user_id, groups(id, name, invite_code, created_by, created_at)')
      .order('joined_at', { ascending: false });
    if (error) { console.error('fetchGroups', error); return; }

    const rows = data as GroupMemberRow[];
    const groupMap = new Map<string, Group>();
    for (const row of rows) {
      const g = row.groups;
      if (!g) continue;
      if (!groupMap.has(g.id)) {
        groupMap.set(g.id, {
          id: g.id,
          name: g.name,
          inviteCode: g.invite_code,
          members: [],
          createdBy: g.created_by,
          createdAt: g.created_at,
        });
      }
      groupMap.get(g.id)!.members.push(row.user_id);
    }
    const groupList = [...groupMap.values()];
    setGroups(groupList);

    const memberIds = [...new Set(groupList.flatMap((g) => g.members))];
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, name, avatar')
        .in('id', memberIds);
      if (profiles) setUsers(profiles as User[]);
    }
  }, []);

  // ── Session init ──

  useEffect(() => {
    if (!supabase) {
      // localStorage demo mode
      const hasInitialized = localStorage.getItem('hasInitialized');
      if (!hasInitialized) {
        const demoUsers: User[] = [
          { id: 'demo_user_1', email: 'alex@example.com', name: 'Alex' },
          { id: 'demo_user_2', email: 'sam@example.com', name: 'Sam' },
          { id: 'demo_user_3', email: 'jordan@example.com', name: 'Jordan' },
        ];
        const demoGroup: Group = {
          id: 'demo_group_1',
          name: 'Wellness Warriors',
          inviteCode: 'DEMO99',
          members: ['demo_user_1', 'demo_user_2', 'demo_user_3'],
          createdBy: 'demo_user_1',
          createdAt: new Date().toISOString(),
        };
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const demoGoals: Goal[] = [
          {
            id: 'demo_goal_1', userId: 'demo_user_1', title: 'Morning Meditation',
            description: '10 minutes of mindfulness', frequency: 'daily',
            completions: [
              { date: format(today, 'yyyy-MM-dd') },
              { date: format(yesterday, 'yyyy-MM-dd') },
              { date: format(twoDaysAgo, 'yyyy-MM-dd') },
            ],
            visibleToGroups: ['demo_group_1'], createdAt: twoDaysAgo.toISOString(),
          },
          {
            id: 'demo_goal_2', userId: 'demo_user_2', title: 'Gratitude Journal',
            description: "Write 3 things I'm grateful for", frequency: 'daily',
            completions: [
              { date: format(today, 'yyyy-MM-dd'), reflection: 'Feeling thankful for my friends today' },
              { date: format(yesterday, 'yyyy-MM-dd') },
            ],
            visibleToGroups: ['demo_group_1'], createdAt: yesterday.toISOString(),
          },
        ];
        const demoCheckIns: CheckIn[] = [
          { id: 'demo_checkin_1', userId: 'demo_user_1', date: format(today, 'yyyy-MM-dd'), mood: 4, reflection: 'Had a productive morning! Feeling good.', visibleToGroups: ['demo_group_1'] },
          { id: 'demo_checkin_2', userId: 'demo_user_2', date: format(today, 'yyyy-MM-dd'), mood: 5, reflection: 'Great day with lots of positive energy', visibleToGroups: ['demo_group_1'] },
        ];
        localStorage.setItem('users', JSON.stringify(demoUsers));
        localStorage.setItem('groups', JSON.stringify([demoGroup]));
        localStorage.setItem('goals', JSON.stringify(demoGoals));
        localStorage.setItem('checkIns', JSON.stringify(demoCheckIns));
        localStorage.setItem('hasInitialized', 'true');
        setUsers(demoUsers);
        setGroups([demoGroup]);
        setGoals(demoGoals);
        setCheckIns(demoCheckIns);
      }
      const storedUser = localStorage.getItem('currentUser');
      const storedUsers = localStorage.getItem('users');
      const storedGoals = localStorage.getItem('goals');
      const storedCheckIns = localStorage.getItem('checkIns');
      const storedGroups = localStorage.getItem('groups');
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedUsers) setUsers(JSON.parse(storedUsers));
      if (storedGoals) setGoals(JSON.parse(storedGoals));
      if (storedCheckIns) setCheckIns(JSON.parse(storedCheckIns));
      if (storedGroups) setGroups(JSON.parse(storedGroups));
      setApiReady(true);
      return;
    }

    // Supabase session restore
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, name, avatar')
          .eq('id', session.user.id)
          .single();
        if (profile) setUser(profile as User);
        await Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
      }
      setApiReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setGoals([]);
        setCheckIns([]);
        setGroups([]);
        setUsers([]);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, name, avatar')
          .eq('id', session.user.id)
          .single();
        if (profile) setUser(profile as User);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchGoals, fetchCheckIns, fetchGroups]);

  // localStorage persistence (demo mode only)
  useEffect(() => { if (!isSupabaseEnabled() && user) localStorage.setItem('currentUser', JSON.stringify(user)); else if (!isSupabaseEnabled()) localStorage.removeItem('currentUser'); }, [user]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('users', JSON.stringify(users)); }, [users]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('goals', JSON.stringify(goals)); }, [goals]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('checkIns', JSON.stringify(checkIns)); }, [checkIns]);
  useEffect(() => { if (!isSupabaseEnabled()) localStorage.setItem('groups', JSON.stringify(groups)); }, [groups]);

  // ── Auth ──

  const login = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      await Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
      return;
    }
    const foundUser = users.find((u) => u.email === email);
    if (!foundUser) throw new Error('User not found');
    setUser(foundUser);
  };

  const signup = async (email: string, password: string, name: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);
      await Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
      return;
    }
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) throw new Error('User already exists');
    const newUser: User = { id: `user_${Date.now()}`, email, name };
    setUsers([...users, newUser]);
    setUser(newUser);
  };

  const logout = () => {
    if (supabase) {
      supabase.auth.signOut();
      return;
    }
    setUser(null);
  };

  // ── Goals ──

  const addGoal = (goal: Omit<Goal, 'id' | 'userId' | 'completions' | 'createdAt'>) => {
    if (!user) return;
    if (supabase) {
      (async () => {
        const { data, error } = await supabase
          .from('goals')
          .insert({
            user_id: user.id,
            title: goal.title,
            description: goal.description,
            frequency: goal.frequency,
            custom_days: goal.customDays ?? null,
            checklist: goal.checklist ?? null,
          })
          .select('*, goal_completions(date, reflection), goal_visibility(group_id)')
          .single();
        if (error) { console.error('addGoal', error); return; }
        const newGoal = rowToGoal(data as GoalRow);

        if (goal.visibleToGroups?.length) {
          await supabase.from('goal_visibility').insert(
            goal.visibleToGroups.map((gid) => ({ goal_id: newGoal.id, group_id: gid }))
          );
          newGoal.visibleToGroups = goal.visibleToGroups;
        }
        setGoals((prev) => [newGoal, ...prev]);
      })();
      return;
    }
    const newGoal: Goal = {
      ...goal,
      id: `goal_${Date.now()}`,
      userId: user.id,
      completions: [],
      createdAt: new Date().toISOString(),
    };
    setGoals((prev) => [...prev, newGoal]);
  };

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    if (supabase) {
      (async () => {
        const dbUpdates: Record<string, unknown> = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.description !== undefined) dbUpdates.description = updates.description;
        if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
        if (updates.customDays !== undefined) dbUpdates.custom_days = updates.customDays;
        if (updates.checklist !== undefined) dbUpdates.checklist = updates.checklist;

        if (Object.keys(dbUpdates).length > 0) {
          const { error } = await supabase.from('goals').update(dbUpdates).eq('id', id);
          if (error) { console.error('updateGoal', error); return; }
        }

        if (updates.visibleToGroups !== undefined) {
          await supabase.from('goal_visibility').delete().eq('goal_id', id);
          if (updates.visibleToGroups.length > 0) {
            await supabase.from('goal_visibility').insert(
              updates.visibleToGroups.map((gid) => ({ goal_id: id, group_id: gid }))
            );
          }
        }

        setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
      })();
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const deleteGoal = (id: string) => {
    if (supabase) {
      supabase.from('goals').delete().eq('id', id)
        .then(({ error }) => {
          if (error) { console.error('deleteGoal', error); return; }
          setGoals((prev) => prev.filter((g) => g.id !== id));
        });
      return;
    }
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const completeGoal = (goalId: string, date: string, reflection?: string) => {
    if (supabase) {
      (async () => {
        const existing = goals.find((g) => g.id === goalId)?.completions.find((c) => c.date === date);
        if (existing) {
          await supabase.from('goal_completions').delete().match({ goal_id: goalId, date });
          setGoals((prev) =>
            prev.map((g) => g.id === goalId ? { ...g, completions: g.completions.filter((c) => c.date !== date) } : g)
          );
        } else {
          await supabase.from('goal_completions').insert({ goal_id: goalId, date, reflection: reflection ?? null });
          setGoals((prev) =>
            prev.map((g) => g.id === goalId ? { ...g, completions: [...g.completions, { date, reflection }] } : g)
          );
        }
      })();
      return;
    }
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const ex = g.completions.find((c) => c.date === date);
        if (ex) return { ...g, completions: g.completions.filter((c) => c.date !== date) };
        return { ...g, completions: [...g.completions, { date, reflection }] };
      })
    );
  };

  // ── Check-ins ──

  const addCheckIn = (checkIn: Omit<CheckIn, 'id' | 'userId'>) => {
    if (!user) return;
    if (supabase) {
      (async () => {
        const { data, error } = await supabase
          .from('check_ins')
          .insert({ user_id: user.id, date: checkIn.date, mood: checkIn.mood, reflection: checkIn.reflection })
          .select('*, check_in_visibility(group_id)')
          .single();
        if (error) { console.error('addCheckIn', error); return; }
        const newCheckIn = rowToCheckIn(data as CheckInRow);

        if (checkIn.visibleToGroups?.length) {
          await supabase.from('check_in_visibility').insert(
            checkIn.visibleToGroups.map((gid) => ({ check_in_id: newCheckIn.id, group_id: gid }))
          );
          newCheckIn.visibleToGroups = checkIn.visibleToGroups;
        }
        setCheckIns((prev) => [newCheckIn, ...prev]);
      })();
      return;
    }
    const newCheckIn: CheckIn = { ...checkIn, id: `checkin_${Date.now()}`, userId: user.id };
    setCheckIns((prev) => [newCheckIn, ...prev]);
  };

  // ── Groups ──

  const createGroup = (name: string): Group => {
    if (!user) throw new Error('Must be logged in');
    if (supabase) {
      let created: Group = null!;
      (async () => {
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const { data, error } = await supabase
          .from('groups')
          .insert({ name, invite_code: inviteCode, created_by: user.id })
          .select()
          .single();
        if (error) { console.error('createGroup', error); return; }

        await supabase.from('group_members').insert({ group_id: data.id, user_id: user.id });

        created = {
          id: data.id,
          name: data.name,
          inviteCode: data.invite_code,
          members: [user.id],
          createdBy: data.created_by,
          createdAt: data.created_at,
        };
        setGroups((prev) => [created, ...prev]);
      })();
      return created;
    }
    const newGroup: Group = {
      id: `group_${Date.now()}`,
      name,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      members: [user.id],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    setGroups((prev) => [...prev, newGroup]);
    return newGroup;
  };

  const joinGroup = async (inviteCode: string): Promise<boolean> => {
    if (!user) return false;
    if (supabase) {
      const { data: group, error } = await supabase
        .from('groups')
        .select('id, name, invite_code, created_by, created_at')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single();
      if (error || !group) return false;

      const { error: joinErr } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id });
      if (joinErr && joinErr.code !== '23505') { console.error('joinGroup', joinErr); return false; }

      await fetchGroups();
      return true;
    }
    const group = groups.find((g) => g.inviteCode === inviteCode);
    if (!group) return false;
    if (group.members.includes(user.id)) return true;
    setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, members: [...g.members, user.id] } : g)));
    return true;
  };

  const leaveGroup = (groupId: string) => {
    if (!user) return;
    if (supabase) {
      supabase.from('group_members').delete().match({ group_id: groupId, user_id: user.id })
        .then(({ error }) => {
          if (error) { console.error('leaveGroup', error); return; }
          setGroups((prev) => prev.filter((g) => g.id !== groupId));
        });
      return;
    }
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, members: g.members.filter((m) => m !== user.id) } : g)));
  };

  return (
    <AppContext.Provider
      value={{
        user, users, goals, checkIns, groups, apiReady,
        login, signup, logout,
        addGoal, updateGoal, deleteGoal, completeGoal,
        addCheckIn,
        createGroup, joinGroup, leaveGroup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
