import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

// Initialize GCP Storage client
const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
  : undefined;

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
  credentials,
});

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'bunnydanceai-storage';

// Templates that still need preview videos
const remainingTemplates = [
  {
    id: 'twerk-it',
    name: 'Twerk It',
    videoFile: 'template.mp4' // Use the original template.mp4 for this
  },
  {
    id: 'elegant-spin',
    name: 'Elegant Spin',
    videoFile: 'generated-from-test-image.mp4' // Use this test image for elegant spin
  },
  // The other templates don't have corresponding MP4 files in the root directory
  // They would need to be generated or uploaded separately
];

async function uploadRemainingTemplates() {
  console.log('🚀 Starting upload of remaining template videos...\n');

  const uploadedTemplates: { [key: string]: string } = {};

  for (const template of remainingTemplates) {
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const filePath = path.join(process.cwd(), template.videoFile);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ ${template.videoFile} not found in project root - skipping ${template.name}`);
        continue;
      }

      // Upload to templates folder
      const fileName = `templates/${template.id}-${Date.now()}.mp4`;
      const fileRef = bucket.file(fileName);

      console.log(`📤 Uploading ${template.videoFile} for ${template.name}...`);

      await fileRef.save(fs.readFileSync(filePath), {
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
        // Don't use 'public: true' - uniform bucket-level access doesn't support ACLs
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

      console.log(`✅ ${template.name} uploaded successfully!`);
      console.log(`📍 URL: ${publicUrl}`);

      uploadedTemplates[template.id] = publicUrl;

    } catch (error) {
      console.error(`❌ Failed to upload ${template.name}:`, error);
    }
  }

  console.log('\n📝 Update templates.ts with these URLs:');
  console.log('==========================================');

  Object.entries(uploadedTemplates).forEach(([id, url]) => {
    console.log(`  // Add to ${id} template:`);
    console.log(`  previewVideo: '${url}',`);
    console.log('');
  });

  console.log('==========================================');
  console.log('✅ Upload process completed!');
}

uploadRemainingTemplates()
  .then(() => {
    console.log('\n🎉 Remaining templates uploaded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Upload process failed:', error);
    process.exit(1);
  });
