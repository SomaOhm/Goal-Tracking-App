const API_URL = (import.meta.env.VITE_API_URL as string) ?? '';
const TOKEN_KEY = 'mindbuddy_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isApiEnabled(): boolean {
  return Boolean(API_URL);
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Request timed out. The server or database may be unreachable.');
    }
    throw new Error(
      "Can't reach the server. Is it running? If you use the cloud database, check the connection or use demo mode (remove VITE_API_URL from .env)."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
};

// ─── Types for Member and Mentor operations ───

export interface Member {
  id: string;
  name: string;
  mentor_id: string | null;
  created_at: string;
}

export interface MentorInfo {
  id: string;
  name: string;
}

export interface Patient {
  id: string;
  name: string;
  mentor_id: string;
}

export interface MenteeGoal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  frequency: string;
  created_at: string;
}

// ─── Member API functions ───

export const members = {
  /** Create a new member */
  create: (name: string, mentorId?: string) =>
    api.post<Member>('/members', { name, mentor_id: mentorId }),

  /** Get a member by ID */
  get: (memberId: string) => api.get<Member>(`/members/${memberId}`),

  /** List all members */
  list: () => api.get<Member[]>('/members'),

  /** Update a member */
  update: (memberId: string, updates: { name?: string; mentor_id?: string }) =>
    api.patch<Member>(`/members/${memberId}`, updates),

  /** Delete a member */
  delete: (memberId: string) => api.delete(`/members/${memberId}`),
};

// ─── Mentor API functions ───

export const mentors = {
  /** Assign a mentor to a user */
  assign: (userId: string, mentorId: string) =>
    api.post<MentorInfo>(`/mentors/${userId}/assign`, { mentor_id: mentorId }),

  /** Get all patients assigned to a mentor */
  getPatients: (mentorId: string) =>
    api.get<Patient[]>(`/mentors/${mentorId}/patients`),

  /** Get all goals for a mentee */
  getMenteeGoals: (userId: string) =>
    api.get<MenteeGoal[]>(`/mentors/${userId}/goals`),
};
