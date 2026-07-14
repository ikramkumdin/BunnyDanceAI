import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { uploadImage, uploadVideo } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Persist a freshly generated media URL to permanent storage (GCS).
 *
 * Generation providers (Kie.ai / aiquickdraw) return TEMPORARY URLs that expire,
 * so saving them straight to Firestore leads to broken images/videos once the
 * provider purges the file. The client calls this right before saving an asset
 * so the stored URL points at our permanent bucket instead.
 *
 * POST /api/persist-media
 * Body: { url: string, type: 'image' | 'video', userId?: string }
 * Returns: { url: string }  — the permanent (or original, if already permanent) URL
 */
export async function POST(request: NextRequest) {
  try {
    const { url, type, userId: bodyUserId } = await request.json();

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return NextResponse.json({ error: 'A valid http url is required' }, { status: 400 });
    }
    if (type !== 'image' && type !== 'video') {
      return NextResponse.json({ error: "type must be 'image' or 'video'" }, { status: 400 });
    }

    // Already on our bucket — nothing to do.
    if (url.includes('storage.googleapis.com')) {
      return NextResponse.json({ url });
    }

    // Prefer the authenticated uid; fall back to a client-provided id so
    // anonymous (not-yet-signed-in) users' assets are still persisted.
    const authUid = await verifyAuthToken(request);
    const ownerId = authUid || (typeof bodyUserId === 'string' && bodyUserId ? bodyUserId : null);
    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permanentUrl =
      type === 'video' ? await uploadVideo(url, ownerId) : await uploadImage(url, ownerId, 'images');

    return NextResponse.json({ url: permanentUrl });
  } catch (error) {
    console.error('persist-media error:', error);
    return NextResponse.json(
      { error: 'Failed to persist media', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
