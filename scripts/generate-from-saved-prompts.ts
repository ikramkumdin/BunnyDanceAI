import { templatePrompts, getTemplatePrompt } from '../data/template-prompts';

// Script to generate videos using saved template prompts
// Usage: npm run generate-from-prompt <template-id> <image-url>

const args = process.argv.slice(2);
const templateId = args[0];
const imageUrl = args[1];

if (!templateId || !imageUrl) {
  console.log('❌ Usage: npm run generate-from-prompt <template-id> <image-url>');
  console.log('\n📋 Available template IDs:');
  Object.keys(templatePrompts).forEach(id => {
    const template = getTemplatePrompt(id);
    console.log(`  - ${id}: ${template.name} (${template.category}, ${template.intensity})`);
  });
  console.log('\n📝 Example:');
  console.log('  npm run generate-from-prompt lustful-touch https://example.com/image.jpg');
  process.exit(1);
}

const template = getTemplatePrompt(templateId);
if (!template) {
  console.log(`❌ Template "${templateId}" not found!`);
  console.log('\n📋 Available templates:');
  Object.keys(templatePrompts).forEach(id => {
    const t = getTemplatePrompt(id);
    console.log(`  - ${id}: ${t.name}`);
  });
  process.exit(1);
}

console.log('🎬 Generating video with saved prompt...');
console.log(`📝 Template: ${template.name}`);
console.log(`🏷️ Category: ${template.category}`);
console.log(`🌶️ Intensity: ${template.intensity}`);
console.log(`🖼️ Image: ${imageUrl}`);
console.log(`💬 Prompt: ${template.prompt.substring(0, 100)}...`);

// Here you would integrate with your API to generate the video
// For now, just output the data that would be sent to the API

const generationData = {
  imageUrl: imageUrl,
  templateId: templateId,
  prompt: template.prompt,
  intensity: template.intensity,
  category: template.category
};

console.log('\n📤 Generation Data:');
console.log(JSON.stringify(generationData, null, 2));

console.log('\n✅ Ready to generate video!');
console.log('💡 Next: Integrate this with your video generation API endpoint');



