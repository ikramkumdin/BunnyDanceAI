/**
 * One-off script to grant credits to specific users whose Creem sandbox
 * payments did not trigger the webhook.
 *
 * Usage: npx tsx scripts/grant-credits.ts
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

// Starter (150) + Standard (280) + Pro (650) = 1080 per credit type
const IMAGE_CREDITS_TO_ADD = 1080;
const VIDEO_CREDITS_TO_ADD = 1080;

const EMAILS = [
  'mjmars666@gmail.com',
  'bintkumdin@gmail.com',
];

async function grantCreditsByEmail(email: string) {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

  if (snapshot.empty) {
    console.error(`❌ No user found with email: ${email}`);
    return;
  }

  const userDoc = snapshot.docs[0];
  const data = userDoc.data();
  const beforeImage = data.imageCredits || 0;
  const beforeVideo = data.videoCredits || 0;

  console.log(`\nFound user: ${userDoc.id} (${email})`);
  console.log(`  Before: imageCredits=${beforeImage}, videoCredits=${beforeVideo}`);

  await userDoc.ref.update({
    imageCredits: beforeImage + IMAGE_CREDITS_TO_ADD,
    videoCredits: beforeVideo + VIDEO_CREDITS_TO_ADD,
    lastPaymentDate: new Date().toISOString(),
  });

  console.log(`  After:  imageCredits=${beforeImage + IMAGE_CREDITS_TO_ADD}, videoCredits=${beforeVideo + VIDEO_CREDITS_TO_ADD}`);
  console.log(`✅ Granted +${IMAGE_CREDITS_TO_ADD} img + ${VIDEO_CREDITS_TO_ADD} vid to ${email}`);
}

async function main() {
  for (const email of EMAILS) {
    try {
      await grantCreditsByEmail(email);
    } catch (e) {
      console.error(`❌ Failed for ${email}:`, e);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
