import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'implicit',
          lock: (async (_name: string, _timeout: number, fn: () => Promise<any>) => await fn()) as any,
          storageKey: 'mindbuddy-auth',
        },
      })
    : null;

export const isSupabaseEnabled = () => Boolean(supabase);
