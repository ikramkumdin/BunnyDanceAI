// Test script to check template video URLs
import { templates } from '../data/templates';

console.log('🎬 Testing template video URLs...\n');

const templatesWithVideos = templates.filter(t => t.previewVideo);
const templatesWithoutVideos = templates.filter(t => !t.previewVideo);

console.log(`📊 Templates with videos: ${templatesWithVideos.length}`);
console.log(`📊 Templates without videos: ${templatesWithoutVideos.length}\n`);

console.log('🎥 Templates WITH videos:');
templatesWithVideos.forEach((template, index) => {
  console.log(`${index + 1}. ${template.name} (${template.id})`);
  console.log(`   URL: ${template.previewVideo}`);
  console.log('');
});

console.log('📝 Templates WITHOUT videos:');
templatesWithoutVideos.forEach((template, index) => {
  console.log(`${index + 1}. ${template.name} (${template.id})`);
  console.log('');
});

console.log('🔍 First row analysis:');
const firstRow = templates.slice(0, 3);
console.log('First 3 templates:');
firstRow.forEach((template, index) => {
  const hasVideo = !!template.previewVideo;
  console.log(`${index + 1}. ${template.name} - ${hasVideo ? 'HAS VIDEO' : 'NO VIDEO'}`);
  if (hasVideo) {
    console.log(`   URL: ${template.previewVideo}`);
  }
});
