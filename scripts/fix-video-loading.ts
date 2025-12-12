// Script to fix template video loading issues
import { templates } from '../data/templates';

console.log('🔧 Template Video Loading Fix\n');

// Check current status
const templatesWithVideos = templates.filter(t => t.previewVideo);
const templatesWithoutVideos = templates.filter(t => !t.previewVideo);

console.log(`📊 Status: ${templatesWithVideos.length} templates with videos, ${templatesWithoutVideos.length} without videos\n`);

console.log('🎬 Templates with videos:');
templatesWithVideos.forEach((template, index) => {
  console.log(`${index + 1}. ${template.name} (${template.id})`);
  console.log(`   URL: ${template.previewVideo}`);
});

console.log('\n🔍 Issues identified:');
console.log('1. GCP credentials not loading in .env.local');
console.log('2. Signed URLs using Firebase auth instead of GCP');
console.log('3. Videos not accessible without proper credentials');

console.log('\n💡 Solutions:');
console.log('1. Make GCP bucket public (recommended)');
console.log('2. Fix .env.local GCP credentials');
console.log('3. Use direct GCP URLs instead of signed URLs');

console.log('\n📝 Next steps:');
console.log('- Make GCP bucket public in Google Cloud Console');
console.log('- Or fix GCP_SERVICE_ACCOUNT_KEY format in .env.local');
console.log('- Restart server after changes');




