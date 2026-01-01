
import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/storage';
import { parseServiceAccountFromEnv } from '@/lib/credentials';

export async function GET(request: NextRequest) {
  const envStatus = {
    GROK_API_KEY: !!process.env.GROK_API_KEY,
    GCP_STORAGE_BUCKET: !!process.env.GCP_STORAGE_BUCKET,
    GOOGLE_APPLICATION_CREDENTIALS_BASE64: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
    GCP_PROJECT_ID: !!process.env.GCP_PROJECT_ID,
  };

  const results: any = {
    env: envStatus,
    credentialsParse: 'PENDING',
    gcsUpload: 'PENDING',
  };

  try {
    // 1. Test parsing credentials
    try {
      const creds = parseServiceAccountFromEnv();
      results.credentialsParse = creds ? 'SUCCESS' : 'FAILED (Returned null)';
      if (creds) {
        results.projectId = creds.project_id;
        results.clientEmail = creds.client_email;
      }
    } catch (e) {
      results.credentialsParse = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // 2. Test Upload to GCS
    try {
      // Tiny 1x1 pixel transparent GIF base64
      const testBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const url = await uploadImage(testBase64, 'test-user', 'debug');
      results.gcsUpload = 'SUCCESS';
      results.gcsUrl = url;
    } catch (e) {
      results.gcsUpload = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error in diagnostic',
      details: error instanceof Error ? error.message : String(error),
      env: envStatus
    }, { status: 500 });
  }
}

