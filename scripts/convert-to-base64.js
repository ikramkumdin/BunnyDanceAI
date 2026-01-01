const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

console.log('🔧 Converting multi-line JSON to base64 in .env.local\n');

// Read .env.local
let content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n');

// Find GCP_SERVICE_ACCOUNT_KEY section (lines 19-31)
let jsonStart = -1;
let jsonEnd = -1;
let jsonParts = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('GCP_SERVICE_ACCOUNT_KEY') && (line.includes('{') || line.includes('"type"'))) {
    jsonStart = i;
    // Collect all lines until we find the closing brace
    for (let j = i; j < lines.length; j++) {
      jsonParts.push(lines[j]);
      if (lines[j].includes('}') && lines[j].trim().endsWith('}')) {
        jsonEnd = j;
        break;
      }
    }
    break;
  }
}

if (jsonStart === -1) {
  console.log('❌ Could not find GCP_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

// Extract JSON value
const jsonBlock = jsonParts.join('\n');
const match = jsonBlock.match(/GCP_SERVICE_ACCOUNT_KEY\s*=\s*(.+)/s);

if (!match) {
  console.log('❌ Could not extract JSON');
  console.log('First 200 chars:', jsonBlock.substring(0, 200));
  process.exit(1);
}

let jsonStr = match[1].trim();

// Remove outer quotes
if ((jsonStr.startsWith('"') && jsonStr.endsWith('"')) || 
    (jsonStr.startsWith("'") && jsonStr.endsWith("'"))) {
  jsonStr = jsonStr.slice(1, -1);
}

// Validate and parse JSON
try {
  const parsed = JSON.parse(jsonStr);
  console.log('✅ JSON is valid');
  console.log(`   Project: ${parsed.project_id || 'N/A'}`);
} catch (e) {
  console.log('❌ Invalid JSON:', e.message);
  console.log('First 200 chars:', jsonStr.substring(0, 200));
  process.exit(1);
}

// Convert to base64
const base64 = Buffer.from(jsonStr).toString('base64');
console.log(`✅ Converted to base64 (${base64.length} chars)\n`);

// Create new content
const newLines = [...lines];

// Remove old lines
for (let i = jsonEnd; i >= jsonStart; i--) {
  newLines.splice(i, 1);
}

// Add base64 version
newLines.splice(jsonStart, 0, `GOOGLE_APPLICATION_CREDENTIALS_BASE64=${base64}`);

// Backup
fs.writeFileSync(envPath + '.backup', content);
console.log('💾 Backup saved to .env.local.backup');

// Write new content
fs.writeFileSync(envPath, newLines.join('\n'));
console.log('✅ Updated .env.local');
console.log('\n🔄 Restart your Next.js dev server!');


