/**
 * Re-host ("persist") assets that were saved with a temporary provider URL.
 *
 * Some generated images/videos were stored in Firestore pointing at the AI
 * provider's ephemeral host (e.g. tempfile.aiquickdraw.com) instead of our
 * permanent GCS bucket. Those URLs 404 once the provider purges them, showing
 * as broken images/videos in the app.
 *
 * This finds such assets for a user, and for each one that is STILL reachable,
 * downloads it and re-uploads to GCS, then updates the Firestore doc to the
 * permanent URL. Assets whose temp URL is already dead (404) are reported as
 * unrecoverable and left untouched (use --purge-dead to delete those records).
 *
 *   npx tsx scripts/persist-temp-assets.ts --email you@example.com          # dry run
 *   npx tsx scripts/persist-temp-assets.ts --email you@example.com --apply  # re-host
 *   npx tsx scripts/persist-temp-assets.ts --id <UID> --apply --purge-dead
 */
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

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
import { uploadImage, uploadVideo } from '../lib/gcp-storage';

if (!admin.apps.length) {
  let serviceAccount: any = null;
  try {
    serviceAccount = parseServiceAccountFromEnv() || null;
  } catch (e) {
    console.error('Error parsing service account:', e);
  }
  const projectId = 'bunnydanceai';
  admin.initializeApp(
    serviceAccount
      ? { credential: admin.credential.cert(serviceAccount), projectId }
      : { projectId }
  );
}

const db = admin.firestore();

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const argEmail = getArg('email');
const argId = getArg('id');
const ALL = hasFlag('all');
const APPLY = hasFlag('apply');
const PURGE_DEAD = hasFlag('purge-dead');

// A URL we consider "permanent" — already on our bucket.
function isPermanent(url: string): boolean {
  return !!url && url.includes('storage.googleapis.com');
}

async function isAlive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveUid(): Promise<string | null> {
  if (argId) return argId;
  if (argEmail) {
    const snap = await db.collection('users').where('email', '==', argEmail).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
  }
  return null;
}

// When uid is null, scans the entire collection (all users) and uses each doc's
// own userId for the storage path.
async function processCollection(coll: 'videos' | 'images', uid: string | null) {
  const urlField = coll === 'videos' ? 'videoUrl' : 'imageUrl';
  const snap = uid
    ? await db.collection(coll).where('userId', '==', uid).get()
    : await db.collection(coll).get();

  let rehosted = 0;
  let lost = 0;
  let ok = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const url: string = data[urlField] || '';
    const ownerId: string = data.userId || uid || '';

    if (isPermanent(url)) { ok++; continue; }
    if (!url || !ownerId) { continue; }

    const alive = await isAlive(url);
    if (!alive) {
      lost++;
      console.log(`  ☠️  DEAD  ${coll}/${d.id}  ${url}`);
      if (APPLY && PURGE_DEAD) {
        await d.ref.delete();
        console.log(`      → deleted broken record`);
      }
      continue;
    }

    console.log(`  ♻️  TEMP  ${coll}/${d.id}  ${url}`);
    if (APPLY) {
      try {
        let permanentUrl: string;
        if (coll === 'videos') {
          permanentUrl = await uploadVideo(url, ownerId);
        } else {
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          permanentUrl = await uploadImage(buf.toString('base64'), ownerId, 'images');
        }
        await d.ref.update({ [urlField]: permanentUrl });
        rehosted++;
        console.log(`      → re-hosted to ${permanentUrl}`);
      } catch (e) {
        console.error(`      ✗ failed to re-host:`, e instanceof Error ? e.message : e);
      }
    }
  }

  console.log(`  ${coll}: ${ok} already permanent, ${rehosted} re-hosted, ${lost} dead/unrecoverable`);
}

async function main() {
  if (ALL) {
    console.log(`${APPLY ? '🚀 APPLY' : '🔍 DRY RUN'} — persisting temp assets for ALL users\n`);
    await processCollection('videos', null);
    await processCollection('images', null);
    if (!APPLY) console.log('\n(Dry run — re-run with --all --apply to re-host reachable assets.)');
    process.exit(0);
  }

  const uid = await resolveUid();
  if (!uid) {
    console.error('❌ Provide --email <email>, --id <uid>, or --all');
    process.exit(1);
  }

  console.log(`${APPLY ? '🚀 APPLY' : '🔍 DRY RUN'} — persisting temp assets for uid: ${uid}\n`);
  await processCollection('videos', uid);
  await processCollection('images', uid);
  if (!APPLY) console.log('\n(Dry run — re-run with --apply to re-host reachable assets.)');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
