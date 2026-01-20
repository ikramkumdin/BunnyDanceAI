import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/data/templates';
import { uploadImage } from '@/lib/storage';
import { getTemplatePrompt } from '@/data/template-prompts';
import { verifyAuthToken } from '@/lib/verify-auth';
import { getUserAdmin } from '@/lib/firestore-admin';

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

    const body = await request.json();
    const { imageUrl, imageDataUrl, templateId, userId } = body;

    // Verify userId matches authenticated user
    if (userId !== authUid) {
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

    console.log('🎬 Image-to-video started');
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });

    if ((!imageUrl && !imageDataUrl) || !templateId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const template = templates.find((t) => t.id === templateId);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // 1. Resolve image to a public GCS URL
    let gcsUrl: string;
    if (imageDataUrl?.startsWith('data:image/')) {
      gcsUrl = await uploadImage(imageDataUrl, userId, 'images');
    } else {
      if (imageUrl && !imageUrl.includes('storage.googleapis.com')) {
        try {
          const resp = await fetch(imageUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          const base64 = `data:${resp.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
          gcsUrl = await uploadImage(base64, userId, 'images');
        } catch (e) {
          gcsUrl = imageUrl;
        }
      } else {
        gcsUrl = imageUrl;
      }
    }

    // 2. Prepare Prompt (Sanitized)
    const promptFromDb = getTemplatePrompt(template.id)?.prompt;
    const rawPrompt = (template.prompt || promptFromDb || 'A professional dance performance').trim();
    // Identity wrapper
    const wrapper = 'IMPORTANT: Use the person from the provided reference image as the main subject. The person in the video MUST be identical to the person in the reference image. ';
    const sanitizedPrompt = (wrapper + rawPrompt).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    // 3. Prepare fallbacks - simplified to match successful patterns
    const fallbacks = [
      {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: [gcsUrl],
          prompt: sanitizedPrompt
        }
      },
      {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: [gcsUrl],
          prompt: sanitizedPrompt,
          index: 0
        }
      }
    ];

    let taskId: string | undefined;
    let lastError: any = null;

    for (let i = 0; i < fallbacks.length; i++) {
      try {
        console.log(`🔄 [I2V Attempt ${i + 1}] Body keys:`, Object.keys(fallbacks[i]));
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
          lastError = `Non-JSON: ${text.substring(0, 100)}`;
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
    console.error('❌ I2V crash:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
