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

async function uploadKneelCrawlVideo() {
  const videoFile = 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4';
  const filePath = path.join(process.cwd(), videoFile);

  console.log('🎬 Uploading kneel-and-crawl video to GCP...');
  console.log(`📁 File: ${videoFile}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${videoFile}`);
    process.exit(1);
  }

  try {
    const bucket = storage.bucket(BUCKET_NAME);

    // Upload to templates folder with specific naming
    const fileName = `templates/kneel-and-crawl-${Date.now()}.mp4`;
    const fileRef = bucket.file(fileName);

    console.log(`📤 Uploading to: templates/${fileName}`);

    await fileRef.save(fs.readFileSync(filePath), {
      metadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
      },
      // Don't use 'public: true' - uniform bucket-level access doesn't support ACLs
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    console.log(`✅ Upload successful!`);
    console.log(`📍 GCP URL: ${publicUrl}`);
    console.log(`🔗 Direct URL: https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`);

    // Test if the file is accessible
    console.log('\n🧪 Testing accessibility...');
    try {
      const [exists] = await fileRef.exists();
      if (exists) {
        console.log('✅ File exists in GCP bucket');
      } else {
        console.log('❌ File not found in GCP bucket');
      }
    } catch (testError) {
      console.log('⚠️ Could not verify file existence:', testError);
    }

    console.log('\n📝 Update templates.ts with this URL:');
    console.log('==========================================');
    console.log(`// In kneel-and-crawl template:`);
    console.log(`previewVideo: '${publicUrl}',`);
    console.log('==========================================');

    return publicUrl;

  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

uploadKneelCrawlVideo();






