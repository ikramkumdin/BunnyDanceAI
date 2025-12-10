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

    console.log('🎨 Text-to-image generation started');
    console.log('📝 Prompt:', prompt);
    console.log('👤 User ID:', userId);

    const kieApiKey = process.env.GROK_API_KEY;
    
    if (!kieApiKey) {
      return NextResponse.json(
        { error: 'GROK_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('✅ Using Kie.ai API for image generation...');

    // Get the base URL for callback (works on both localhost and Vercel)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    (request.headers.get('host')?.includes('localhost') 
                      ? 'http://localhost:3000' 
                      : `https://${request.headers.get('host')}`);
    
    const callbackUrl = `${baseUrl}/api/image-callback`;
    console.log('📞 Callback URL:', callbackUrl);

    const requestBody = {
      prompt: prompt,
      size: "2:3", // Portrait aspect ratio
      nVariants: 1,
      enableFallback: true,
      fallbackModel: "FLUX_MAX",
      isEnhance: false,
      uploadCn: false,
      callBackUrl: callbackUrl, // Kie.ai will POST result here when done!
    };

    console.log('🚀 Sending request to Kie.ai with callback...');

    const response = await fetch('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('📊 Kie.ai response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      const taskId = data.taskId || data.data?.taskId || data.id;
      if (taskId) {
        console.log('✅ Got taskId from Kie.ai:', taskId);
        console.log('⏰ Kie.ai will callback when ready (no polling needed!)');
        return NextResponse.json({
          success: true,
          taskId: taskId,
          provider: 'kie',
          useCallback: true, // Tell frontend we're using callbacks
          message: 'Image generation started with callback'
        });
      }
    }

    return NextResponse.json(
      { error: 'Image generation failed', details: data },
      { status: response.status || 500 }
    );

  } catch (error) {
    console.error('❌ Text-to-image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

