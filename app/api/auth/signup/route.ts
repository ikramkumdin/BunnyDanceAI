import { NextRequest, NextResponse } from 'next/server';
import { getUserAdmin } from '@/lib/firestore-admin';
import { adminDb } from '@/lib/firebase-admin';

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

    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      return NextResponse.json(
        { error: 'Firebase API key not configured' },
        { status: 500 }
      );
    }

    // Sign up using Firebase REST API
    const signUpResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
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

    const signUpData = await signUpResponse.json();

    if (!signUpResponse.ok) {
      return NextResponse.json(
        { error: signUpData.error?.message || 'Sign up failed' },
        { status: 400 }
      );
    }

    const { idToken, localId: uid, email: userEmail } = signUpData;

    // Create user in Firestore
    const userData = {
      email: userEmail,
      tier: 'free',
      credits: 100, // Give 100 credits to new mobile users
      dailyVideoCount: 0,
      lastVideoDate: new Date().toISOString(),
      isAgeVerified: false,
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore using Admin SDK
    try {
      await adminDb.collection('users').doc(uid).set(userData);
    } catch (error) {
      console.error('Error creating user in Firestore:', error);
      // Continue anyway - user can be created later
    }

    const user = {
      id: uid,
      ...userData,
    };

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
    console.error('Sign up error:', error);
    return NextResponse.json(
      { error: error.message || 'Sign up failed' },
      { status: 500 }
    );
  }
}
