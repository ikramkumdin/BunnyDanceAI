import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { addCredits } from '@/lib/credits';

/**
 * Refund credit when generation fails
 * This endpoint refunds a credit to the user when video/image generation fails
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { type, taskId } = await request.json();

    if (!type || (type !== 'image' && type !== 'video')) {
      return NextResponse.json(
        { error: 'Invalid credit type. Must be "image" or "video"' },
        { status: 400 }
      );
    }

    // Refund 1 credit of the specified type
    const imageCredits = type === 'image' ? 1 : 0;
    const videoCredits = type === 'video' ? 1 : 0;

    const success = await addCredits(authUid, imageCredits, videoCredits);

    if (success) {
      console.log(`💳 Refunded 1 ${type} credit to user ${authUid} for failed task ${taskId || 'unknown'}`);
      return NextResponse.json({ 
        success: true, 
        message: `Refunded 1 ${type} credit`,
        credits: { imageCredits, videoCredits }
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to refund credit' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Refund credit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
