import { NextResponse } from 'next/server';
import { saveImage } from '@/lib/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Firebase connection...');

    // Test saving a dummy image
    const testImageId = await saveImage({
      userId: 'test-user',
      imageUrl: 'https://example.com/test.jpg',
      prompt: 'Test image for Firebase connection',
      source: 'text-to-image',
      tags: ['test'],
      type: 'image',
      createdAt: new Date().toISOString(),
    });

    console.log('✅ Firebase test successful! Image ID:', testImageId);

    return NextResponse.json({
      success: true,
      message: 'Firebase connection successful',
      testImageId: testImageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Firebase test failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Firebase connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
