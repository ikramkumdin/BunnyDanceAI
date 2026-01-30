import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { getUserAdmin } from '@/lib/firestore-admin';
import { hasCredits, deductCredit } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to generate videos' },
        { status: 401 }
      );
    }

    const { prompt, userId } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
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
        { error: 'Unauthorized: Please sign in with email or Google to generate videos' },
        { status: 401 }
      );
    }

    // Check if user has video credits (unless they're pro/lifetime)
    if (user.tier === 'free') {
      const hasVideoCredits = await hasCredits(authUid, 'video');
      if (!hasVideoCredits) {
        return NextResponse.json(
          { error: 'No video credits remaining. Please upgrade to continue generating videos.', needsUpgrade: true },
          { status: 403 }
        );
      }
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
      // Deduct credit for free users
      if (user.tier === 'free') {
        await deductCredit(authUid, 'video');
        console.log('💳 Deducted 1 video credit from user');
      }
      
      return NextResponse.json({ success: true, taskId });
    }

    return NextResponse.json({ error: 'Generation failed', details: lastError }, { status: 500 });

  } catch (error) {
    console.error('❌ T2V crash:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
