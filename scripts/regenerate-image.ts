/**
 * Regenerate a text-to-image asset for a user, persist it to permanent storage,
 * save it to their assets, and optionally delete an old (broken) image record.
 *
 * Uses the same Kie.ai gpt4o-image flow as the app, but polls record-info
 * directly instead of relying on the callback.
 *
 *   npx tsx scripts/regenerate-image.ts --prompt "girl dance" --email you@example.com --replace <oldImageDocId>
 *   npx tsx scripts/regenerate-image.ts --prompt "..." --id <UID>
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
import { uploadImage } from '../lib/gcp-storage';

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

const argPrompt = getArg('prompt');
const argEmail = getArg('email');
const argId = getArg('id');
const argReplace = getArg('replace');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resolveUid(): Promise<string | null> {
  if (argId) return argId;
  if (argEmail) {
    const snap = await db.collection('users').where('email', '==', argEmail).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
  }
  return null;
}

async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const genRes = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      size: '2:3',
      nVariants: 1,
      enableFallback: true,
      fallbackModel: 'FLUX_MAX',
      isEnhance: false,
      uploadCn: false,
    }),
  });
  const genData = await genRes.json();
  if (!genRes.ok) throw new Error(`generate failed: ${JSON.stringify(genData)}`);
  const taskId = genData.taskId || genData.data?.taskId || genData.id;
  if (!taskId) throw new Error(`no taskId in response: ${JSON.stringify(genData)}`);
  console.log(`  taskId: ${taskId} — polling...`);

  for (let attempt = 0; attempt < 90; attempt++) {
    await sleep(5000);
    const res = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) continue;
    const result = await res.json();
    const { status: state, resultJson, response: dataResponse } = result.data || {};
    const s = String(state || '').toLowerCase();
    if (s === 'success') {
      const parsed = resultJson
        ? JSON.parse(resultJson)
        : typeof dataResponse === 'string'
        ? JSON.parse(dataResponse)
        : dataResponse;
      const url = parsed?.resultUrls?.[0];
      if (url) return url;
      throw new Error(`success but no resultUrls: ${JSON.stringify(result.data)}`);
    }
    if (s === 'fail' || s === 'failed') throw new Error(`generation failed: ${result.data?.failMsg}`);
    console.log(`  ...state=${state} (attempt ${attempt + 1})`);
  }
  throw new Error('timed out waiting for generation');
}

async function main() {
  if (!argPrompt) {
    console.error('❌ --prompt is required');
    process.exit(1);
  }
  const uid = await resolveUid();
  if (!uid) {
    console.error('❌ Provide --email <email> or --id <uid>');
    process.exit(1);
  }
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    console.error('❌ GROK_API_KEY not set');
    process.exit(1);
  }

  console.log(`🎨 Regenerating image for ${argEmail || uid}\n  prompt: "${argPrompt}"`);
  const tempUrl = await generateImage(argPrompt, apiKey);
  console.log(`  generated (temp): ${tempUrl}`);

  const permanentUrl = await uploadImage(tempUrl, uid, 'images');
  console.log(`  re-hosted to: ${permanentUrl}`);

  const docRef = await db.collection('images').add({
    userId: uid,
    imageUrl: permanentUrl,
    prompt: argPrompt,
    source: 'text-to-image',
    tags: ['photo', 'text-to-image'],
    type: 'image',
    createdAt: admin.firestore.Timestamp.now(),
  });
  console.log(`✅ Saved new image: images/${docRef.id}`);

  if (argReplace) {
    await db.collection('images').doc(argReplace).delete();
    console.log(`🗑️  Deleted old broken record: images/${argReplace}`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
