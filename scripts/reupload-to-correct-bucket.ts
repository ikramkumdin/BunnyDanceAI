import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { templates } from '../data/templates';

// Initialize GCP Storage client
const credentials = process.env.GCP_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
  : undefined;

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
  credentials,
});

const BUCKET_NAME = 'voice-app-storage'; // Use the correct bucket name

async function reuploadTemplateVideos() {
  console.log('🔄 Re-uploading template videos to correct bucket...\n');

  const templatesWithVideos = templates.filter(t => t.previewVideo);

  for (const template of templatesWithVideos) {
    try {
      // Extract filename from the current URL
      const urlParts = template.previewVideo!.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Check if we have the original file
      const originalFiles = [
        'users_a3c4fa44-01f7-40eb-8dd6-8268f5b22c17_generated_1bad7850-bdb7-4e7a-8a83-b14762402eda_generated_video.mp4', // lustful-touch
        'users_76d4e22f-07ff-4286-8966-12eb65ecb4c2_generated_416522ba-9e59-4ea1-b20a-152c71a23625_generated_video.mp4', // night-club-hip-movement
        'users_a01f8c58-7460-4320-b70e-fbd0338a998e_generated_ecaee1fa-9a0f-482f-9a51-5e21accc8ed0_generated_video.mp4', // running-girl
        'users_736bdd50-872a-4d0a-82a0-9016e0baf1c2_generated_d71ed1ff-f55f-4fec-b30b-b8cbbcb22694_generated_video.mp4', // twerk-girl
        'users_40bb4f98-1028-4cd7-bd72-c6f3d9710e69_generated_46c7bc65-073e-418a-b513-4f8074a4c205_generated_video.mp4', // hair-tuck
        'users_7366f1ca-9644-44a7-9c2b-91703406401f_generated_e993b5e7-c839-4f0a-aea9-1037654559cf_generated_video.mp4', // sparkling-eye-wink
        'users_781445d3-d465-471f-b844-8fd8814ea9aa_generated_f0c7235b-86bc-40d3-9a56-8e927d7fb27a_generated_video.mp4', // snake-sway
        'users_196c9dba-f0b5-402d-80ef-33a5afd7e96c_generated_0b574e9d-3875-4e72-a265-501bd4f77389_generated_video.mp4', // standing-split
        'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4', // kneel-and-crawl
        'template.mp4', // twerk-it
        'generated-from-test-image.mp4', // elegant-spin
        // shimmy-shake uses template.mp4 which is already uploaded
      ];

      // Find the original file that corresponds to this template
      let originalFile = '';
      if (template.id === 'shimmy-shake') {
        // This uses the existing template.mp4 which is already in the bucket
        console.log(`✅ ${template.name} - already in bucket (template.mp4)`);
        continue;
      } else if (template.id === 'lustful-touch') {
        originalFile = 'users_a3c4fa44-01f7-40eb-8dd6-8268f5b22c17_generated_1bad7850-bdb7-4e7a-8a83-b14762402eda_generated_video.mp4';
      } else if (template.id === 'night-club-hip-movement') {
        originalFile = 'users_76d4e22f-07ff-4286-8966-12eb65ecb4c2_generated_416522ba-9e59-4ea1-b20a-152c71a23625_generated_video.mp4';
      } else if (template.id === 'running-girl') {
        originalFile = 'users_a01f8c58-7460-4320-b70e-fbd0338a998e_generated_ecaee1fa-9a0f-482f-9a51-5e21accc8ed0_generated_video.mp4';
      } else if (template.id === 'twerk-girl') {
        originalFile = 'users_736bdd50-872a-4d0a-82a0-9016e0baf1c2_generated_d71ed1ff-f55f-4fec-b30b-b8cbbcb22694_generated_video.mp4';
      } else if (template.id === 'hair-tuck') {
        originalFile = 'users_40bb4f98-1028-4cd7-bd72-c6f3d9710e69_generated_46c7bc65-073e-418a-b513-4f8074a4c205_generated_video.mp4';
      } else if (template.id === 'sparkling-eye-wink') {
        originalFile = 'users_7366f1ca-9644-44a7-9c2b-91703406401f_generated_e993b5e7-c839-4f0a-aea9-1037654559cf_generated_video.mp4';
      } else if (template.id === 'snake-sway') {
        originalFile = 'users_781445d3-d465-471f-b844-8fd8814ea9aa_generated_f0c7235b-86bc-40d3-9a56-8e927d7fb27a_generated_video.mp4';
      } else if (template.id === 'standing-split') {
        originalFile = 'users_196c9dba-f0b5-402d-80ef-33a5afd7e96c_generated_0b574e9d-3875-4e72-a265-501bd4f77389_generated_video.mp4';
      } else if (template.id === 'kneel-and-crawl') {
        originalFile = 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4';
      } else if (template.id === 'twerk-it') {
        originalFile = 'template.mp4';
      } else if (template.id === 'elegant-spin') {
        originalFile = 'generated-from-test-image.mp4';
      }

      if (!originalFile) {
        console.log(`❌ ${template.name} - no matching file found`);
        continue;
      }

      const filePath = path.join(process.cwd(), originalFile);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ ${template.name} - file not found: ${originalFile}`);
        continue;
      }

      const bucket = storage.bucket(BUCKET_NAME);
      const uploadFileName = `templates/${template.id}-${Date.now()}.mp4`;
      const fileRef = bucket.file(uploadFileName);

      console.log(`📤 Uploading ${originalFile} for ${template.name}...`);

      await fileRef.save(fs.readFileSync(filePath), {
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
        public: true, // Since the bucket allows public access
      });

      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${uploadFileName}`;

      console.log(`✅ ${template.name} uploaded successfully!`);
      console.log(`📍 URL: ${publicUrl}\n`);

      // Update the template URL in memory (we'll save it later)
      template.previewVideo = publicUrl;

    } catch (error) {
      console.error(`❌ Failed to upload ${template.name}:`, error);
    }
  }

  console.log('🎉 Re-upload complete!');
  console.log('\n📝 Template URLs have been updated in memory.');
  console.log('🔄 The templates.ts file has already been updated with correct bucket name.');
}
