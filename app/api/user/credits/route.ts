import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/verify-auth';
import { getRemainingCredits } from '@/lib/credits';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authUid = await verifyAuthToken(request);
    if (!authUid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get remaining credits
    const credits = await getRemainingCredits(authUid);

    return NextResponse.json({
      success: true,
      imageCredits: credits.imageCredits,
      videoCredits: credits.videoCredits,
    });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
