import { NextRequest, NextResponse } from 'next/server';
// Deployment Trigger: Consolidating Grok Text-to-Video logic for production stability.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { prompt, userId } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🎬 Text-to-video generation started (Grok Imagine)');
    console.log('📝 Prompt:', prompt);
    console.log('👤 User ID:', userId);

    // Use the reliable createTask endpoint
    const grokApiUrl = 'https://api.kie.ai/api/v1/jobs/createTask';
    const apiKey = process.env.GROK_API_KEY;

    if (!apiKey) {
      console.error('❌ GROK_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured. Please add GROK_API_KEY to Vercel environment variables' },
        { status: 500 }
      );
    }

    // Build callback URL
    const originHeader = request.headers.get('origin');
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = originHeader || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3010');
    const callbackUrl = baseUrl.includes('localhost') ? undefined : `${baseUrl}/api/callback`;

    if (callbackUrl) {
      console.log(`[Generate] Text-to-video callbackUrl: ${callbackUrl}`);
    }

    // Sanitize prompt (remove newlines and excessive whitespace)
    const sanitizedPrompt = prompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const shortPrompt = sanitizedPrompt.substring(0, 1000); // Grok text prompts are usually shorter

    // Prepare multiple request formats for maximum reliability
    const asyncRequestBodies = [
      // 1) PURE Pattern (Matches diagnostic success)
      {
        url: grokApiUrl,
        body: {
          model: 'grok-imagine/text-to-video',
          input: {
            prompt: sanitizedPrompt,
            index: 0
          },
          ...(callbackUrl && { callBackUrl: callbackUrl })
        }
      },
      // 2) With direct model fields (Some Kie versions expect this)
      {
        url: grokApiUrl,
        body: {
          model: 'grok-imagine/text-to-video',
          prompt: sanitizedPrompt,
          ...(callbackUrl && { callBackUrl: callbackUrl })
        }
      },
      // 3) Flat structure inside input
      {
        url: grokApiUrl,
        body: {
          model: 'grok-imagine/text-to-video',
          input: {
            text_prompt: sanitizedPrompt,
            action: sanitizedPrompt
          }
        }
      }
    ];

    let taskId: string | undefined;
    let lastError: string | null = null;
    let lastResponse: any = null;

    for (let i = 0; i < asyncRequestBodies.length; i++) {
      try {
        const reqConfig = asyncRequestBodies[i];
        console.log(`\n🔄 [T2V FALLBACK ${i + 1}/${asyncRequestBodies.length}]`);
        console.log(`🔗 URL: ${reqConfig.url}`);
        console.log(`📝 Body Keys: ${Object.keys(reqConfig.body).join(', ')}`);

        const response = await fetch(reqConfig.url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reqConfig.body),
        });

        const data = await response.json();
        lastResponse = data;
        console.log(`📊 Response ${i + 1} (Status ${response.status}):`, JSON.stringify(data));

        if (response.ok && (data.code === 200 || data.code === '200' || !data.code)) {
          taskId = data.taskId || data.data?.taskId || data.id || data.recordId || data.data?.recordId;
          if (taskId) {
            console.log(`✅ Success with format ${i + 1}, taskId:`, taskId);
            break;
          } else {
            console.warn(`⚠️ Response OK but no taskId found in structure:`, Object.keys(data));
          }
        }

        lastError = data.msg || data.message || JSON.stringify(data);
        console.log(`❌ Attempt ${i + 1} failed:`, lastError);
      } catch (err) {
        console.warn(`⚠️ Attempt ${i + 1} exception:`, err instanceof Error ? err.message : String(err));
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (taskId) {
      return NextResponse.json({
        success: true,
        taskId: taskId,
        message: 'Text-to-video generation started'
      });
    }

    console.error('❌ All text-to-video formats failed');
    return NextResponse.json(
      {
        error: 'Failed to start text-to-video generation',
        details: lastError,
        response: lastResponse
      },
      { status: 500 }
    );

  } catch (error) {
    console.error('❌ Text-to-video error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
