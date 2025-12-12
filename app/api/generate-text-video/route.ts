import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, userId } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎬 Text-to-video generation started');
    console.log('📝 Prompt:', prompt);
    console.log('👤 User ID:', userId);

    const grokApiUrl = 'https://api.kie.ai/api/v1/veo/generate';
    const apiKey = process.env.GROK_API_KEY;

    if (!apiKey) {
      console.error('❌ GROK_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    console.log('✅ API key configured, proceeding with generation...');

    // Callback URL (no userId query params on purpose; direct callbacks are cached for polling)
    const originHeader = request.headers.get('origin');
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = originHeader || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3010');
    const callBackUrl = `${baseUrl}/api/callback`;
    console.log(`[Generate] Text-to-video callbackUrl: ${callBackUrl}`);

    // Try synchronous request first
    const requestBody = {
      prompt: prompt,
      model: "veo3_fast",
      aspectRatio: "9:16", // Vertical video for mobile
      generationType: "TEXT_2_VIDEO",
      enableFallback: true,
      enableTranslation: true,
      callBackUrl,
      // Prefer async to avoid serverless timeouts; frontend will poll.
      sync: false,
      waitForCompletion: false
    };

    console.log('🚀 Sending text-to-video request to Kie.ai...');
    console.log('📝 Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(grokApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📊 Response status:', response.status);
    
    const data = await response.json();
    console.log('📊 Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      // Check if we got a direct video URL (synchronous success)
      const videoUrl = data.videoUrl || data.url || data.result?.videoUrl || data.output?.url || data.data?.videoUrl;
      if (videoUrl) {
        console.log('✅ Synchronous generation succeeded:', videoUrl);
        return NextResponse.json({
          success: true,
          videoUrl: videoUrl,
          message: 'Video generated successfully'
        });
      }

      // Check if we got a taskId (async generation)
      const taskId = data.taskId || data.data?.taskId || data.id;
      if (taskId) {
        console.log('✅ Got taskId from request:', taskId);
        return NextResponse.json({
          success: true,
          taskId: taskId,
          message: 'Video generation started'
        });
      }

      // If we got here, response was OK but no video URL or taskId
      console.error('❌ Response OK but no video URL or taskId:', data);
      return NextResponse.json(
        { error: 'Unexpected response format from Kie.ai', details: data },
        { status: 500 }
      );
    }

    // Handle error responses
    const errorMsg = data.msg || data.message || data.error || 'Unknown error';
    console.error('❌ Kie.ai API error:', errorMsg);
    console.error('📊 Full error response:', data);

    return NextResponse.json(
      { 
        error: `Video generation failed: ${errorMsg}`,
        details: data
      },
      { status: response.status }
    );

  } catch (error) {
    console.error('❌ Text-to-video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


