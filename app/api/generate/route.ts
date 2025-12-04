import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/data/templates';
import { IntensityLevel } from '@/types';
import { uploadVideo, uploadImage } from '@/lib/storage';
import { saveVideo } from '@/lib/firestore';
import { generateVideoId } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const grokApiUrl = process.env.GROK_API_URL || 'https://api.kie.ai/api/v1/veo/generate';

    if (!process.env.GROK_API_KEY) {
      console.error('❌ GROK_API_KEY is not configured in .env.local');
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured. Please add it to .env.local' },
        { status: 500 }
      );
    }

    console.log('✅ API key configured, proceeding with generation...');

    // Prepare request body according to Kie.ai API documentation
    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009'}/api/callback?userId=${encodeURIComponent(userId)}&templateId=${encodeURIComponent(template.id)}&templateName=${encodeURIComponent(template.name)}&thumbnail=${encodeURIComponent(imageUrl)}`;

    const requestBody = {
      prompt: prompt,
      imageUrls: [accessibleImageUrl],
      model: "veo3_fast",
      aspectRatio: "16:9", // Landscape format as required by API
      generationType: "REFERENCE_2_VIDEO",
      enableFallback: false,
      enableTranslation: true,
      callBackUrl: callbackUrl
    };

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
      userId,
      status: 'completed'
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

