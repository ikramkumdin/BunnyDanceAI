import { NextRequest, NextResponse } from 'next/server';
import { getUserAdmin } from '@/lib/firestore-admin';

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Use Firebase Admin to verify credentials
    // Note: Firebase Admin doesn't have direct sign-in, so we'll need to use a different approach
    // For now, we'll create a custom token that the mobile app can use
    
    // Alternative: Use Firebase REST API to sign in
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      return NextResponse.json(
        { error: 'Firebase API key not configured' },
        { status: 500 }
      );
    }

    // Sign in using Firebase REST API
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const signInData = await signInResponse.json();

    if (!signInResponse.ok) {
      return NextResponse.json(
        { error: signInData.error?.message || 'Sign in failed' },
        { status: 401 }
      );
    }

    const { idToken, localId: uid, email: userEmail } = signInData;

    // Get or create user in Firestore
    let user = await getUserAdmin(uid);
    
    if (!user) {
      // User will be created on first generation request
      user = {
        id: uid,
        email: userEmail,
        tier: 'free',
        credits: 100, // Give 100 credits to new mobile users
        dailyVideoCount: 0,
        lastVideoDate: new Date().toISOString(),
        isAgeVerified: false,
        createdAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        user,
        idToken, // Mobile app will use this for API calls
      },
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: error.message || 'Sign in failed' },
      { status: 500 }
    );
  }
}
