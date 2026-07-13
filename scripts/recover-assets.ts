/**
 * Recover orphaned WaifuDance assets.
 *
 * Assets (videos/images) are queried by their `userId` field. When a user's id
 * changed (e.g. an anonymous session that later became an authenticated Firebase
 * user, or a pre-auth account), assets saved under the old id are orphaned — they
 * still exist in Firestore but no longer surface in the app.
 *
 * This script runs in two modes:
 *
 *   1. AUDIT (default): lists every distinct userId found across the `videos` and
 *      `images` collections with counts, and flags which ones have NO matching
 *      user document (likely orphaned assets). Use this to find the old id.
 *
 *        npx tsx scripts/recover-assets.ts
 *        npx tsx scripts/recover-assets.ts --email you@example.com   # focus one account
 *
 *   2. MERGE: re-associates all assets from a source id to a target account,
 *      resolved by email. Idempotent — safe to re-run.
 *
 *        npx tsx scripts/recover-assets.ts --from <OLD_ID> --email you@example.com
 *        npx tsx scripts/recover-assets.ts --from <OLD_ID> --to <UID>
 */
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

// ── Load .env.local manually ──────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

import { parseServiceAccountFromEnv } from '../lib/credentials';

if (!admin.apps.length) {
  let serviceAccount: any = null;
  try {
    serviceAccount = parseServiceAccountFromEnv() || null;
  } catch (e) {
    console.error('Error parsing service account:', e);
  }

  const projectId = 'bunnydanceai';
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

// ── Arg parsing ───────────────────────────────────────────────────────
function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const argEmail = getArg('email');
const argFrom = getArg('from');
const argTo = getArg('to');

// ── Helpers ───────────────────────────────────────────────────────────
async function resolveUidByEmail(email: string): Promise<string | null> {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function collectAssetOwners(): Promise<Map<string, { videos: number; images: number; sample: string }>> {
  const owners = new Map<string, { videos: number; images: number; sample: string }>();

  for (const [coll, key] of [['videos', 'videos'], ['images', 'images']] as const) {
    const snap = await db.collection(coll).get();
    snap.forEach((d) => {
      const data = d.data();
      const uid = data.userId || '(none)';
      const entry = owners.get(uid) || { videos: 0, images: 0, sample: '' };
      (entry as any)[key] += 1;
      if (!entry.sample) {
        entry.sample = (data.prompt || data.templateName || '').toString().slice(0, 50);
      }
      owners.set(uid, entry);
    });
  }
  return owners;
}

async function audit() {
  console.log('🔎 Auditing asset ownership across videos + images...\n');

  const owners = await collectAssetOwners();
  if (owners.size === 0) {
    console.log('No assets found in either collection.');
    return;
  }

  // Which owner ids actually have a user document?
  const rows: Array<{ uid: string; videos: number; images: number; hasUser: boolean; email: string; sample: string }> = [];
  for (const [uid, counts] of owners) {
    let hasUser = false;
    let email = '';
    if (uid !== '(none)') {
      const userDoc = await db.collection('users').doc(uid).get();
      hasUser = userDoc.exists;
      email = (userDoc.data()?.email as string) || '';
    }
    rows.push({ uid, ...counts, hasUser, email });
  }

  rows.sort((a, b) => b.videos + b.images - (a.videos + a.images));

  const focusUid = argEmail ? await resolveUidByEmail(argEmail) : null;
  if (argEmail) {
    console.log(`Target account: ${argEmail} → uid: ${focusUid ?? 'NOT FOUND'}\n`);
  }

  console.log('owner id                              | vids | imgs | user doc | email / sample');
  console.log('-'.repeat(100));
  for (const r of rows) {
    const flag = !r.hasUser ? '  ❌ orphan' : (focusUid && r.uid === focusUid ? '  ⭐ target' : '  ok');
    const label = r.email || r.sample || '';
    console.log(
      `${r.uid.padEnd(37)}| ${String(r.videos).padStart(4)} | ${String(r.images).padStart(4)} | ${r.hasUser ? 'yes' : 'NO '}     |${flag}  ${label}`
    );
  }

  console.log('\nTo recover, pick an orphan (❌) id and run:');
  console.log(`  npx tsx scripts/recover-assets.ts --from <ORPHAN_ID> --email ${argEmail || 'you@example.com'}`);
}

async function merge(fromId: string, toUid: string) {
  if (fromId === toUid) {
    console.error('❌ --from and target uid are identical; nothing to do.');
    return;
  }

  let moved = 0;
  for (const coll of ['videos', 'images']) {
    const snap = await db.collection(coll).where('userId', '==', fromId).get();
    const batchWrites: Promise<any>[] = [];
    snap.forEach((d) => {
      batchWrites.push(d.ref.update({ userId: toUid }));
      moved++;
    });
    await Promise.all(batchWrites);
    console.log(`  ${coll}: moved ${snap.size} doc(s)`);
  }

  console.log(`\n✅ Recovered ${moved} asset(s): ${fromId} → ${toUid}`);
}

async function main() {
  if (argFrom) {
    let toUid = argTo || null;
    if (!toUid && argEmail) toUid = await resolveUidByEmail(argEmail);
    if (!toUid) {
      console.error('❌ Provide a destination: --to <UID> or --email <known account email>');
      process.exit(1);
    }
    console.log(`🔀 Merging assets ${argFrom} → ${toUid}\n`);
    await merge(argFrom, toUid);
  } else {
    await audit();
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
