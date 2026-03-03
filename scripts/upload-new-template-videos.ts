/**
 * Download new template preview videos from tempfile URLs and upload to GCP Storage.
 * Then print the GCS public URLs to update templates.ts.
 *
 * Usage: npx tsx scripts/upload-new-template-videos.ts
 */

import { Storage } from '@google-cloud/storage';

// ── GCP credentials from env ────────────────────────────────────────────
const base64Creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
const credentials = base64Creds
  ? JSON.parse(Buffer.from(base64Creds, 'base64').toString('utf-8'))
  : undefined;

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'bunnydanceai',
  credentials,
});

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'bunnydanceai-storage';

// ── Videos to upload ────────────────────────────────────────────────────
const newTemplates = [
  {
    id: 'shush-finger',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/db2533cb-8c63-43fc-8c52-e3000110b166/generated/dd45354b-fefc-47d8-8337-eb4c2ac04422/generated_video.mp4',
  },
  {
    id: 'magical-girl-warrior',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/6ae89be5-3346-4954-ac3f-6be9e79def0e/generated/aa7ff0b5-635c-4bd8-9da1-cab9c1602f98/generated_video.mp4',
  },
  {
    id: 'silent-hill-girl',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/2356815b-f3e4-47f0-9ada-e5b87ec6b6b8/generated/132652b7-69c9-4ea1-828a-632fd4d0bd0c/generated_video.mp4',
  },
  {
    id: 'pumpkin-tongue',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/84734daf-7b90-4de3-a571-4a2997be1f89/generated/8d0abefc-7fa9-4592-85cb-ab5a16e8f079/generated_video.mp4',
  },
  {
    id: 'ninja-fire',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/d17f6ca9-3c19-4b7d-9d32-2c4349e78eee/generated/4f98a78b-2e4e-4089-b7d6-872e6a7cbd85/generated_video.mp4',
  },
  {
    id: 'good-time-party-girl',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/0fdfd9f9-98d6-43d3-9c2e-9044b723ef0f/generated/7336d1e2-a7d4-49f1-95e4-948b0670fc14/generated_video.mp4',
  },
  {
    id: 'jump-to-bed-money',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/fba08282-8b7b-4d05-966c-bcbc987170f8/generated/7126891a-5593-4fca-9d94-d44f74639569/generated_video.mp4',
  },
  {
    id: 'jump-skyscraper-bed',
    sourceUrl: 'https://tempfile.aiquickdraw.com/r/users/96ca0fbf-f23c-4ae0-bd74-7d1a4ef94423/generated/ae8517d9-3f08-4994-aa09-eca541466731/generated_video.mp4',
  },
];

async function main() {
  console.log('🚀 Downloading and uploading new template videos...\n');

  const results: { id: string; url: string }[] = [];

  for (const tmpl of newTemplates) {
    try {
      console.log(`📥 Downloading ${tmpl.id}...`);
      const res = await fetch(tmpl.sourceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${tmpl.sourceUrl}`);
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`   Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

      const gcsPath = `templates/${tmpl.id}-${Date.now()}.mp4`;
      const bucket = storage.bucket(BUCKET_NAME);
      const file = bucket.file(gcsPath);

      console.log(`📤 Uploading to gs://${BUCKET_NAME}/${gcsPath}...`);
      await file.save(buffer, {
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;
      console.log(`✅ ${tmpl.id} → ${publicUrl}\n`);
      results.push({ id: tmpl.id, url: publicUrl });
    } catch (err) {
      console.error(`❌ Failed for ${tmpl.id}:`, err);
    }
  }

  console.log('\n═══ Copy these into templates.ts ═══\n');
  for (const r of results) {
    console.log(`'${r.id}': '${r.url}',`);
  }
}

main().catch(console.error);
