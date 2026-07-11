// End-to-end proof of the live backend: two anonymous users create, join,
// and probe RLS against the real project. Run after the dashboard steps in
// docs/BACKEND.md:   node scripts/verify-backend.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('.env missing EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY');

const results = [];
const check = (name, ok, detail = '') => {
  results.push([ok, name, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const alice = createClient(URL_, KEY, { auth: { persistSession: false } });
const bob = createClient(URL_, KEY, { auth: { persistSession: false } });
const mallory = createClient(URL_, KEY, { auth: { persistSession: false } });

// 1. anonymous sign-in enabled
const a = await alice.auth.signInAnonymously();
check('anonymous sign-in', !a.error, a.error?.message ?? a.data.user?.id?.slice(0, 8));
if (a.error) process.exit(report());

// 2. create_trip mints a code
const created = await alice.rpc('create_trip', {
  p_name: 'Backend verification',
  p_kind: 'mall',
  p_duration_min: 30,
  p_destination_name: 'Food Court',
  p_destination_lat: 40.75,
  p_destination_lng: -74.0,
});
check('create_trip RPC', !created.error, created.error?.message ?? created.data?.join_code);
if (created.error) process.exit(report());
const trip = created.data;

// 3. second user joins by code, gets a distinct palette color
await bob.auth.signInAnonymously();
const joined = await bob.rpc('join_trip', { p_code: trip.join_code });
check('join_trip RPC', !joined.error, joined.error?.message ?? 'joined');

const roster = await bob.from('trip_members').select('user_id,color').eq('trip_id', trip.id);
check('member reads roster', !roster.error && roster.data?.length === 2, `members=${roster.data?.length}`);
check(
  'distinct member colors',
  new Set((roster.data ?? []).map((m) => m.color)).size === (roster.data ?? []).length
);

// 4. bob updates only his own position row
const bobId = (await bob.auth.getUser()).data.user.id;
const pos = await bob
  .from('trip_members')
  .update({ last_lat: 40.7501, last_lng: -74.0002, state: 'walking', last_level: 2 })
  .eq('trip_id', trip.id)
  .eq('user_id', bobId)
  .select();
check('own position update', !pos.error && pos.data?.length === 1, pos.error?.message);

// 5. RLS: a non-member sees nothing — not even that the trip exists
await mallory.auth.signInAnonymously();
const spy = await mallory.from('trips').select('id').eq('id', trip.id);
check('non-member sees no trip (RLS)', !spy.error && spy.data?.length === 0);
const spyM = await mallory.from('trip_members').select('user_id').eq('trip_id', trip.id);
check('non-member sees no roster (RLS)', !spyM.error && spyM.data?.length === 0);

// 6. wrong code rejected
const bad = await mallory.rpc('join_trip', { p_code: 'zzz-zzz-zzz' });
check('bogus code rejected', !!bad.error);

// 7. realtime: bob broadcasts on the private trip channel, alice receives
const received = new Promise((resolve) => {
  const ch = alice.channel(`trip:${trip.id}`, { config: { private: true, broadcast: { self: false } } });
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => resolve(payload)).subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      const chB = bob.channel(`trip:${trip.id}`, { config: { private: true } });
      chB.subscribe(async (s) => {
        if (s === 'SUBSCRIBED') {
          await chB.send({ type: 'broadcast', event: 'pos', payload: { id: bobId, lat: 40.7501, lng: -74.0002 } });
        }
      });
    }
  });
  setTimeout(() => resolve(null), 8000);
});
const pos2 = await received;
check('realtime broadcast on private channel', !!pos2, pos2 ? `lat=${pos2.lat}` : 'timed out');
await alice.removeAllChannels();
await bob.removeAllChannels();

function report() {
  const fails = results.filter(([ok]) => !ok).length;
  console.log(fails === 0 ? '\nAll checks passed — backend is live.' : `\n${fails} check(s) failed.`);
  return fails === 0 ? 0 : 1;
}
process.exit(report());
