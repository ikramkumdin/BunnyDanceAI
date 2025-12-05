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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, templateId, intensity = 'mild', userId } = body;

    console.log('🚀 API called with templateId:', templateId);
    console.log('📊 Total templates loaded:', templates.length);
    console.log('📋 First few templates:', templates.slice(0, 3).map(t => ({ id: t.id, name: t.name })));

    if (!imageUrl || !templateId) {
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

    // Build prompt from template - CRITICAL: Must use the reference person's face and body
    // The prompt must explicitly instruct to use the person from the reference image
    console.log('📝 Raw template.prompt:', template.prompt);
    console.log('📝 Template object:', { id: template.id, name: template.name, category: template.category });
    let prompt = `IMPORTANT: Use the person from the provided reference image as the main subject.
    The video should feature this specific person with their appearance and characteristics.

    ${template.prompt.replace(/sensual|exaggerated|twerking/gi, 'energetic').replace(/intense/gi, 'lively')}

    The person in the video should match the reference image.`;
    console.log('📝 Final constructed prompt (first 200 chars):', prompt.substring(0, 200) + '...');

    // Get signed URL for the image so Kie.ai can access it
    let accessibleImageUrl = imageUrl;
    try {
      console.log('🔗 Getting signed URL for image access...');
      const signedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009'}/api/get-signed-url?path=${encodeURIComponent(imageUrl)}`);
      if (signedUrlResponse.ok) {
        const signedUrlData = await signedUrlResponse.json();
        accessibleImageUrl = signedUrlData.url;
        console.log('✅ Using signed URL for image access');
      } else {
        console.warn('⚠️ Failed to get signed URL, using original URL (may not work)');
      }
    } catch (signedUrlError) {
      console.warn('⚠️ Error getting signed URL:', signedUrlError);
      console.warn('Using original URL (may not work)');
    }

    // Adjust prompt based on intensity if needed
    if (intensity === 'extreme') {
      prompt += ' Extreme physics, maximum intensity, but keep the EXACT same person from reference image.';
    } else if (intensity === 'mild') {
      prompt += ' Subtle movements, elegant, but preserve the EXACT person identity from reference image.';
    } else {
      // Default: ensure we mention maintaining the person
      prompt += ' The person in the video MUST be identical to the person in the reference image.';
    }

    // Call Kie.ai API according to documentation
    // Try multiple possible endpoints in case the API has changed
    const possibleApiUrls = [
      process.env.GROK_API_URL,
      'https://api.kie.ai/api/v1/veo/generate',
      'https://api.kie.ai/v1/generate',
      'https://api.kie.ai/api/v1/generate',
      'https://api.kie.ai/generate'
    ].filter(Boolean);

    const grokApiUrl = possibleApiUrls[0] || 'https://api.kie.ai/api/v1/veo/generate';
    console.log('🎯 Using API URL:', grokApiUrl);
    console.log('🔄 Alternative URLs available:', possibleApiUrls.slice(1));

    if (!process.env.GROK_API_KEY) {
      console.error('❌ GROK_API_KEY is not configured in environment');
      console.log('🔍 Available env vars:', Object.keys(process.env).filter(key => key.includes('GROK') || key.includes('API')));
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured. Please add it to Vercel environment variables' },
        { status: 500 }
      );
    }

    console.log('✅ API key configured, proceeding with generation...');
    console.log('🔗 API URL:', grokApiUrl);

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

    if (!process.env.GROK_API_KEY) {
      console.error('❌ GROK_API_KEY is not configured in .env.local');
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured. Please add it to .env.local' },
        { status: 500 }
      );
    }

    console.log('✅ API key configured, proceeding with generation...');

    let taskId: string | undefined;

    // Try synchronous request first (some APIs support this)
    let requestBody: any = {
        prompt: prompt,
        imageUrls: [accessibleImageUrl],
        model: "Veo 3.1 Fast", // Updated to match Kie.ai documentation
        aspectRatio: "16:9", // Landscape format as required by API
        generationType: "REFERENCE_2_VIDEO",
        enableFallback: false,
        enableTranslation: true,
        // Try synchronous mode first
        sync: true,
        waitForCompletion: true
    };

    console.log('🔄 Trying synchronous generation request...');

    let response;
    let data;

    try {
      console.log('🚀 Sending sync request to Kie.ai...');
      console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));

      response = await fetch(grokApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📊 Response status:', response.status);
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

      data = await response.json();
      console.log('📊 Sync response:', JSON.stringify(data, null, 2));

      // Check if we got a direct video URL (synchronous success)
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
          message: 'Video generated synchronously',
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
        console.log('⚠️ Sync failed, got taskId, switching to async mode:', foundTaskId);
        taskId = foundTaskId;
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
        // Try with callback URL first (if Kie.ai supports it)
        {
          prompt: prompt,
          imageUrls: [accessibleImageUrl],
          model: "Veo 3.1 Fast", // Updated to match Kie.ai documentation
          aspectRatio: "16:9",
          generationType: "REFERENCE_2_VIDEO",
          enableFallback: false,
          enableTranslation: true,
          callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://bunny-dance-ai.vercel.app'}/api/callback?userId=${userId}&templateId=${template.id}&templateName=${encodeURIComponent(template.name)}&thumbnail=${encodeURIComponent(imageUrl)}`
        },
        // Try with minimal parameters
        {
          prompt: prompt,
          imageUrls: [accessibleImageUrl],
          model: "Veo 3.1 Fast", // Updated to match Kie.ai documentation
          aspectRatio: "16:9"
        },
        // Try with more parameters
        {
          prompt: prompt,
          imageUrls: [accessibleImageUrl],
          model: "Veo 3.1 Fast", // Updated to match Kie.ai documentation
          aspectRatio: "16:9",
          generationType: "REFERENCE_2_VIDEO",
          enableFallback: false,
          enableTranslation: true
        },
        // Try different parameter names
        {
          prompt: prompt,
          image_urls: [accessibleImageUrl],
          model: "Veo 3.1 Fast", // Updated to match Kie.ai documentation
          aspect_ratio: "16:9",
          generation_type: "REFERENCE_2_VIDEO"
        }
      ];

      let asyncSuccess = false;
      let lastError = null;

      for (let i = 0; i < asyncRequestBodies.length; i++) {
        try {
          console.log(`🔄 Trying async request format ${i + 1}/${asyncRequestBodies.length}`);
          console.log('📝 Request body:', JSON.stringify(asyncRequestBodies[i], null, 2));

          response = await fetch(grokApiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(asyncRequestBodies[i]),
          });

          console.log('📊 Response status:', response.status);
          console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));

          data = await response.json();
          console.log(`📊 Async response ${i + 1}:`, JSON.stringify(data, null, 2));

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
            break;
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
        throw new Error(`Failed to get taskId from Kie.ai after trying all formats. Last error: ${lastError}`);
      }
    }

    console.log('═══════════════════════════════════════════════');
    console.log('🎬 Calling Kie.ai API:', grokApiUrl);
    console.log('🖼️ Original Image URL:', imageUrl);
    console.log('🔗 Accessible Image URL:', accessibleImageUrl);
    console.log('🖼️ Image URLs Array:', requestBody.imageUrls);
    console.log('💬 Prompt:', requestBody.prompt);
    console.log('📋 Full Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('═══════════════════════════════════════════════');

    const grokResponse = await fetch(grokApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokResponse.ok) {
      // Read response body as text first (can only be read once)
      const errorText = await grokResponse.text();
      let errorData: any;

      // Try to parse as JSON
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // If not JSON, use as text
        errorData = errorText;
      }

      console.error('Grok API error:', errorData);

      // Handle structured error response
      if (typeof errorData === 'object' && errorData.error) {
        return NextResponse.json(
          {
            error: errorData.error.message || 'Video generation failed',
            details: errorData
          },
          { status: grokResponse.status }
        );
      }

      // Provide more helpful error message for 404
      if (grokResponse.status === 404) {
        return NextResponse.json(
          {
            error: 'Grok API endpoint not found (404). Please check your GROK_API_URL in .env.local',
            details: `The API endpoint "${grokApiUrl}" returned 404. Make sure the URL is correct.`
          },
          { status: 500 }
        );
      }

      // Handle 422 validation errors
      if (grokResponse.status === 422) {
        const errorMsg = typeof errorData === 'string' ? errorData : (errorData.error?.message || 'Validation error');
        return NextResponse.json(
          {
            error: errorMsg,
            details: errorData
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          error: 'Video generation failed',
          details: typeof errorData === 'string'
            ? (errorData.length > 500 ? errorData.substring(0, 500) + '...' : errorData)
            : errorData
        },
        { status: grokResponse.status }
      );
    }

    const grokData = await grokResponse.json();
    console.log('Kie.ai API response:', JSON.stringify(grokData, null, 2));

    // Handle Kie.ai API response format
    // Check if this is an async task response with taskId
    if (grokData.taskId || grokData.data?.taskId) {
      const taskId = grokData.taskId || grokData.data.taskId;
      console.log('✅ Async generation started with taskId:', taskId);

      // Note: Video will be saved by the callback when generation completes
      // The callback URL includes all necessary metadata

      // Return task info for polling
      return NextResponse.json({
        taskId,
        status: 'processing',
        message: 'Video generation started. Please wait for completion.'
      });
    }

    // Handle immediate video URL response (if API returns URLs directly)
    let generatedVideoUrl: string | null = null;

    // Check for direct video URLs in response
    if (Array.isArray(grokData) && grokData.length > 0) {
      generatedVideoUrl = grokData[0];
    } else if (grokData.videoUrl) {
      generatedVideoUrl = grokData.videoUrl;
    } else if (grokData.url) {
      generatedVideoUrl = grokData.url;
    } else if (grokData.video_url) {
      generatedVideoUrl = grokData.video_url;
    } else if (grokData.data && Array.isArray(grokData.data) && grokData.data.length > 0) {
      generatedVideoUrl = grokData.data[0];
    }
    
    if (!generatedVideoUrl) {
      console.error('❌ No video URL or taskId found in API response');
      return NextResponse.json(
        { error: 'No video URL or taskId returned from API', details: grokData },
        { status: 500 }
      );
    }

    // Upload video to GCP Storage
    let finalVideoUrl = generatedVideoUrl;
    try {
      finalVideoUrl = await uploadVideo(generatedVideoUrl, userId);
    } catch (uploadError) {
      console.error('Error uploading video to GCP:', uploadError);
      // Continue with original URL if upload fails
    }

    // Save video metadata to Firestore
    const videoId = generateVideoId();
    const isWatermarked = false; // TODO: Add watermarking logic

    await saveVideo({
      videoUrl: finalVideoUrl,
      thumbnail: imageUrl,
      templateId: template.id,
      templateName: template.name,
      createdAt: new Date().toISOString(),
      isWatermarked,
      userId
    });

    // Return video URL
    return NextResponse.json({
      videoId,
      videoUrl: finalVideoUrl,
      status: 'completed',
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

