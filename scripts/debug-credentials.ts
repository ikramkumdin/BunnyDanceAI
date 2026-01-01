import dotenv from 'dotenv';
import path from 'path';
import { parseServiceAccountFromEnv } from '../lib/credentials';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

console.log('🔍 Debugging GCP Credentials Configuration\n');
console.log('==========================================\n');

// Check environment variables
const envVars = {
  'GCP_SERVICE_ACCOUNT_KEY_FILE': process.env.GCP_SERVICE_ACCOUNT_KEY_FILE,
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'GCP_SERVICE_ACCOUNT_KEY': process.env.GCP_SERVICE_ACCOUNT_KEY ? 'SET (hidden)' : undefined,
  'GOOGLE_APPLICATION_CREDENTIALS_JSON': process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'SET (hidden)' : undefined,
  'GOOGLE_APPLICATION_CREDENTIALS_BASE64': process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 ? 'SET (hidden)' : undefined,
};

console.log('📋 Environment Variables:');
Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value || '❌ NOT SET'}`);
});
console.log('');

// Try to parse credentials
try {
  const credentials = parseServiceAccountFromEnv();
  
  if (credentials) {
    console.log('✅ Credentials parsed successfully!');
    console.log(`  client_email: ${credentials.client_email || '❌ MISSING'}`);
    console.log(`  private_key: ${credentials.private_key ? '✅ SET' : '❌ MISSING'}`);
    console.log(`  project_id: ${credentials.project_id || '❌ MISSING'}`);
  } else {
    console.log('❌ No credentials found');
  }
} catch (error) {
  console.log('❌ Error parsing credentials:');
  console.log(`  ${error instanceof Error ? error.message : String(error)}`);
  console.log('');
  console.log('💡 Common issues:');
  console.log('  1. JSON is spread across multiple lines - use base64 or single line');
  console.log('  2. JSON is quoted incorrectly - remove outer quotes');
  console.log('  3. Missing required fields: client_email, private_key');
  console.log('');
  console.log('💡 Solutions:');
  console.log('  Option A: Use base64 encoding');
  console.log('    GOOGLE_APPLICATION_CREDENTIALS_BASE64=$(cat service-account.json | base64)');
  console.log('');
  console.log('  Option B: Use file path');
  console.log('    GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json');
  console.log('');
  console.log('  Option C: Single-line JSON (escape quotes)');
  console.log('    GCP_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
}


