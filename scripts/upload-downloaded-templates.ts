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

// Template configurations based on user's examples
const templates = [
  {
    name: 'lustful-touch',
    description: 'A stunningly beautiful young woman with perfect symmetrical face, flawless porcelain skin, long flowing hair, seductive expression, wearing a tight low-cut top that accentuates her figure. She stands in an elegant luxurious bedroom with soft warm lighting. She slowly and sensually brings her hand up to her chest, gently touching and caressing her breasts through the fabric in a teasing and erotic way, biting her lower lip, looking directly at the camera with intense eye contact, subtle smile, slow graceful movements, highly detailed skin texture, realistic physics and fabric movement.',
    category: 'playful',
    intensity: 'spicy',
    videoFile: 'users_a3c4fa44-01f7-40eb-8dd6-8268f5b22c17_generated_1bad7850-bdb7-4e7a-8a83-b14762402eda_generated_video.mp4'
  },
  {
    name: 'night-club-hip-movement',
    description: 'A beautiful young woman， based on the reference image for her face and body. She is standing in a dimly lit nightclub with colorful lights, rhythmically shaking and twerking her hips and butt to upbeat music. Smooth, realistic animation, high-resolution 4K video, 10-second loop, slow-motion emphasis on the hip movements, cinematic camera panning from side to back view.',
    category: 'shimmy',
    intensity: 'spicy',
    videoFile: 'users_76d4e22f-07ff-4286-8966-12eb65ecb4c2_generated_416522ba-9e59-4ea1-b20a-152c71a23625_generated_video.mp4'
  },
  {
    name: 'running-girl',
    description: 'A stunning athletic woman , based on the reference image for her face and physique. She is running dynamically . Her bra bounce  with each step, captured in slow-motion for emphasis. Realistic animation, dynamic camera following from front and side angles, vibrant natural lighting.',
    category: 'sway',
    intensity: 'mild',
    videoFile: 'users_a01f8c58-7460-4320-b70e-fbd0338a998e_generated_ecaee1fa-9a0f-482f-9a51-5e21accc8ed0_generated_video.mp4'
  },
  {
    name: 'twerk-girl',
    description: 'based on the reference image for her face and physique.tiktok-style edge dance. Intense hip thrusting, aggressive twerking, ass shaking,  waist rolling, seductive hair flips, provocative eye contact and biting lip, slow-motion sections mixed with fast rhythm beats, side-to-back camera rotation focusing heavily on her hips and ass shaking',
    category: 'peach',
    intensity: 'extreme',
    videoFile: 'users_736bdd50-872a-4d0a-82a0-9016e0baf1c2_generated_d71ed1ff-f55f-4fec-b30b-b8cbbcb22694_generated_video.mp4'
  },
  {
    name: 'hair-tuck',
    description: 'A highly detailed animated sequence of a beautiful woman with long, flowing hair performing a gentle hair tuck gesture: she gracefully lifts her hand to brush a strand of hair behind her ear, smiling softly with a serene expression. The animation is smooth, realistic, and in high resolution, based on the provided reference image for her facial features, clothing, and overall style. Use cinematic lighting, subtle wind effects on the hair, and a neutral background to emphasize the motion.',
    category: 'playful',
    intensity: 'mild',
    videoFile: 'users_40bb4f98-1028-4cd7-bd72-c6f3d9710e69_generated_46c7bc65-073e-418a-b513-4f8074a4c205_generated_video.mp4'
  },
  {
    name: 'sparkling-eye-wink',
    description: 'A highly detailed animated sequence of a beautiful woman based on the reference image, subtly flirting with the viewer by sending a coy wink towards the camera: she locks eyes with the screen, tilts her head playfully, gives a slow, seductive one-eyed wink while her lips curve into a teasing smile, with sparkling eyes and a hint of mischief. The animation is ultra-smooth, realistic, and in high resolution, capturing her exact facial features, hair, makeup, and clothing from the reference. Use soft cinematic lighting with a gentle glow on her face, subtle particle effects like fluttering eyelashes, and a neutral blurred background to focus on the expression and motion.',
    category: 'playful',
    intensity: 'mild',
    videoFile: 'users_7366f1ca-9644-44a7-9c2b-91703406401f_generated_e993b5e7-c839-4f0a-aea9-1037654559cf_generated_video.mp4'
  },
  {
    name: 'shush-finger',
    description: 'A highly detailed animated sequence of a beautiful woman based on the reference image, starting with a sensual tongue-out gesture: she playfully extends her tongue slightly while gazing seductively at the camera, her lips parted in a teasing manner with a flirtatious sparkle in her eyes. Then, she transitions smoothly to the shush finger pose: raising her index finger to her lips in a "shh" gesture, her expression turning mysterious and inviting, with a subtle wink or smile. The animation is ultra-smooth, realistic, and in high resolution, faithfully replicating her facial features, hair, makeup, clothing, and overall style from the reference. Use soft cinematic lighting with warm highlights on her face, gentle particle effects like glistening on the tongue and subtle finger motion blur, and a neutral blurred background to highlight the sequential actions.',
    category: 'playful',
    intensity: 'spicy',
    videoFile: 'users_db2533cb-8c63-43fc-8c52-e3000110b166_generated_dd45354b-fefc-47d8-8337-eb4c2ac04422_generated_video.mp4'
  },
  {
    name: 'snake-sway',
    description: 'A highly detailed animated sequence of a beautiful woman based on the reference image, performing a seductive snake sway dance: she fluidly undulates her body in a serpentine wave motion starting from her hips, rolling up through her torso and shoulders in a hypnotic, snake-like sway, with graceful arm movements mimicking coiling and uncoiling, her expression sultry and confident with a subtle smile and intense gaze at the camera. The animation is ultra-smooth, realistic, and in high resolution, accurately capturing her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to accentuate the curves and motion, subtle particle effects like flowing fabric or hair movement, and a neutral blurred background to focus on the dance.',
    category: 'sway',
    intensity: 'spicy',
    videoFile: 'users_781445d3-d465-471f-b844-8fd8814ea9aa_generated_f0c7235b-86bc-40d3-9a56-8e927d7fb27a_generated_video.mp4'
  },
  {
    name: 'standing-split',
    description: 'A highly detailed animated sequence of a beautiful woman based on the reference image, performing a graceful standing split pose: she starts in a standing position, elegantly lifts one leg straight up high in front of her body while balancing on the other leg, extending her arms for poise and stability, her expression focused and serene with a subtle confident smile and direct gaze at the camera, showcasing flexibility and strength in a fluid motion. The animation is ultra-smooth, realistic, and in high resolution, accurately replicating her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to emphasize the leg extension and body lines, subtle particle effects like gentle fabric flow or hair movement, and a neutral blurred background to focus on the pose.',
    category: 'sway',
    intensity: 'mild',
    videoFile: 'users_196c9dba-f0b5-402d-80ef-33a5afd7e96c_generated_0b574e9d-3875-4e72-a265-501bd4f77389_generated_video.mp4'
  },
  {
    name: 'kneel-and-crawl',
    description: 'A highly detailed animated sequence of a beautiful woman based on the reference image, performing a seductive kneel and crawl movement: she starts in a standing pose, gracefully lowers herself to her knees with elegant poise, then transitions into a fluid crawl forward on all fours, arching her back slightly in a cat-like manner, her hips swaying rhythmically, with a sultry expression, parted lips, and intense gaze directed at the camera to convey allure and confidence. The animation is ultra-smooth, realistic, and in high resolution, accurately replicating her facial features, hair, makeup, clothing, and overall style from the reference. Use dynamic cinematic lighting with soft shadows and highlights to accentuate her curves and motion, subtle particle effects like flowing hair or fabric movement, and a neutral blurred background to focus on the action.',
    category: 'peach',
    intensity: 'spicy',
    videoFile: 'users_9d5c51d1-aae9-4abe-b7cc-4c18e48ee313_generated_3eabe9d7-3698-4409-bf3b-79c47f5d601c_generated_video.mp4'
  }
];

async function uploadTemplateVideo(template: typeof templates[0]): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const filePath = path.join(process.cwd(), template.videoFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${template.videoFile} not found in project root`);
    throw new Error(`File not found: ${template.videoFile}`);
  }

  // Upload to templates folder
  const fileName = `templates/${template.name}-${Date.now()}.mp4`;
  const fileRef = bucket.file(fileName);

  console.log(`📤 Uploading ${template.videoFile} as ${template.name}...`);

  await fileRef.save(fs.readFileSync(filePath), {
    metadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000',
    },
    public: true,
  });

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;

  console.log(`✅ ${template.name} uploaded successfully!`);
  console.log(`📍 URL: ${publicUrl}`);

  return publicUrl;
}

async function main() {
  console.log('🚀 Starting template video upload process...\n');

  const uploadedTemplates = [];

  for (const template of templates) {
    try {
      const url = await uploadTemplateVideo(template);
      uploadedTemplates.push({
        ...template,
        previewVideo: url
      });
      console.log(''); // Add spacing
    } catch (error) {
      console.error(`❌ Failed to upload ${template.name}:`, error);
      console.log(''); // Add spacing
    }
  }

  console.log('📝 Template configuration for templates.ts:');
  console.log('==========================================');

  uploadedTemplates.forEach(template => {
    console.log(`  {
    id: '${template.name.replace(/[^a-z0-9]/g, '-').toLowerCase()}',
    name: '${template.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}',
    description: '${template.description}',
    thumbnail: '/templates/${template.name}.jpg',
    category: '${template.category}',
    intensity: '${template.intensity}',
    prompt: '${template.description}',
    isPremium: ${template.intensity === 'extreme' || template.intensity === 'spicy'},
    isHidden: false,
    previewVideo: '${template.previewVideo}',
  },`);
  });

  console.log('==========================================');
  console.log('✅ Upload process completed!');
}

main()
  .then(() => {
    console.log('\n🎉 All templates uploaded successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Upload process failed:', error);
    process.exit(1);
  });
