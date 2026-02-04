import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { getUserAdmin } from '@/lib/firestore-admin';
import { hasCredits, deductCredit } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to generate images' },
        { status: 401 }
      );
    }

    const { prompt, userId } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Verify userId matches authenticated user
    if (userId && userId !== authUid) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID mismatch' },
        { status: 403 }
      );
    }

    // Verify user exists and has email (signed in user)
    const user = await getUserAdmin(authUid);
    if (!user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in with email or Google to generate images' },
        { status: 401 }
      );
    }

    // Check if user has image credits (paid tiers have credits)
    if (user.tier === 'free') {
      const hasImageCredits = await hasCredits(authUid, 'image');
      if (!hasImageCredits) {
        return NextResponse.json(
          { error: 'No image credits remaining. Please upgrade to continue generating images.', needsUpgrade: true },
          { status: 403 }
        );
      }
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

    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/image-callback`;

    if (!vercelUrl) {
      console.warn('⚠️  NEXT_PUBLIC_VERCEL_URL or NEXT_PUBLIC_SITE_URL is not set. Using http://localhost:3000 for callbackUrl.');
    }

    console.log(`[Generate] Sending callbackUrl to Kie.ai: ${callbackUrl}`);

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
        
        // Deduct credit for free users
        if (user.tier === 'free') {
          await deductCredit(authUid, 'image');
          console.log('💳 Deducted 1 image credit from user');
        }
        
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

