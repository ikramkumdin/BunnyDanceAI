import { NextRequest, NextResponse } from 'next/server';

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

    const grokApiUrl = 'https://api.kie.ai/api/v1/jobs/createTask';
    const apiKey = process.env.GROK_API_KEY;

    if (!apiKey) {
      console.error('❌ GROK_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Sanitize prompt
    const sanitizedPrompt = prompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    const requestBody = {
      model: 'grok-imagine/text-to-video',
      input: {
        prompt: sanitizedPrompt,
        index: 0
      }
    };

    console.log('🚀 Sending text-to-video request to Kie.ai...');

    const response = await fetch(grokApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('📊 Response:', JSON.stringify(data));

    if (response.ok && (data.code === 200 || !data.code)) {
      const taskId = data.taskId || data.data?.taskId || data.id || data.recordId || data.data?.recordId;
      if (taskId) {
        return NextResponse.json({
          success: true,
          taskId: taskId,
          message: 'Video generation started'
        });
      }
    }

    return NextResponse.json(
      { error: 'Video generation failed', details: data },
      { status: response.status || 500 }
    );

  } catch (error) {
    console.error('❌ Text-to-video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
