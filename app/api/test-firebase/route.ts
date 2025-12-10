import { NextRequest, NextResponse } from 'next/server';
import { saveImage } from '@/lib/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Firebase connection...');

    // First check if service account key is valid
    const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
    console.log('🔑 Service account key present:', !!serviceAccountKey);

    if (serviceAccountKey) {
      try {
        const parsed = JSON.parse(serviceAccountKey);
        console.log('✅ Service account key is valid JSON');
        console.log('📋 Project ID from key:', parsed.project_id);
        console.log('📧 Client email:', parsed.client_email);
      } catch (parseError) {
        console.error('❌ Service account key is not valid JSON:', parseError);
        return NextResponse.json({
          success: false,
          error: 'Invalid service account key JSON',
          details: parseError instanceof Error ? parseError.message : 'JSON parse error',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    } else {
      console.log('⚠️ No service account key found, using fallback');
    }

    console.log('🔗 Testing Firestore connection...');

    // Test Firestore connection by trying to get a reference
    const { adminDb } = await import('@/lib/firebase-admin');
    console.log('✅ Firebase admin initialized');

    // Try to get a collection reference
    const testCollection = adminDb.collection('test');
    console.log('✅ Firestore collection reference created');

    // Try a simple query to test if Firestore is enabled
    try {
      const testQuery = await testCollection.limit(1).get();
      console.log('✅ Firestore query successful');
    } catch (firestoreError: any) {
      console.error('❌ Firestore query failed:', firestoreError);

      if (firestoreError.code === 'permission-denied') {
        return NextResponse.json({
          success: false,
          error: 'Firestore permission denied',
          details: 'Service account may not have Firestore access, or Firestore may not be enabled in this project',
          suggestion: 'Enable Firestore in Firebase Console and check service account permissions',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }

      throw firestoreError;
    }

    console.log('🎯 Testing image save...');

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
      code: error instanceof Error && 'code' in error ? error.code : 'UNKNOWN',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
