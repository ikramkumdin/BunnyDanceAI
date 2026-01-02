import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/data/templates';
import { IntensityLevel } from '@/types';
import { uploadVideo, uploadImage } from '@/lib/storage';
import { getSignedUrl } from '@/lib/gcp-storage';
import crypto from 'crypto';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';
import { adminDb } from '@/lib/firebase-admin';
import { getTemplatePrompt } from '@/data/template-prompts';

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

    // Use built-in FormData (Node.js 18+) - append buffer directly
    const formData = new FormData();
    // Convert Buffer to Uint8Array for Blob compatibility
    const fileBlob = new Blob([new Uint8Array(imageBuffer)], { type: contentType });
    formData.append('file', fileBlob, 'image.jpg');

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

    // Build prompt from selected template (fallback to template-prompts DB, then safe generic)
    console.log('📝 Raw template.prompt:', template.prompt);
    console.log('📝 Template object:', { id: template.id, name: template.name, category: template.category, intensity: template.intensity });

    const promptFromTemplateDb = getTemplatePrompt(template.id)?.prompt;
    const baseTemplatePrompt =
      (typeof template.prompt === 'string' && template.prompt.trim() ? template.prompt.trim() : '') ||
      (typeof promptFromTemplateDb === 'string' && promptFromTemplateDb.trim() ? promptFromTemplateDb.trim() : '');
    const promptSource: 'template.prompt' | 'template-prompts.ts' | 'safe-fallback' =
      typeof template.prompt === 'string' && template.prompt.trim()
        ? 'template.prompt'
        : typeof promptFromTemplateDb === 'string' && promptFromTemplateDb.trim()
          ? 'template-prompts.ts'
          : 'safe-fallback';

    const identityWrapper =
      `IMPORTANT: Use the person from the provided reference image as the main subject.\n` +
      `The video should feature this specific person with their appearance and characteristics.\n` +
      `The person in the video should match the reference image. The person in the video MUST be identical to the person in the reference image.\n\n`;

    const safeFallbackPrompt =
      `Animate the person in the reference image performing a short, family-friendly dance loop in a well-lit setting, smooth motion, professional video quality.`;

    // Prefer the selected template prompt; only fall back to the safe prompt if template is missing.
    let prompt = identityWrapper + (baseTemplatePrompt || safeFallbackPrompt);
    console.log('📝 Final constructed prompt (template-driven):', prompt);
    console.log('📝 Prompt components:');
    console.log('   - identityWrapper length:', identityWrapper.length);
    console.log('   - baseTemplatePrompt length:', baseTemplatePrompt?.length || 0);
    console.log('   - safeFallbackPrompt length:', safeFallbackPrompt.length);
    console.log('   - Final prompt length:', prompt.length);

    // Critical: Ensure we have a non-empty prompt
    if (!prompt || prompt.trim().length === 0) {
      console.error('❌ CRITICAL: Prompt is empty or undefined!');
      console.error('   - baseTemplatePrompt:', baseTemplatePrompt);
      console.error('   - template.prompt:', template.prompt);
      console.error('   - promptFromTemplateDb:', promptFromTemplateDb);

      // Emergency fallback - create a basic prompt
      prompt = identityWrapper + "A beautiful woman performs a sensual dance in a luxurious setting with smooth, graceful movements.";
      console.log('🚨 Using emergency fallback prompt:', prompt);
    }

    // Base URL (for proxying image bytes to Kie in a simple URL)
    const originHeader = request.headers.get('origin');
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = originHeader || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3010');

    function publicImageProxyUrl(gcsUrl: string): string {
      const u = new URL(gcsUrl);
      const parts = u.pathname.split('/').filter((p) => p);
      const bucket = parts[0] || '';
      const path = parts.slice(1).join('/');
      const secret = process.env.PUBLIC_IMAGE_PROXY_SECRET || process.env.NEXTAUTH_SECRET || '';
      if (!secret) throw new Error('Missing PUBLIC_IMAGE_PROXY_SECRET (or NEXTAUTH_SECRET) for /api/public-image');
      const sig = crypto.createHmac('sha256', secret).update(`${bucket}\n${path}`).digest('hex');
      return `${baseUrl}/api/public-image?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}&sig=${encodeURIComponent(sig)}`;
    }

    // For the new Kie.ai jobs/createTask API, we need publicly accessible image URLs
    // GCS bucket might be private, so we need signed URLs or use the public-image proxy
    let accessibleImageUrl: string | undefined;
    let thumbnailUrlForCallback: string | undefined = typeof imageUrl === 'string' ? imageUrl : undefined;

    try {
      let gcsUrl: string;

      if (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/')) {
        console.log('📤 Received base64 imageDataUrl; uploading to GCS...');
        gcsUrl = await uploadImage(imageDataUrl, userId, 'images');
        thumbnailUrlForCallback = gcsUrl;
      } else {
        if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
          throw new Error('Expected imageUrl to be an http(s) URL when no base64 imageDataUrl is provided');
        }

        // Check if it's already a GCS URL or a persistent URL we trust
        // If it's from tempfile.aiquickdraw.com or other external sources, we should re-upload it
        const isGcs = imageUrl.includes('storage.googleapis.com') || imageUrl.includes('bunnydanceai-storage');
        const isExternal = !isGcs;

        if (isExternal) {
          console.log('🌍 External URL detected (e.g. tempfile/generated), downloading and re-uploading to GCS for persistence:', imageUrl);
          try {
            // Fetch the external image
            const imageResp = await fetch(imageUrl);
            if (!imageResp.ok) throw new Error(`Failed to fetch external image: ${imageResp.status}`);

            const arrayBuffer = await imageResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = imageResp.headers.get('content-type') || 'image/jpeg';
            const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

            // Upload to GCS
            gcsUrl = await uploadImage(base64, userId, 'images');
            console.log('✅ Re-uploaded external image to GCS:', gcsUrl);
            thumbnailUrlForCallback = gcsUrl;
          } catch (reuploadError) {
            console.error('⚠️ Failed to re-upload external image, falling back to original URL:', reuploadError);
            gcsUrl = imageUrl;
            // Proceed with original URL, though it might fail if Kie can't access it
          }
        } else {
          gcsUrl = imageUrl;
          thumbnailUrlForCallback = imageUrl;
        }
      }

      // For grok-imagine/image-to-video, use direct GCS URLs since bucket is public
      // Direct URLs are simpler and more reliable for Kie.ai's image fetcher
      // The bucket is configured with allUsers:objectViewer, so direct URLs work
      accessibleImageUrl = gcsUrl;
      console.log('✅ Using direct GCS URL (bucket is public):', gcsUrl);

      // Verify the URL is accessible from the internet (Kie.ai needs to fetch it)
      // Also test from multiple user agents to simulate Kie.ai's fetch
      try {
        console.log('🧪 Testing direct URL accessibility (simulating Kie.ai fetch)...');

        // Test with different user agents (Kie.ai might use different ones)
        const userAgents = [
          'Mozilla/5.0 (compatible; Kie.ai/1.0)',
          'curl/7.68.0',
          'Python-requests/2.28.1'
        ];

        let accessible = false;
        for (const ua of userAgents) {
          try {
            const testResponse = await fetch(gcsUrl, {
              method: 'GET',
              signal: AbortSignal.timeout(10000),
              headers: {
                'User-Agent': ua,
                'Accept': 'image/*'
              }
            });

            if (testResponse.ok) {
              const contentType = testResponse.headers.get('content-type');
              const contentLength = testResponse.headers.get('content-length');
              console.log(`✅ Direct URL is accessible with ${ua} (${contentType}, ${contentLength} bytes)`);

              // Verify it's actually an image
              if (!contentType || !contentType.startsWith('image/')) {
                console.warn(`⚠️ URL returned non-image content type: ${contentType}`);
              } else {
                accessible = true;
                break; // One successful test is enough
              }
            } else {
              console.warn(`⚠️ Test with ${ua} returned ${testResponse.status}`);
            }
          } catch (uaError) {
            console.warn(`⚠️ Test with ${ua} failed:`, uaError instanceof Error ? uaError.message : 'Unknown');
          }
        }

        if (!accessible) {
          console.error('❌ All URL accessibility tests failed!');
          console.error('Kie.ai will likely NOT be able to fetch this image!');
          console.error('💡 Try: Make sure the GCS bucket is public and CORS is configured');
        }
      } catch (testError) {
        console.error('❌ Direct URL test failed:', testError instanceof Error ? testError.message : 'Unknown error');
        console.error('Kie.ai will likely fail to fetch this image!');
        // Still proceed - maybe it's a network issue on our side but Kie.ai can access it
      }
    } catch (error) {
      console.error('❌ Error processing image:', error);
      throw error;
    }

    if (!accessibleImageUrl) {
      throw new Error('Failed to resolve accessible image URL for generation');
    }
    if (!String(accessibleImageUrl).startsWith('http')) {
      throw new Error(`Resolved accessibleImageUrl is not an http(s) URL: ${String(accessibleImageUrl)}`);
    }

    // Call Kie.ai image-to-video endpoint using the new jobs/createTask API
    // Fixed: Always use createTask for grok-imagine model to avoid "Invalid model" errors
    // that happen if GROK_API_URL is set to a VEO-specific endpoint in Vercel.
    const grokApiUrl = 'https://api.kie.ai/api/v1/jobs/createTask';
    console.log('🎯 Using API URL (Hardcoded for stability):', grokApiUrl);

    console.log('✅ API key configured, proceeding with generation...');
    console.log('🔗 API URL:', grokApiUrl);

    // Build callback URL so Kie can POST back when done (prevents relying on slow polling)
    // Only set callback URL if we're in production (Vercel), not localhost
    // (baseUrl was computed earlier for the public-image proxy)
    const isProduction = baseUrl.startsWith('https://') && !baseUrl.includes('localhost');
    const callbackUrl = isProduction
      ? `${baseUrl}/api/callback` +
      `?userId=${encodeURIComponent(userId)}` +
      `&templateId=${encodeURIComponent(templateId)}` +
      `&templateName=${encodeURIComponent(template.name)}` +
      `&thumbnail=${encodeURIComponent(thumbnailUrlForCallback || accessibleImageUrl || '')}`
      : undefined; // No callback in local dev, rely on polling

    if (callbackUrl) {
      console.log(`[Generate] Image-to-video callbackUrl: ${callbackUrl}`);
    } else {
      console.log(`[Generate] Skipping callback URL (local dev), will use polling`);
    }

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
    let lastVeoRequestBody: any = null;

    // Use the new Kie.ai jobs/createTask API format
    // Note: According to Kie.ai docs, image_urls should be an array with ONE URL
    // and the prompt should be under 5000 characters
    const trimmedPrompt = prompt.length > 5000 ? prompt.substring(0, 4997) + '...' : prompt;
    if (prompt.length > 5000) {
      console.warn(`⚠️ Prompt is ${prompt.length} characters, trimming to 5000`);
    }

    // Map template intensity to Kie.ai generation mode
    // mild → normal, spicy → spicy, extreme → spicy
    const intensityToMode: { [key: string]: string } = {
      'mild': 'normal',
      'spicy': 'spicy',
      'extreme': 'spicy'
    };
    const generationMode = intensityToMode[template.intensity] || 'normal';
    console.log(`🎨 Using generation mode: ${generationMode} (from template intensity: ${template.intensity})`);

    // CRITICAL: Ensure prompt is never empty - use fallback if needed
    const finalPrompt = trimmedPrompt && trimmedPrompt.trim().length > 0
      ? trimmedPrompt.trim()
      : baseTemplatePrompt || safeFallbackPrompt || 'A beautiful woman performs a graceful dance in a luxurious setting.';

    console.log('🔍 Pre-request validation:');
    console.log('   - trimmedPrompt length:', trimmedPrompt?.length || 0);
    console.log('   - finalPrompt length:', finalPrompt?.length || 0);
    console.log('   - finalPrompt preview:', finalPrompt.substring(0, 100) + '...');

    if (!finalPrompt || finalPrompt.trim().length === 0) {
      console.error('❌ CRITICAL: All prompt sources are empty!');
      throw new Error('Cannot generate video: No prompt available from template or fallback');
    }

    const baseRequestBody: any = {
      model: 'grok-imagine/image-to-video',
      ...(callbackUrl && { callBackUrl: callbackUrl }), // Only include if set
      input: {
        image_urls: [accessibleImageUrl], // Array with single URL
        index: 0,
        prompt: finalPrompt, // Use guaranteed non-empty prompt
        mode: generationMode,
      },
    };

    // Final validation after constructing request body
    if (!baseRequestBody.input.prompt || baseRequestBody.input.prompt.trim().length === 0) {
      console.error('❌ CRITICAL: Request body has empty prompt after construction!');
      console.error('   - baseRequestBody.input:', JSON.stringify(baseRequestBody.input, null, 2));
      throw new Error('Request body contains empty prompt field');
    }

    console.log('✅ Request body validated - prompt length:', baseRequestBody.input.prompt.length);

    console.log('📋 Request summary:', {
      model: baseRequestBody.model,
      imageUrl: accessibleImageUrl.substring(0, 80) + '...',
      promptLength: trimmedPrompt.length,
      hasCallback: !!callbackUrl
    });

    let requestBody: any = { ...baseRequestBody };

    console.log('🔄 Trying generation request...');

    let response;
    let data;

    try {
      console.log('🚀 Sending sync request to Kie.ai...');
      console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));
      console.log('🔍 Request body validation:');
      console.log('   - Has input:', !!requestBody.input);
      console.log('   - Input type:', typeof requestBody.input);
      console.log('   - Has prompt in input:', !!requestBody.input?.prompt);
      console.log('   - Prompt value:', requestBody.input?.prompt ? requestBody.input.prompt.substring(0, 100) + '...' : 'MISSING');
      console.log('   - Prompt length:', requestBody.input?.prompt?.length || 0);
      lastVeoRequestBody = requestBody;

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

      // Verify we got a taskId
      if (!data?.data?.taskId) {
        console.error('❌ No taskId in response!', JSON.stringify(data, null, 2));
        throw new Error('Kie.ai did not return a taskId. Response: ' + JSON.stringify(data));
      }

      console.log('✅ Task created successfully with taskId:', data.data.taskId);
      console.log('💡 Check this task in Kie.ai logs: https://kie.ai/logs (search for taskId)');

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
          debug: { templateId: template.id, templateName: template.name, promptSource },
        });
      }

      // Check for taskId in various formats (new API may return it differently)
      const possibleTaskIds = [
        data.taskId,
        data.id,
        data.task_id,
        data.jobId,
        data.job_id,
        data.data?.taskId,
        data.data?.id,
        data.data?.jobId,
        data.result?.taskId,
        data.result?.id,
        data.requestId,
        data.request_id,
        data.uuid
      ];

      const foundTaskId = possibleTaskIds.find(id => id);
      if (foundTaskId) {
        console.log('✅ Got taskId from sync request (API is async):', foundTaskId);
        // Return the taskId immediately - the API is treating this as async
        return NextResponse.json({
          taskId: foundTaskId,
          status: 'processing',
          message: 'Video generation started. Please wait for completion.',
          debug: { templateId: template.id, templateName: template.name, promptSource },
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
      const cleanPrompt = finalPrompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
      const simplePrompt = baseTemplatePrompt || safeFallbackPrompt;
      const cleanSimplePrompt = simplePrompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

      // Ensure all prompts are non-empty for fallbacks
      const guaranteedCleanPrompt = cleanPrompt || 'A beautiful woman performs a sensual dance in a luxurious setting.';
      const guaranteedCleanSimplePrompt = cleanSimplePrompt || 'A beautiful woman performs a sensual dance in a luxurious setting.';

      console.log('🔄 Fallback prompts prepared:');
      console.log('   - guaranteedCleanPrompt length:', guaranteedCleanPrompt.length);
      console.log('   - guaranteedCleanSimplePrompt length:', guaranteedCleanSimplePrompt.length);

      const asyncRequestBodies = [
        // 1) PURE ACTION Pattern (No identity wrapper, no newlines)
        // This exactly matches the successful diagnostic pattern.
        {
          url: grokApiUrl,
          body: {
            model: 'grok-imagine/image-to-video',
            input: {
              image_urls: [accessibleImageUrl],
              prompt: guaranteedCleanSimplePrompt,
              index: 0
            }
          }
        },

        // 2) Original pattern but Sanitized (Cleaned of newlines)
        {
          url: grokApiUrl,
          body: {
            model: 'grok-imagine/image-to-video',
            input: {
              image_urls: [accessibleImageUrl],
              prompt: guaranteedCleanPrompt, // Full prompt (with wrapper) but cleaned
              index: 0
            }
          }
        },

        // 3) Standard with callback and mode
        {
          url: grokApiUrl,
          body: {
            model: 'grok-imagine/image-to-video',
            callBackUrl: callbackUrl,
            input: {
              image_urls: [accessibleImageUrl],
              prompt: guaranteedCleanSimplePrompt,
              index: 0,
              mode: generationMode === 'spicy' ? 'spicy' : 'normal'
            }
          }
        },

        // 4) Stringified Input (Alternative format)
        {
          url: grokApiUrl,
          body: {
            model: 'grok-imagine/image-to-video',
            input: JSON.stringify({
              image_urls: [accessibleImageUrl],
              prompt: guaranteedCleanSimplePrompt,
              index: 0
            })
          }
        },

        // 5) FLAT Structure (Top-level fields)
        {
          url: grokApiUrl,
          body: {
            model: 'grok-imagine/image-to-video',
            prompt: guaranteedCleanSimplePrompt,
            image_urls: [accessibleImageUrl],
            index: 0
          }
        }
      ];

      // Add a potential direct model endpoint fallback if createTask fails
      let asyncSuccess = false;
      let lastError = null;

      for (let i = 0; i < asyncRequestBodies.length; i++) {
        try {
          const reqConfig = asyncRequestBodies[i];
          console.log(`\n🔄 [FALLBACK ${i + 1}/${asyncRequestBodies.length}]`);
          console.log(`🔗 URL: ${reqConfig.url}`);
          // REDACTED LOGGING: only log keys and value summaries to avoid log truncation
          const bodyPeek = { ...reqConfig.body } as any;
          if (typeof bodyPeek.input === 'string') bodyPeek.input = bodyPeek.input.substring(0, 50) + '...';
          console.log('📝 Body Keys:', Object.keys(reqConfig.body));

          let promptToLog = '';
          if (reqConfig.body.input && typeof reqConfig.body.input === 'object') {
            promptToLog = (reqConfig.body.input as any).prompt || '';
          } else if (reqConfig.body.prompt) {
            promptToLog = reqConfig.body.prompt as string;
          }
          console.log('📝 Prompt Preview:', promptToLog.substring(0, 50) + '...');

          lastVeoRequestBody = reqConfig.body;

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

          // Check for taskId in various formats (new API may return it differently)
          const possibleTaskIds = [
            data.taskId,
            data.id,
            data.task_id,
            data.jobId,
            data.job_id,
            data.data?.taskId,
            data.data?.id,
            data.data?.jobId,
            data.result?.taskId,
            data.result?.id,
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
              message: 'Video generation started. Please wait for completion.',
              debug: { templateId: template.id, templateName: template.name, promptSource },
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
        if (last.toLowerCase().includes('content policy') || last.toLowerCase().includes('rejected by google')) {
          return NextResponse.json(
            {
              error:
                "Rejected by Google's content policy. Try a different image/prompt, or use a less sensitive template. (Fallback is already enabled on our side.)",
              details: lastError,
              kie: lastKiePayload,
              debug: {
                accessibleImageUrl,
                veoRequestBody: lastVeoRequestBody,
              },
            },
            { status: 400 }
          );
        }
        if (last.includes('Images size exceeds limit')) {
          return NextResponse.json(
            {
              error:
                'Kie.ai rejected the reference image (Images size exceeds limit). This is often caused by validation (aspect ratio/resolution) or fetch/access issues, not just bytes. Re-upload and try again (we now auto-crop to 9:16 and upload the reference to Kie).',
              details: lastError,
              kie: lastKiePayload,
              debug: {
                accessibleImageUrl,
                veoRequestBody: lastVeoRequestBody,
              },
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
    */
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

