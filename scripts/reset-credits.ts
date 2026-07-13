/**
 * Temporary script to reset credits for a specific user.
 * Usage: npx tsx scripts/reset-credits.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';

// Load .env.local manually
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

async function resetCredits(email: string) {
  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

  if (snapshot.empty) {
    console.error(`❌ No user found with email: ${email}`);
    return;
  }

  const userDoc = snapshot.docs[0];
  const uid = userDoc.id;
  console.log(`Found user: ${uid} (${email})`);
  console.log('Current data:', JSON.stringify(userDoc.data(), null, 2));

  // Reset to a clean free-tier state (as if freshly signed up) so the paid
  // upgrade is clearly visible when testing a payment again.
  const FREE_IMAGE_CREDITS = 20;
  const FREE_VIDEO_CREDITS = 20;

  await userDoc.ref.update({
    credits: 0,
    imageCredits: FREE_IMAGE_CREDITS,
    videoCredits: FREE_VIDEO_CREDITS,
    tier: 'free',
    // Clear subscription fields left over from a prior test purchase.
    planId: admin.firestore.FieldValue.delete(),
    subscriptionType: admin.firestore.FieldValue.delete(),
    subscriptionStartDate: admin.firestore.FieldValue.delete(),
    lastPaymentDate: admin.firestore.FieldValue.delete(),
  });

  console.log(`✅ Reset to free tier (${FREE_IMAGE_CREDITS} img / ${FREE_VIDEO_CREDITS} vid) for ${email}`);

  // Remove the processed-payment "tokens" (creem_transactions) for this user so a
  // repeat checkout won't be de-duped and skipped when re-testing the grant flow.
  const txSnap = await db.collection('creem_transactions').where('userId', '==', uid).get();
  let removed = 0;
  for (const txDoc of txSnap.docs) {
    await txDoc.ref.delete();
    removed++;
  }
  console.log(`🧹 Removed ${removed} creem_transactions record(s) for ${email}`);
}

resetCredits('ekram@10academy.org').catch(console.error);
