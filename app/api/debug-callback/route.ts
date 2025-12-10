import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/imageCallbackCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const cacheStats = getCacheStats();

    return NextResponse.json({
      message: 'Callback debug info',
      cacheStats: cacheStats,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasFirebaseKey: !!process.env.GCP_SERVICE_ACCOUNT_KEY,
        hasFirebaseProject: !!process.env.GCP_PROJECT_ID,
        firebaseProjectId: process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bunnydanceai',
        envVars: {
          GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET',
          GROK_API_KEY: process.env.GROK_API_KEY ? 'SET' : 'NOT SET',
        }
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('🧪 Manual callback test received:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      received: true,
      data: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Manual callback test error:', error);
    return NextResponse.json({
      error: 'Manual callback test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
