import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

// Initialize GCP Storage client with Firebase credentials (fallback)
const storage = new Storage({
  projectId: 'voice-app-d19d8',
});

const BUCKET_NAME = 'voice-app-storage';

async function uploadRemainingVideos() {
  console.log('📤 Uploading remaining template videos to voice-app-storage...\n');

  const videoMappings = [
    { templateId: 'twerk-it', file: 'template.mp4' },
    { templateId: 'elegant-spin', file: 'generated-from-test-image.mp4' },
    { templateId: 'lustful-touch', file: 'users_a3c4fa44-01f7-40eb-8dd6-8268f5b22c17_generated_1bad7850-bdb7-4e7a-8a83-b14762402eda_generated_video.mp4' },
    { templateId: 'night-club-hip-movement', file: 'users_76d4e22f-07ff-4286-8966-12eb65ecb4c2_generated_416522ba-9e59-4ea1-b20a-152c71a23625_generated_video.mp4' },
    { templateId: 'running-girl', file: 'users_a01f8c58-7460-4320-b70e-fbd0338a998e_generated_ecaee1fa-9a0f-482f-9a51-5e21accc8ed0_generated_video.mp4' },
    { templateId: 'twerk-girl', file: 'users_736bdd50-872a-4d0a-82a0-9016e0baf1c2_generated_d71ed1ff-f55f-4fec-b30b-b8cbbcb22694_generated_video.mp4' },
    { templateId: 'hair-tuck', file: 'users_40bb4f98-1028-4cd7-bd72-c6f3d9710e69_generated_46c7bc65-073e-418a-b513-4f8074a4c205_generated_video.mp4' },
    { templateId: 'sparkling-eye-wink', file: 'users_7366f1ca-9644-44a7-9c2b-91703406401f_generated_e993b5e7-c839-4f0a-aea9-1037654559cf_generated_video.mp4' },
    { templateId: 'snake-sway', file: 'users_781445d3-d465-471f-b844-8fd8814ea9aa_generated_f0c7235b-86bc-40d3-9a56-8e927d7fb27a_generated_video.mp4' },
    { templateId: 'standing-split', file: 'users_196c9dba-f0b5-402d-80ef-33a5afd7e96c_generated_0b574e9d-3875-4e72-a265-501bd4f77389_generated_video.mp4' },
    { templateId: 'kneel-and-crawl', file: 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4' },
  ];

  const bucket = storage.bucket(BUCKET_NAME);

  for (const mapping of videoMappings) {
    try {
      const filePath = path.join(process.cwd(), mapping.file);

      if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${mapping.file} for ${mapping.templateId}`);
        continue;
      }

      const fileName = `templates/${mapping.templateId}-${Date.now()}.mp4`;
      const fileRef = bucket.file(fileName);

      console.log(`📤 Uploading ${mapping.file} → ${fileName}...`);

      await fileRef.save(fs.readFileSync(filePath), {
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
        public: true, // Since bucket has public access
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
      console.log(`✅ ${mapping.templateId} uploaded: ${publicUrl}\n`);

    } catch (error) {
      console.error(`❌ Failed to upload ${mapping.templateId}:`, error);
    }
  }

  console.log('🎉 Upload complete! Now update templates.ts with the new URLs.');
}



