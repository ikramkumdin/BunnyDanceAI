// Debug script to test signed URL fetching like the frontend does
const templates = require('../data/templates.ts').templates;

async function debugTemplateVideos() {
  console.log('🔍 Debugging template video loading...\n');

  const urls: { [key: string]: string } = {};

  console.log('📡 Testing signed URL fetches for first 3 templates:\n');

  for (let i = 0; i < 3; i++) {
    const template = templates[i];
    console.log(`${i + 1}. ${template.name} (${template.id})`);

    if (template.previewVideo) {
      console.log(`   Original URL: ${template.previewVideo}`);

      try {
        console.log(`   Fetching signed URL...`);
        const signedResponse = await fetch(`http://localhost:3009/api/get-signed-url?path=${encodeURIComponent(template.previewVideo)}`);

        if (signedResponse.ok) {
          const data = await signedResponse.json();
          urls[template.id] = data.url;
          console.log(`   ✅ Signed URL: ${data.url.substring(0, 100)}...`);
        } else {
          console.log(`   ❌ Signed URL failed: ${signedResponse.status}`);
          urls[template.id] = template.previewVideo;
          console.log(`   📝 Using fallback: ${template.previewVideo}`);
        }
      } catch (error) {
        console.log(`   ❌ Fetch error: ${error.message}`);
        urls[template.id] = template.previewVideo;
        console.log(`   📝 Using fallback: ${template.previewVideo}`);
      }
    } else {
      console.log(`   ❌ No previewVideo URL`);
    }

    console.log('');
  }

  console.log('📊 Final URL mapping:');
  Object.entries(urls).forEach(([id, url]) => {
    console.log(`   ${id}: ${url.substring(0, 80)}...`);
  });
}

debugTemplateVideos().catch(console.error);
