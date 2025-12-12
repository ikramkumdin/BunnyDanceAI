import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/data/templates';
import { IntensityLevel } from '@/types';
import { uploadVideo, uploadImage } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper function to save video to database
async function saveVideoToDatabase({
  videoUrl,
  userId,
  templateId,
  templateName,
  thumbnail,
  prompt
}: {
  videoUrl: string;
  userId: string;
  templateId: string;
  templateName: string;
  thumbnail: string;
  prompt: string;
}) {
  try {
    const videoData = {
      videoUrl,
      userId,
      templateId,
      templateName,
      thumbnail,
      prompt,
      createdAt: new Date(),
      isWatermarked: false,
      tags: [],
    };

    const docRef = await adminDb.collection('videos').add(videoData);
    console.log('✅ Video saved to database:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Failed to save video to database:', error);
    throw error;
  }
}

// Helper function to upload image to Kie.ai's servers
async function uploadImageToKie(imagePath: string, apiKey: string): Promise<string> {
  try {
    console.log('📤 Uploading image to Kie.ai File Upload API...');
    console.log('📁 Image path:', imagePath);

    // Import storage dynamically (only when needed)
    const { adminStorage } = await import('@/lib/firebase-admin');

    // Parse the GCS path
    let bucketName = process.env.GCP_STORAGE_BUCKET || 'bunnydanceai-storage';
    let filePath = imagePath;

    // Handle different path formats
    if (imagePath.startsWith('gs://')) {
      // Format: gs://bucket-name/path/to/file
      const gsUrl = imagePath.replace('gs://', '');
      const parts = gsUrl.split('/');
      bucketName = parts[0];
      filePath = parts.slice(1).join('/');
    } else if (imagePath.startsWith('https://storage.googleapis.com/')) {
      // Format: https://storage.googleapis.com/bucket-name/path/to/file
      const url = new URL(imagePath);
      const pathParts = url.pathname.substring(1).split('/'); // Remove leading slash
      bucketName = pathParts[0];
      filePath = pathParts.slice(1).join('/');
    } else if (imagePath.includes('voice-app-storage/')) {
      // Legacy format: might have bucket in path
      bucketName = 'voice-app-storage';
      filePath = imagePath.split('voice-app-storage/')[1] || imagePath;
    }

    console.log(`📦 Bucket: ${bucketName}, File: ${filePath}`);

    // Download image from GCS
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [imageBuffer] = await file.download();
    console.log(`📊 Image size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Get file metadata to determine content type
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'image/jpeg';

    // Upload to Kie.ai using their File Upload API
    console.log('🔄 Uploading to Kie.ai File Upload API...');

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: contentType });
    formData.append('file', blob, 'image.jpg');

    const uploadResponse = await fetch('https://api.kie.ai/api/v1/file-upload/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`❌ Kie.ai upload failed: ${uploadResponse.status} - ${errorText}`);
      throw new Error(`Kie.ai upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Kie.ai upload response:', uploadResult);

    // Extract the uploaded image URL from the response
    const kieImageUrl = uploadResult.url || uploadResult.data?.url || uploadResult.fileUrl || uploadResult.data?.fileUrl || uploadResult.imageUrl;

    if (!kieImageUrl) {
      console.error('❌ No URL in upload response:', uploadResult);
      throw new Error(`No URL in upload response: ${JSON.stringify(uploadResult)}`);
    }

    console.log('✅ Kie.ai image URL:', kieImageUrl);
    return kieImageUrl;
  } catch (error) {
    console.error('❌ Failed to upload image to Kie.ai:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, imageDataUrl, templateId, intensity = 'mild', userId } = body;

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      console.error('❌ GROK_API_KEY is not configured in environment');
      console.log('🔍 Available env vars:', Object.keys(process.env).filter(key => key.includes('GROK') || key.includes('API')));
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured. Please add it to Vercel environment variables' },
        { status: 500 }
      );
    }

    console.log('🚀 API called with templateId:', templateId);
    console.log('📊 Total templates loaded:', templates.length);
    console.log('📋 First few templates:', templates.slice(0, 3).map(t => ({ id: t.id, name: t.name })));

    if ((!imageUrl && !imageDataUrl) || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find template
    console.log('🔍 Looking for template with ID:', templateId);
    console.log('📋 Available template IDs:', templates.map(t => t.id));
    const template = templates.find((t) => t.id === templateId);
    console.log('✅ Found template:', template ? { id: template.id, name: template.name } : 'NOT FOUND');

    if (!template) {
      return NextResponse.json(
        { error: `Template not found for ID: ${templateId}` },
        { status: 404 }
      );
    }

    // Build prompt from template - Simple and safe prompt to avoid safety filters
    console.log('📝 Raw template.prompt:', template.prompt);
    console.log('📝 Template object:', { id: template.id, name: template.name, category: template.category });
    
    // Use extremely simple prompt to test if image is the issue
    let prompt = `A person standing and waving at the camera in a friendly way, natural lighting, professional video quality.`;

    console.log('📝 Final constructed prompt:', prompt);

    // We need an image URL accessible by Kie.ai. If the client provided base64,
    // upload it to Kie.ai File Upload API and use the returned URL.
    let accessibleImageUrl: string | undefined;
    try {
      if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')) {
        console.log('📤 Received base64 imageDataUrl; uploading to Kie.ai File Upload API...');
        const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) throw new Error('Invalid imageDataUrl format');
        const mimeType = match[1];
        const base64 = match[2];
        const buffer = Buffer.from(base64, 'base64');

        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, 'upload-image');

        const uploadResponse = await fetch('https://api.kie.ai/api/v1/file-upload/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Kie.ai file upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const kieImageUrl = uploadResult.url || uploadResult.data?.url || uploadResult.fileUrl || uploadResult.data?.fileUrl || uploadResult.imageUrl;
        if (!kieImageUrl) throw new Error(`No URL in Kie upload response: ${JSON.stringify(uploadResult)}`);

        accessibleImageUrl = kieImageUrl;
        console.log('✅ Kie.ai uploaded image URL:', accessibleImageUrl);
      } else {
        console.log('🔗 Making image publicly accessible for Kie.ai...');

        // Prefer Kie.ai File Upload API so Veo can fetch reliably (and avoid GCS access/size quirks).
        // If this succeeds, we don't need to make the object public or generate a signed URL.
        try {
          if (typeof imageUrl === 'string' && imageUrl.length > 0) {
            const kieHostedUrl = await uploadImageToKie(imageUrl, apiKey);
            accessibleImageUrl = kieHostedUrl;
            console.log('✅ Using Kie-hosted image URL for generation:', accessibleImageUrl);
            // Skip GCS makePublic path
            console.log('⏭️ Skipping GCS makePublic/signed-url because Kie upload succeeded');
          }
        } catch (kieUploadErr) {
          console.warn(
            '⚠️ Kie file upload fallback failed; continuing with GCS public/signed-url flow:',
            kieUploadErr instanceof Error ? kieUploadErr.message : String(kieUploadErr)
          );
        }

        if (accessibleImageUrl) {
          // We already have a Kie-hosted URL; no more work needed.
        } else {
        // Import storage
        const { adminStorage } = await import('@/lib/firebase-admin');

        // Parse the GCS path
        let bucketName = 'voice-app-storage';
        let filePath = imageUrl;

        if (imageUrl.startsWith('https://storage.googleapis.com/')) {
          const url = new URL(imageUrl);
          const pathParts = url.pathname.substring(1).split('/');
          bucketName = pathParts[0];
          filePath = pathParts.slice(1).join('/');
        } else if (imageUrl.includes('voice-app-storage/')) {
          filePath = imageUrl.split('voice-app-storage/')[1] || imageUrl;
        }

        console.log(`📦 Bucket: ${bucketName}, File: ${filePath}`);

        const bucket = adminStorage.bucket(bucketName);
        const file = bucket.file(filePath);

        // Make the file publicly readable
        await file.makePublic();
        console.log('✅ Made image publicly accessible');

        // Get the public URL
        accessibleImageUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
        console.log('📸 Public GCS URL:', accessibleImageUrl);
        }
      }

    } catch (publicError) {
      console.error('❌ Error making image public:', publicError);

      // Fallback to signed URL
      console.log('🔄 Falling back to signed URL...');
      try {
        const signedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009'}/api/get-signed-url?path=${encodeURIComponent(imageUrl)}`);

        if (signedUrlResponse.ok) {
          const signedUrlData = await signedUrlResponse.json();
          accessibleImageUrl = signedUrlData.url;
          console.log('✅ Using signed URL fallback');
        } else {
          throw new Error('Signed URL fallback also failed');
        }
      } catch (signedUrlError) {
        console.error('❌ Signed URL fallback failed:', signedUrlError);
        throw new Error(`Failed to get accessible image URL: ${signedUrlError instanceof Error ? signedUrlError.message : 'Unknown error'}`);
      }
    }

    if (!accessibleImageUrl) {
      throw new Error('Failed to resolve accessible image URL for generation');
    }

    // Call Kie.ai Veo endpoint.
    // We keep this pinned to the documented URL unless GROK_API_URL explicitly points to a Veo endpoint.
    const defaultVeoUrl = 'https://api.kie.ai/api/v1/veo/generate';
    const grokApiUrl =
      typeof process.env.GROK_API_URL === 'string' && process.env.GROK_API_URL.includes('/veo/')
        ? process.env.GROK_API_URL
        : defaultVeoUrl;
    console.log('🎯 Using API URL:', grokApiUrl);

    console.log('✅ API key configured, proceeding with generation...');
    console.log('🔗 API URL:', grokApiUrl);

    // Build callback URL so Kie can POST back when done (prevents relying on slow polling)
    const originHeader = request.headers.get('origin');
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = originHeader || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3010');
    const callbackUrl =
      `${baseUrl}/api/callback` +
      `?userId=${encodeURIComponent(userId)}` +
      `&templateId=${encodeURIComponent(templateId)}` +
      `&templateName=${encodeURIComponent(template.name)}` +
      `&thumbnail=${encodeURIComponent(imageUrl)}`;
    console.log(`[Generate] Image-to-video callbackUrl: ${callbackUrl}`);

    // Check if test mode is enabled
    const isTestMode = process.env.KIE_TEST_MODE === 'true';
    if (isTestMode) {
      console.log('🧪 TEST MODE: Simulating video generation...');

      // Simulate async generation with a fake taskId
      const fakeTaskId = `test-${Date.now()}`;
      console.log('✅ Test mode: Video generation started with taskId:', fakeTaskId);

      return NextResponse.json({
        success: true,
        taskId: fakeTaskId,
        message: 'Video generation started (TEST MODE)',
      });
    }

    console.log('✅ API key configured, proceeding with generation...');

    let taskId: string | undefined;
    let lastKiePayload: any = null;

    // Prefer minimal "known-good" body shape (closest to what you confirmed worked before).
    // Kie sometimes returns generic 422 messages for any validation issue, so keep payload strict.
    const baseVeoBody: any = {
      prompt,
      imageUrls: [accessibleImageUrl],
      model: 'veo3_fast',
      generationType: 'REFERENCE_2_VIDEO',
      enableFallback: false,
      enableTranslation: true,
      callBackUrl: callbackUrl,
    };

    // Start with 16:9 first (matches the previously-working payload you shared),
    // then try portrait variants.
    let requestBody: any = { ...baseVeoBody, aspectRatio: '16:9' };

      console.log('🔄 Trying generation request...');

    let response;
    let data;

    try {
      console.log('🚀 Sending sync request to Kie.ai...');
      console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));

      response = await fetch(grokApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

      data = await response.json();
      lastKiePayload = data;
      console.log('📊 Sync response:', JSON.stringify(data, null, 2));

      // Kie.ai sometimes returns { code, msg, data } even when HTTP status is 200.
      // Treat non-200 "code" as an error and allow the async/fallback path to surface details.
      if (typeof data?.code === 'number' && data.code !== 200) {
        const kieMsg = data.msg || data.message || 'Unknown error';
        throw new Error(`Kie.ai code ${data.code}: ${kieMsg}. Full: ${JSON.stringify(data)}`);
      }

      // Check if we got a direct video URL (immediate success)
      const videoUrl = data.videoUrl || data.url || data.result?.videoUrl || data.output?.url || data.data?.videoUrl;
      if (response.ok && videoUrl) {
        console.log('✅ Synchronous generation succeeded:', videoUrl);

        // Save directly to database
        await saveVideoToDatabase({
          videoUrl,
          userId,
          templateId: template.id,
          templateName: template.name,
          thumbnail: imageUrl,
          prompt
        });

        return NextResponse.json({
          success: true,
          taskId: 'sync',
          videoUrl,
          message: 'Video generated successfully',
        });
      }

      // Check for taskId in various formats
      const possibleTaskIds = [
        data.taskId,
        data.id,
        data.task_id,
        data.data?.taskId,
        data.data?.id,
        data.jobId,
        data.job_id,
        data.requestId,
        data.request_id
      ];

      const foundTaskId = possibleTaskIds.find(id => id);
      if (foundTaskId) {
        console.log('✅ Got taskId from sync request (API is async):', foundTaskId);
        // Return the taskId immediately - the API is treating this as async
        return NextResponse.json({
          taskId: foundTaskId,
          status: 'processing',
          message: 'Video generation started. Please wait for completion.'
        });
      } else if (response.ok) {
        // If response is OK but no video or taskId, Kie.ai might not support this mode
        console.log('⚠️ Kie.ai responded OK but no video or taskId found');
        throw new Error(`Kie.ai responded OK but returned neither video nor taskId. Response: ${JSON.stringify(data)}`);
      } else {
        // API returned an error
        console.log('❌ Kie.ai sync request failed with error');
        throw new Error(`Kie.ai sync error: ${response.status} - ${JSON.stringify(data)}`);
      }

    } catch (syncError) {
      console.log('⚠️ Synchronous request failed, trying async mode:', syncError instanceof Error ? syncError.message : String(syncError));

      // Fall back to async request - try different parameter formats
      const asyncRequestBodies = [
        // 1) Previously-working shape: 16:9 + veo3_fast + REFERENCE_2_VIDEO
        { url: grokApiUrl, body: { ...baseVeoBody, aspectRatio: '16:9' } },
        // 2) Portrait
        { url: grokApiUrl, body: { ...baseVeoBody, aspectRatio: '9:16' } },
        // 3) Omit aspectRatio (let Kie decide)
        { url: grokApiUrl, body: { ...baseVeoBody } },
        // 4) Enable fallback (some accounts require this)
        { url: grokApiUrl, body: { ...baseVeoBody, aspectRatio: '16:9', enableFallback: true } },
      ];

      let asyncSuccess = false;
      let lastError = null;

      for (let i = 0; i < asyncRequestBodies.length; i++) {
        try {
          const reqConfig = asyncRequestBodies[i];
          console.log(`🔄 Trying async request format ${i + 1}/${asyncRequestBodies.length}`);
          console.log('🔗 URL:', reqConfig.url);
          console.log('📝 Request body:', JSON.stringify(reqConfig.body, null, 2));

          response = await fetch(reqConfig.url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqConfig.body),
          });

          console.log('📊 Response status:', response.status);
          console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

          data = await response.json();
          lastKiePayload = data;
          console.log(`📊 Async response ${i + 1}:`, JSON.stringify(data, null, 2));

          // Kie.ai sometimes returns { code, msg, data } even when HTTP status is 200.
          // Treat non-200 "code" as a failed attempt and surface common validation errors.
          if (typeof data?.code === 'number' && data.code !== 200) {
            const kieMsg = data.msg || data.message || 'Unknown error';
            console.log(`⚠️ Async request ${i + 1} returned Kie.ai code ${data.code}:`, kieMsg);
            lastError = `Kie.ai code ${data.code}: ${kieMsg}. Full: ${JSON.stringify(data)}`;
            continue;
          }

          if (!response.ok) {
            console.log(`❌ Async request ${i + 1} failed with status ${response.status}`);
            lastError = `Kie.ai API error: ${response.status} - ${JSON.stringify(data)}`;
            continue;
          }

          // Check for taskId in various formats
          const possibleTaskIds = [
            data.taskId,
            data.id,
            data.task_id,
            data.data?.taskId,
            data.data?.id,
            data.jobId,
            data.job_id,
            data.requestId,
            data.request_id,
            data.generation_id,
            data.uuid
          ];

          taskId = possibleTaskIds.find(id => id);
          console.log('🎯 Extracted taskId:', taskId);

          if (taskId) {
            console.log(`✅ Async request ${i + 1} succeeded with taskId:`, taskId);
            asyncSuccess = true;
            // Return success immediately with the taskId
            return NextResponse.json({
              taskId,
              status: 'processing',
              message: 'Video generation started. Please wait for completion.'
            });
          } else {
            console.log(`⚠️ Async request ${i + 1} OK but no taskId found`);
            lastError = `No taskId in response: ${JSON.stringify(data)}`;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`❌ Async request ${i + 1} threw error:`, errorMessage);
          lastError = errorMessage;
        }
      }

      if (!asyncSuccess) {
        console.error('❌ All async attempts failed');
        console.error('📝 Last error:', lastError);
        // If we reach here, all retries failed. Surface common Kie validation errors clearly.
        const last = String(lastError || '');
        if (last.includes('Images size exceeds limit')) {
          return NextResponse.json(
            {
              error:
                'Kie.ai rejected the reference image (Images size exceeds limit). This is often caused by validation (aspect ratio/resolution) or fetch/access issues, not just bytes. Re-upload and try again (we now auto-crop to 9:16 and upload the reference to Kie).',
              details: lastError,
              kie: lastKiePayload,
            },
            { status: 422 }
          );
        }
        // Otherwise throw error to be caught by outer catch
        throw new Error(`Failed to get taskId from Kie.ai after trying all formats. Last error: ${lastError}`);
      }
    }

    // Note: The code below this point is unreachable if async success happened, 
    // because we returned early. It only runs if synchronous request succeeded (handled above)
    // or if we decide to remove the early return in the future.
    
    // For safety, if we somehow reach here without returning, treat it as an error or fallback
    throw new Error('Unexpected execution flow: generation should have been handled by sync or async blocks');

    /* 
    // Legacy code below - unreachable but kept for reference until confirmed fix
    console.log('═══════════════════════════════════════════════');
    console.log('🎬 Calling Kie.ai API:', grokApiUrl);
    ...
    */
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

