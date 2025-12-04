import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function uploadTemplate() {
  try {
    // Initialize GCP Storage
    let credentials;
    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
      credentials = typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string'
        ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
        : process.env.GCP_SERVICE_ACCOUNT_KEY;
    }

    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
      credentials,
    });

    const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
    const bucket = storage.bucket(BUCKET_NAME);

    // Read template.mp4 from project root
    const filePath = path.join(__dirname, '..', 'template.mp4');
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ template.mp4 not found in project root');
      process.exit(1);
    }

    console.log('📤 Uploading template.mp4 to GCP...');

    // Upload to templates folder
    const fileName = `templates/template-${Date.now()}.mp4`;
    const fileRef = bucket.file(fileName);

    const fileBuffer = fs.readFileSync(filePath);

    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    console.log('✅ Upload successful!');
    console.log('\n📝 Public URL:', publicUrl);
    console.log('\n💡 Add this URL to your template in data/templates.ts');
    
    return publicUrl;
  } catch (error) {
    console.error('❌ Error uploading template:', error);
    throw error;
  }
}

uploadTemplate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));



