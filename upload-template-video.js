const fs = require('fs');
const path = require('path');

// Simple upload script using direct GCP client
async function uploadTemplateVideo() {
  try {
    const videoPath = path.join(__dirname, 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4');

    console.log('📤 Uploading template video to GCP...');
    console.log('📁 File path:', videoPath);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File not found: ${videoPath}`);
    }

    // Read the video file
    const videoBuffer = fs.readFileSync(videoPath);
    console.log('📏 File size:', (videoBuffer.length / 1024 / 1024).toFixed(2), 'MB');

    // Import GCP storage dynamically
    const { Storage } = require('@google-cloud/storage');

    // Initialize GCP Storage
    const storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
      credentials: process.env.GCP_SERVICE_ACCOUNT_KEY ?
        (typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string' ?
          JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY) :
          process.env.GCP_SERVICE_ACCOUNT_KEY) : undefined,
    });

    const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
    const bucket = storage.bucket(BUCKET_NAME);

    // Create file path
    const fileName = `templates/dance-template-${Date.now()}.mp4`;
    const fileRef = bucket.file(fileName);

    console.log('📤 Uploading to GCP...');

    // Upload file
    await fileRef.save(videoBuffer, {
      metadata: {
        contentType: 'video/mp4',
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

    console.log('✅ Video uploaded successfully!');
    console.log('📍 Public URL:', publicUrl);

    // Generate signed URL for private access
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 3600 * 1000, // 1 hour
    });

    console.log('🔗 Signed URL:', signedUrl);

    return { publicUrl, signedUrl };

  } catch (error) {
    console.error('❌ Error uploading video:', error);
    throw error;
  }
}

// Function to update templates.ts with new video URL
function updateTemplatesFile(videoUrl, slot = 1) {
  const fs = require('fs');
  const path = require('path');

  const templatesPath = path.join(__dirname, 'data', 'templates.ts');

  try {
    let content = fs.readFileSync(templatesPath, 'utf8');

    // Update the previewVideo for the specified custom template slot
    const templateId = `custom-template-${slot}`;
    const regex = new RegExp(`(id: '${templateId}'[\\s\\S]*?previewVideo:\\s*)'[^']*'`, 'm');
    content = content.replace(regex, `$1'${videoUrl}'`);

    fs.writeFileSync(templatesPath, content, 'utf8');
    console.log(`✅ Updated ${templateId} with new video URL`);
  } catch (error) {
    console.error('❌ Failed to update templates file:', error.message);
  }
}

// Function to upload multiple videos
async function uploadMultipleVideos() {
  const videoFiles = [
    'users_40bb4f98-1028-4cd7-bd72-c6f3d9710e69_generated_46c7bc65-073e-418a-b513-4f8074a4c205_generated_video.mp4',
    'users_76d4e22f-07ff-4286-8966-12eb65ecb4c2_generated_416522ba-9e59-4ea1-b20a-152c71a23625_generated_video.mp4',
    'users_196c9dba-f0b5-402d-80ef-33a5afd7e96c_generated_0b574e9d-3875-4e72-a265-501bd4f77389_generated_video.mp4',
    'users_7366f1ca-9644-44a7-9c2b-91703406401f_generated_e993b5e7-c839-4f0a-aea9-1037654559cf_generated_video.mp4',
    'users_781445d3-d465-471f-b844-8fd8814ea9aa_generated_f0c7235b-86bc-40d3-9a56-8e927d7fb27a_generated_video.mp4',
    'users_a01f8c58-7460-4320-b70e-fbd0338a998e_generated_ecaee1fa-9a0f-482f-9a51-5e21accc8ed0_generated_video.mp4',
    'users_a3c4fa44-01f7-40eb-8dd6-8268f5b22c17_generated_1bad7850-bdb7-4e7a-8a83-b14762402eda_generated_video.mp4'
  ];

  const fs = require('fs');
  const path = require('path');

  for (let i = 0; i < videoFiles.length; i++) {
    const videoFile = videoFiles[i];
    const videoPath = path.join(__dirname, videoFile);
    const slotNumber = 2 + i; // Start from slot 2 (since slot 1 is taken)

    console.log(`\n📤 Uploading video ${i + 1}/${videoFiles.length}: ${videoFile}`);
    console.log(`🎯 Will be assigned to Custom Dance ${slotNumber}`);

    if (!fs.existsSync(videoPath)) {
      console.error(`❌ File not found: ${videoPath}`);
      continue;
    }

    try {
      // Read the video file
      const videoBuffer = fs.readFileSync(videoPath);
      console.log(`📏 File size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Import GCP storage dynamically
      const { Storage } = require('@google-cloud/storage');

      // Initialize GCP Storage
      const storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
        credentials: process.env.GCP_SERVICE_ACCOUNT_KEY ?
          (typeof process.env.GCP_SERVICE_ACCOUNT_KEY === 'string' ?
            JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY) :
            process.env.GCP_SERVICE_ACCOUNT_KEY) : undefined,
      });

      const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'voice-app-storage';
      const bucket = storage.bucket(BUCKET_NAME);

      // Upload to templates folder
      const fileName = `templates/custom-dance-extra-${i + 1}-${Date.now()}.mp4`;
      const fileRef = bucket.file(fileName);

      console.log('📤 Uploading to GCP...');

      // Upload file
      await fileRef.save(videoBuffer, {
        metadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000',
        },
        public: true,
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

      console.log(`✅ Video ${i + 1} uploaded successfully!`);
      console.log(`📍 Public URL: ${publicUrl}`);

      // Update templates file with the new video URL
      updateTemplatesFile(publicUrl, slotNumber);

    } catch (error) {
      console.error(`💥 Failed to upload video ${i + 1}:`, error.message);
    }
  }
}

// Run the upload if this script is executed directly
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'multiple') {
    uploadMultipleVideos()
      .then(() => {
        console.log('\n🎉 All uploads complete!');
        console.log('✅ Templates updated with new video URLs!');
        console.log('🔄 Restart your dev server to see the new videos.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Multiple upload failed:', error.message);
        process.exit(1);
      });
  } else {
    const slot = process.argv[2] ? parseInt(process.argv[2]) : 1; // Allow specifying slot number

    uploadTemplateVideo()
      .then((result) => {
        console.log('\n🎉 Upload complete!');
        console.log('📍 Public URL:', result.publicUrl);
        console.log('🔗 Signed URL:', result.signedUrl);
        console.log(`🎯 Updating custom template slot ${slot}...`);

        updateTemplatesFile(result.publicUrl, slot);

        console.log('\n✅ Template updated! Restart your dev server to see changes.');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Upload failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = { uploadTemplateVideo };
