import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load .env.local to read current values
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

console.log('🔧 Fixing GCP credentials in .env.local\n');

// Read the .env.local file
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ Could not read .env.local file');
  process.exit(1);
}

// Try to extract JSON from GCP_SERVICE_ACCOUNT_KEY
const lines = envContent.split('\n');
let jsonStartLine = -1;
let jsonEndLine = -1;
let jsonLines: string[] = [];

// Find where the JSON starts and ends
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('GCP_SERVICE_ACCOUNT_KEY') && line.includes('{')) {
    jsonStartLine = i;
    // Check if it's all on one line
    if (line.includes('}')) {
      jsonEndLine = i;
      jsonLines = [line];
      break;
    } else {
      // Multi-line JSON
      jsonLines.push(line);
      // Continue reading until we find the closing brace
      for (let j = i + 1; j < lines.length; j++) {
        jsonLines.push(lines[j]);
        if (lines[j].includes('}')) {
          jsonEndLine = j;
          break;
        }
      }
      break;
    }
  }
}

if (jsonStartLine === -1) {
  console.log('⚠️  Could not find GCP_SERVICE_ACCOUNT_KEY in .env.local');
  console.log('💡 Make sure you have GCP_SERVICE_ACCOUNT_KEY set in your .env.local file');
  process.exit(1);
}

// Extract the JSON value
const jsonLine = jsonLines.join('\n');
const match = jsonLine.match(/GCP_SERVICE_ACCOUNT_KEY\s*=\s*(.+)/s);
if (!match) {
  console.log('⚠️  Could not extract JSON value from GCP_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

let jsonValue = match[1].trim();

// Remove quotes if present
if ((jsonValue.startsWith('"') && jsonValue.endsWith('"')) || 
    (jsonValue.startsWith("'") && jsonValue.endsWith("'"))) {
  jsonValue = jsonValue.slice(1, -1);
}

// Validate JSON
let parsedJson;
try {
  parsedJson = JSON.parse(jsonValue);
  console.log('✅ JSON is valid');
  console.log(`   Project: ${parsedJson.project_id || 'N/A'}`);
  console.log(`   Client Email: ${parsedJson.client_email?.substring(0, 30) || 'N/A'}...`);
} catch (error) {
  console.error('❌ Invalid JSON:', error instanceof Error ? error.message : String(error));
  console.log('\n📋 First 200 chars of JSON:');
  console.log(jsonValue.substring(0, 200));
  process.exit(1);
}

// Convert to base64
const base64Json = Buffer.from(jsonValue).toString('base64');
console.log(`\n✅ Converted to base64 (${base64Json.length} chars)`);

// Create new .env.local content
const newLines = [...lines];

// Remove old GCP_SERVICE_ACCOUNT_KEY lines
for (let i = jsonEndLine; i >= jsonStartLine; i--) {
  newLines.splice(i, 1);
}

// Add base64 version
const base64Line = `GOOGLE_APPLICATION_CREDENTIALS_BASE64=${base64Json}`;
newLines.splice(jsonStartLine, 0, base64Line);

// Also comment out or remove the old line if it exists elsewhere
const newContent = newLines.join('\n');

// Backup original
const backupPath = envPath + '.backup';
fs.writeFileSync(backupPath, envContent);
console.log(`\n💾 Backup saved to: ${backupPath}`);

// Write new content
fs.writeFileSync(envPath, newContent);
console.log(`\n✅ Updated .env.local with base64-encoded credentials`);
console.log(`\n📝 Changes:`);
console.log(`   - Removed multi-line GCP_SERVICE_ACCOUNT_KEY`);
console.log(`   - Added GOOGLE_APPLICATION_CREDENTIALS_BASE64`);
console.log(`\n🔄 Please restart your Next.js dev server for changes to take effect.`);


