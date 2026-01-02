import { NextRequest, NextResponse } from 'next/server';
import { templates } from '@/data/templates';
import { uploadImage } from '@/lib/storage';
import { adminDb } from '@/lib/firebase-admin';
import { getTemplatePrompt } from '@/data/template-prompts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, imageDataUrl, templateId, userId } = body;

    console.log('🎬 Image-to-video generation started');
    console.log('📋 Template ID:', templateId);
    console.log('👤 User ID:', userId);

    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) {
      console.error('❌ GROK_API_KEY not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    if ((!imageUrl && !imageDataUrl) || !templateId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: `Template not found: ${templateId}` }, { status: 404 });
    }

    // 1. Resolve image to a public GCS URL
    let gcsUrl: string;
    if (imageDataUrl?.startsWith('data:image/')) {
      console.log('📤 Uploading base64 image to GCS...');
      gcsUrl = await uploadImage(imageDataUrl, userId, 'images');
    } else {
      // Check if external - download and re-upload to GCS for persistence if needed
      if (imageUrl && !imageUrl.includes('storage.googleapis.com')) {
        console.log('🌍 Re-uploading external image to GCS:', imageUrl);
        try {
          const resp = await fetch(imageUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          const base64 = `data:${resp.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`;
          gcsUrl = await uploadImage(base64, userId, 'images');
        } catch (e) {
          console.warn('⚠️ Re-upload failed, using original URL:', e);
          gcsUrl = imageUrl;
        }
      } else {
        gcsUrl = imageUrl;
      }
    }

    // 2. Prepare Template Prompt (Guaranteed non-empty and sanitized)
    const promptFromDb = getTemplatePrompt(template.id)?.prompt;
    const rawPrompt = (template.prompt || promptFromDb || 'A professional dance performance').trim();
    // Identity wrapper specifically for I2V
    const wrapper = 'IMPORTANT: Use the person from the provided reference image as the main subject. The person in the video MUST be identical to the person in the reference image. ';
    const fullPrompt = (wrapper + rawPrompt).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const shortPrompt = rawPrompt.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    console.log('📝 Prompt prepared (length):', fullPrompt.length);

    // 3. Call Kie.ai with fallbacks
    const grokApiUrl = 'https://api.kie.ai/api/v1/jobs/createTask';
    const asyncRequestBodies = [
      // Fallback 1: Pure Pattern (matches diagnostic success)
      {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: [gcsUrl],
          prompt: fullPrompt, // With identity wrapper
          index: 0
        }
      },
      // Fallback 2: Minimal Pattern (no identity wrapper, just the action)
      {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: [gcsUrl],
          prompt: shortPrompt,
          index: 0
        }
      }
    ];

    let taskId: string | undefined;
    let lastError: any = null;

    for (let i = 0; i < asyncRequestBodies.length; i++) {
      try {
        console.log(`\n🔄 [I2V FALLBACK ${i + 1}/${asyncRequestBodies.length}]`);
        const response = await fetch(grokApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(asyncRequestBodies[i]),
        });

        const data = await response.json();
        console.log(`📊 Response ${i + 1} (Status ${response.status}):`, JSON.stringify(data));

        if (response.ok && (data.code === 200 || !data.code)) {
          taskId = data.taskId || data.data?.taskId || data.recordId || data.data?.recordId || data.id;
          if (taskId) break;
        }
        lastError = data.msg || data.message || JSON.stringify(data);
      } catch (err) {
        console.warn(`⚠️ Attempt ${i + 1} exception:`, err);
        lastError = err;
      }
    }

    if (taskId) {
      return NextResponse.json({
        success: true,
        taskId: taskId,
        message: 'Video generation started'
      });
    }

    return NextResponse.json({
      error: 'Failed to start generation',
      details: lastError
    }, { status: 500 });

  } catch (error) {
    console.error('❌ Generation route crash:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
