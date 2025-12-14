import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminStorage } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSecret(): string | undefined {
  // Prefer a dedicated secret; fall back to NEXTAUTH_SECRET if present.
  return process.env.PUBLIC_IMAGE_PROXY_SECRET || process.env.NEXTAUTH_SECRET;
}

function sign(bucket: string, objectPath: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${bucket}\n${objectPath}`).digest('hex');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket') || '';
    const path = searchParams.get('path') || '';
    const sig = searchParams.get('sig') || '';

    if (!bucket || !path || !sig) {
      return NextResponse.json({ error: 'bucket, path, and sig are required' }, { status: 400 });
    }

    const secret = getSecret();
    if (!secret) {
      return NextResponse.json(
        { error: 'PUBLIC_IMAGE_PROXY_SECRET (or NEXTAUTH_SECRET) is not configured' },
        { status: 500 }
      );
    }

    const expected = sign(bucket, path, secret);
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const file = adminStorage.bucket(bucket).file(path);
    const [meta] = await file.getMetadata().catch(() => [null as any]);
    const contentType = meta?.contentType || 'application/octet-stream';

    const [buf] = await file.download();
    const body = new Uint8Array(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache briefly; Kie fetch happens soon after generation starts.
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    console.error('public-image error:', e);
    return NextResponse.json(
      { error: 'Failed to serve image', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


