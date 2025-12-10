// Script to check environment variables
console.log('🔍 Environment Variables Check:');
console.log('');

console.log('GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID ? '✅ SET' : '❌ NOT SET');
console.log('GCP_STORAGE_BUCKET:', process.env.GCP_STORAGE_BUCKET ? '✅ SET' : '❌ NOT SET');
console.log('GCP_SERVICE_ACCOUNT_KEY:', process.env.GCP_SERVICE_ACCOUNT_KEY ? '✅ SET (length: ' + process.env.GCP_SERVICE_ACCOUNT_KEY!.length + ')' : '❌ NOT SET');
console.log('GROK_API_URL:', process.env.GROK_API_URL);

console.log('');
console.log('If GCP variables are NOT SET, check your .env.local file format!');



