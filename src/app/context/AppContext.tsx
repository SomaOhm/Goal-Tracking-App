import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { api, getToken, setToken, clearToken, isApiEnabled } from '../api/client';

// Types
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

async function fetchUsersForGroups(groups: Group[]): Promise<User[]> {
  const ids = [...new Set(groups.flatMap((g) => g.members))];
  if (ids.length === 0) return [];
  const res = await api.get<User[]>(`/api/users?ids=${ids.join(',')}`);
  return Array.isArray(res) ? res : [];
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [apiReady, setApiReady] = useState(!isApiEnabled());

  const fetchGoals = useCallback(async () => {
    const list = await api.get<Goal[]>('/api/goals');
    setGoals(Array.isArray(list) ? list : []);
  }, []);

  const fetchCheckIns = useCallback(async () => {
    const list = await api.get<CheckIn[]>('/api/check-ins');
    setCheckIns(Array.isArray(list) ? list : []);
  }, []);

  const fetchGroups = useCallback(async () => {
    const list = await api.get<Group[]>('/api/groups');
    const next = Array.isArray(list) ? list : [];
    setGroups(next);
    const memberUsers = await fetchUsersForGroups(next);
    setUsers(memberUsers);
  }, []);

  // Initial load: API session restore or localStorage + demo
  useEffect(() => {
    if (isApiEnabled()) {
      const token = getToken();
      if (!token) {
        setApiReady(true);
        return;
      }
      api
        .get<User>('/api/auth/me')
        .then((me) => {
          setUser(me);
          setApiReady(true);
          Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
        })
        .catch(() => {
          clearToken();
          setApiReady(true);
        });
      return;
    }

    // LocalStorage mode: demo init once
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
          id: 'demo_goal_1',
          userId: 'demo_user_1',
          title: 'Morning Meditation',
          description: '10 minutes of mindfulness',
          frequency: 'daily',
          completions: [
            { date: format(today, 'yyyy-MM-dd') },
            { date: format(yesterday, 'yyyy-MM-dd') },
            { date: format(twoDaysAgo, 'yyyy-MM-dd') },
          ],
          visibleToGroups: ['demo_group_1'],
          createdAt: twoDaysAgo.toISOString(),
        },
        {
          id: 'demo_goal_2',
          userId: 'demo_user_2',
          title: 'Gratitude Journal',
          description: "Write 3 things I'm grateful for",
          frequency: 'daily',
          completions: [
            { date: format(today, 'yyyy-MM-dd'), reflection: 'Feeling thankful for my friends today' },
            { date: format(yesterday, 'yyyy-MM-dd') },
          ],
          visibleToGroups: ['demo_group_1'],
          createdAt: yesterday.toISOString(),
        },
      ];
      const demoCheckIns: CheckIn[] = [
        {
          id: 'demo_checkin_1',
          userId: 'demo_user_1',
          date: format(today, 'yyyy-MM-dd'),
          mood: 4,
          reflection: 'Had a productive morning! Feeling good.',
          visibleToGroups: ['demo_group_1'],
        },
        {
          id: 'demo_checkin_2',
          userId: 'demo_user_2',
          date: format(today, 'yyyy-MM-dd'),
          mood: 5,
          reflection: 'Great day with lots of positive energy',
          visibleToGroups: ['demo_group_1'],
        },
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
  }, [fetchGoals, fetchCheckIns, fetchGroups]);

  // LocalStorage persistence when not using API
  useEffect(() => {
    if (isApiEnabled()) return;
    if (user) localStorage.setItem('currentUser', JSON.stringify(user));
    else localStorage.removeItem('currentUser');
  }, [user]);

  useEffect(() => {
    if (isApiEnabled()) return;
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (isApiEnabled()) return;
    localStorage.setItem('goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    if (isApiEnabled()) return;
    localStorage.setItem('checkIns', JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    if (isApiEnabled()) return;
    localStorage.setItem('groups', JSON.stringify(groups));
  }, [groups]);

  const login = async (email: string, password: string) => {
    if (isApiEnabled()) {
      const { user: u, token } = await api.post<{ user: User; token: string }>('/api/auth/login', { email, password });
      setToken(token);
      setUser(u);
      Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
      return;
    }
    const foundUser = users.find((u) => u.email === email);
    if (!foundUser) throw new Error('User not found');
    setUser(foundUser);
  };

  const signup = async (email: string, password: string, name: string) => {
    if (isApiEnabled()) {
      const { user: u, token } = await api.post<{ user: User; token: string }>('/api/auth/signup', {
        email,
        password,
        name,
      });
      setToken(token);
      setUser(u);
      Promise.all([fetchGoals(), fetchCheckIns(), fetchGroups()]).catch(() => {});
      return;
    }
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) throw new Error('User already exists');
    const newUser: User = { id: `user_${Date.now()}`, email, name };
    setUsers([...users, newUser]);
    setUser(newUser);
  };

  const logout = () => {
    if (isApiEnabled()) {
      clearToken();
      setUser(null);
      setGoals([]);
      setCheckIns([]);
      setGroups([]);
      setUsers([]);
      return;
    }
    setUser(null);
  };

  const addGoal = (goal: Omit<Goal, 'id' | 'userId' | 'completions' | 'createdAt'>) => {
    if (!user) return;
    if (isApiEnabled()) {
      api
        .post<Goal>('/api/goals', goal)
        .then((newGoal) => setGoals((prev) => [newGoal, ...prev]))
        .catch((err) => {
          throw err;
        });
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
    if (isApiEnabled()) {
      api
        .patch<Goal>(`/api/goals/${id}`, updates)
        .then((updated) => setGoals((prev) => prev.map((g) => (g.id === id ? updated : g))))
        .catch((err) => {
          throw err;
        });
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const deleteGoal = (id: string) => {
    if (isApiEnabled()) {
      api
        .delete(`/api/goals/${id}`)
        .then(() => setGoals((prev) => prev.filter((g) => g.id !== id)))
        .catch((err) => {
          throw err;
        });
      return;
    }
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const completeGoal = (goalId: string, date: string, reflection?: string) => {
    if (isApiEnabled()) {
      api
        .post<{ completed: boolean; date: string; reflection?: string }>(`/api/goals/${goalId}/complete`, {
          date,
          reflection,
        })
        .then(({ completed }) => {
          setGoals((prev) =>
            prev.map((g) => {
              if (g.id !== goalId) return g;
              if (completed) {
                return { ...g, completions: [...g.completions, { date, reflection }] };
              }
              return { ...g, completions: g.completions.filter((c) => c.date !== date) };
            })
          );
        })
        .catch((err) => {
          throw err;
        });
      return;
    }
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const existing = g.completions.find((c) => c.date === date);
        if (existing) {
          return { ...g, completions: g.completions.filter((c) => c.date !== date) };
        }
        return { ...g, completions: [...g.completions, { date, reflection }] };
      })
    );
  };

  const addCheckIn = (checkIn: Omit<CheckIn, 'id' | 'userId'>) => {
    if (!user) return;
    if (isApiEnabled()) {
      api
        .post<CheckIn>('/api/check-ins', checkIn)
        .then((newCheckIn) => setCheckIns((prev) => [newCheckIn, ...prev]))
        .catch((err) => {
          throw err;
        });
      return;
    }
    const newCheckIn: CheckIn = {
      ...checkIn,
      id: `checkin_${Date.now()}`,
      userId: user.id,
    };
    setCheckIns((prev) => [newCheckIn, ...prev]);
  };

  const createGroup = (name: string): Group => {
    if (!user) throw new Error('Must be logged in');
    if (isApiEnabled()) {
      let created: Group = null!;
      api
        .post<Group>('/api/groups', { name })
        .then((g) => {
          created = g;
          setGroups((prev) => [g, ...prev]);
          return fetchUsersForGroups([g]);
        })
        .then((memberUsers) => {
          setUsers((prev) => {
            const byId = new Map(prev.map((u) => [u.id, u]));
            memberUsers.forEach((u) => byId.set(u.id, u));
            return [...byId.values()];
          });
        })
        .catch((err) => {
          throw err;
        });
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
    if (isApiEnabled()) {
      const group = await api.post<Group>('/api/groups/join', { inviteCode: inviteCode.trim().toUpperCase() });
      setGroups((prev) => {
        const exists = prev.some((g) => g.id === group.id);
        if (exists) return prev.map((g) => (g.id === group.id ? group : g));
        return [group, ...prev];
      });
      const memberUsers = await fetchUsersForGroups([group]);
      setUsers((prev) => {
        const byId = new Map(prev.map((u) => [u.id, u]));
        memberUsers.forEach((u) => byId.set(u.id, u));
        return [...byId.values()];
      });
      return true;
    }
    const group = groups.find((g) => g.inviteCode === inviteCode);
    if (!group) return false;
    if (group.members.includes(user.id)) return true;
    setGroups((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, members: [...g.members, user.id] } : g))
    );
    return true;
  };

  const leaveGroup = (groupId: string) => {
    if (!user) return;
    if (isApiEnabled()) {
      api
        .post(`/api/groups/${groupId}/leave`)
        .then(() => setGroups((prev) => prev.filter((g) => g.id !== groupId)))
        .catch((err) => {
          throw err;
        });
      return;
    }
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, members: g.members.filter((m) => m !== user.id) } : g))
    );
  };

  return (
    <AppContext.Provider
      value={{
        user,
        users,
        goals,
        checkIns,
        groups,
        apiReady,
        login,
        signup,
        logout,
        addGoal,
        updateGoal,
        deleteGoal,
        completeGoal,
        addCheckIn,
        createGroup,
        joinGroup,
        leaveGroup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
