import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { prompt, userId } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('🎬 Text-to-video started (Grok Imagine)');
    const apiKey = process.env.GROK_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // 1. Sanitize prompt - matching diagnostic success pattern
    const sanitizedPrompt = prompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    // 2. Prepare structured fallbacks
    // Attempt 1: PURE Pattern (No index, no callback) - Matches working curl
    const fallbacks = [
      {
        model: 'grok-imagine/text-to-video',
        input: {
          prompt: sanitizedPrompt
        }
      },
      // Attempt 2: Pattern with index: 0
      {
        model: 'grok-imagine/text-to-video',
        input: {
          prompt: sanitizedPrompt,
          index: 0
        }
      }
    ];

    let taskId: string | undefined;
    let lastError: any = null;

    for (let i = 0; i < fallbacks.length; i++) {
      try {
        console.log(`🔄 [T2V Attempt ${i + 1}] Body:`, JSON.stringify(fallbacks[i]));
        const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbacks[i]),
        });

        const text = await response.text();
        console.log(`📊 Response ${i + 1} (Status ${response.status}):`, text);

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          lastError = `Non-JSON response: ${text.substring(0, 100)}`;
          continue;
        }

        if (response.ok && (data.code === 200 || !data.code)) {
          taskId = data.taskId || data.data?.taskId || data.recordId || data.data?.recordId || data.id;
          if (taskId) break;
        }
        lastError = data.msg || data.message || text;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (taskId) {
      return NextResponse.json({ success: true, taskId });
    }

    return NextResponse.json({ error: 'Generation failed', details: lastError }, { status: 500 });

  } catch (error) {
    console.error('❌ T2V crash:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
