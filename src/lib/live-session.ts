import { ensureSignedIn, supabase } from './supabase';

/** The slice of a trips row the app needs (see supabase/migrations/0001). */
export interface LiveTrip {
  id: string;
  name: string;
  kind: string;
  joinCode: string;
  endsAt: number; // epoch ms
}

/** DB row (snake_case) → app shape. Exported for tests. */
export function rowToTrip(row: {
  id: string;
  name: string;
  kind: string;
  join_code: string;
  ends_at: string;
}): LiveTrip {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    joinCode: row.join_code,
    endsAt: Date.parse(row.ends_at),
  };
}

/** Create a real session via the create_trip RPC (server mints the code). */
export async function createLiveTrip(params: {
  name: string;
  kind: string;
  durationMin: number;
  destinationName?: string;
  destination?: { latitude: number; longitude: number };
}): Promise<LiveTrip> {
  if (!supabase) throw new Error('Supabase is not configured');
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('create_trip', {
    p_name: params.name,
    p_kind: params.kind,
    p_duration_min: params.durationMin,
    p_destination_name: params.destinationName ?? null,
    p_destination_lat: params.destination?.latitude ?? null,
    p_destination_lng: params.destination?.longitude ?? null,
  });
  if (error) throw error;
  return rowToTrip(data);
}

/** Join by code via the join_trip RPC (cap/lock/expiry enforced server-side). */
export async function joinLiveTrip(code: string): Promise<LiveTrip> {
  if (!supabase) throw new Error('Supabase is not configured');
  await ensureSignedIn();
  const { data, error } = await supabase.rpc('join_trip', { p_code: code.trim().toLowerCase() });
  if (error) throw error;
  return rowToTrip(data);
}

/** Leave = delete your own membership row (RLS permits only your own). */
export async function leaveLiveTrip(tripId: string): Promise<void> {
  if (!supabase) return;
  const userId = await ensureSignedIn();
  await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
}
