import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set (.env locally, EAS
 * secrets in builds). Until then the app runs pure-demo and never touches
 * the network — every live-backend feature must check this and fall back.
 */
export const supabaseConfigured = Boolean(url && anonKey);

/** Null when unconfigured — callers must guard via `supabaseConfigured`. */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * M1 identity: anonymous sign-in (upgradeable to Apple/Google in the A epic).
 * Idempotent — returns the existing session's user id when already signed in.
 */
export async function ensureSignedIn(): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error('anonymous sign-in failed');
  return anon.user.id;
}
