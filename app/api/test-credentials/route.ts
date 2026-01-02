import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/storage';
import { parseServiceAccountFromEnv } from '@/lib/credentials';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // 3. Test Kie.ai I2V
    try {
      const grokApiKey = process.env.GROK_API_KEY;
      if (grokApiKey) {
        const testBody = {
          model: 'grok-imagine/image-to-video',
          input: {
            image_urls: ['https://storage.googleapis.com/bunnydanceai-storage/test-user/debug/1735827415555-image-1735827415555.jpg'],
            prompt: 'Diagnostic test prompt: A person dancing.',
          }
        };

        const startTime = Date.now();
        const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${grokApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testBody)
        });
        const duration = Date.now() - startTime;

        results.kieStatus = kieResponse.status;
        results.kieDuration = `${duration}ms`;

        const kieData = await kieResponse.json();
        results.kieResponse = kieData;

        if (kieResponse.ok && kieData.code === 200) {
          results.kieTest = 'SUCCESS';
        } else {
          results.kieTest = `FAILED: ${kieData.msg || kieData.message || 'Unknown error'}`;
        }
      }
    } catch (e) {
      results.kieTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }

    // 4. Test Kie.ai T2V
    try {
      const grokApiKey = process.env.GROK_API_KEY;
      if (grokApiKey) {
        const testBody = {
          model: 'grok-imagine/text-to-video',
          input: {
            prompt: 'Diagnostic test: A forest in autumn.',
          }
        };

        const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${grokApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testBody)
        });

        const kieData = await kieResponse.json();
        results.kieT2VStatus = kieResponse.status;
        results.kieT2VResponse = kieData;
        results.kieT2VTest = (kieResponse.ok && kieData.code === 200) ? 'SUCCESS' : 'FAILED';
      }
    } catch (e) {
      results.kieT2VTest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
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
