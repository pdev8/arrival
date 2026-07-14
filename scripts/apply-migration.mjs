#!/usr/bin/env node
/**
 * Apply a migration to the LIVE Supabase project, via the Management API.
 *
 *   node scripts/apply-migration.mjs supabase/migrations/0005_free_roam.sql
 *   node scripts/apply-migration.mjs --check           # what's applied right now
 *   node scripts/apply-migration.mjs --query "select 1"
 *
 * This exists because applying a migration used to be a hand-rolled curl, and a
 * hand-rolled curl against a production database is how you find out what a
 * typo costs. Two things that will bite you if you write your own:
 *
 *  - Cloudflare sits in front of api.supabase.com and blocks default user
 *    agents (python's, notably). Send a real one.
 *  - The token is a REVOCABLE personal access token in .env. It is not the anon
 *    key, it is not publishable, and it must never be printed or committed.
 *
 * CI already applies every migration to a real Postgres on every PR, so this
 * script is for the live project only — the SQL has been proven before it gets
 * here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** .env, minimally — no dotenv dependency for a script that runs twice a month. */
function env() {
  const out = {};
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const { SUPABASE_ACCESS_TOKEN: token, EXPO_PUBLIC_SUPABASE_URL: url } = env();
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing from .env');
const ref = new URL(url).hostname.split('.')[0];

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Cloudflare blocks default agents. This is not optional.
      'User-Agent': 'arrival-cli/1.0 (+https://github.com/pdev8/arrival)',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}\n${body}`);
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** What the live database actually has — the only honest starting point. */
const CHECK = `
select
  (select coalesce(json_agg(json_build_object('fn', p.proname)
      order by p.proname), '[]')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_trip','join_trip','set_destination','set_meet_time',
                        'toggle_reaction','upsert_display_name','complete_expired_trips')
  ) as rpcs,
  (select coalesce(json_agg(tablename order by tablename), '[]')
     from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  ) as realtime,
  (select coalesce(json_agg(json_build_object('t', table_name, 'c', column_name)
      order by table_name, column_name), '[]')
     from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name) in
          (('trips','destination_name'), ('trips','meet_at'), ('trip_members','left_at'),
           ('stops','duration_min'), ('stops','resolved_at'))
  ) as columns
`;

const arg = process.argv[2];

if (arg === '--check') {
  const [row] = await query(CHECK);
  console.log(`live project: ${ref}\n`);
  console.log('RPCs:      ', row.rpcs.map((r) => r.fn).join(', ') || '(none)');
  console.log('realtime:  ', row.realtime.join(', ') || '(none)');
  console.log('columns:   ', row.columns.map((c) => `${c.t}.${c.c}`).join(', ') || '(none)');
} else if (arg === '--query') {
  console.log(JSON.stringify(await query(process.argv[3]), null, 2));
} else if (arg) {
  const sql = readFileSync(join(root, arg), 'utf8');
  console.log(`applying ${arg} → ${ref}`);
  await query(sql);
  console.log('applied ✓');
} else {
  console.error('usage: apply-migration.mjs <file.sql> | --check | --query "<sql>"');
  process.exit(1);
}
