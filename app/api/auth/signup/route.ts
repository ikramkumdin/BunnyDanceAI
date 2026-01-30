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
    const { email, password, name } = await request.json();

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
      const errorCode = signUpData.error?.message;
      let userMessage = 'Sign up failed. Please try again.';
      
      if (errorCode === 'EMAIL_EXISTS') {
        userMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (errorCode === 'OPERATION_NOT_ALLOWED') {
        userMessage = 'Email/password accounts are not enabled. Please contact support.';
      } else if (errorCode === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        userMessage = 'Too many attempts. Please try again later.';
      } else if (errorCode === 'INVALID_EMAIL') {
        userMessage = 'Invalid email address. Please check and try again.';
      } else if (errorCode === 'WEAK_PASSWORD') {
        userMessage = 'Password is too weak. Please use at least 6 characters.';
      }
      
      return NextResponse.json(
        { error: userMessage },
        { status: 400 }
      );
    }

    const { idToken, localId: uid, email: userEmail } = signUpData;

    // Create user in Firestore
    const userData = {
      email: userEmail,
      name: name || undefined,
      displayName: name || undefined,
      tier: 'free',
      credits: 0, // Legacy field
      imageCredits: 3, // Free tier: 3 images
      videoCredits: 3, // Free tier: 3 videos
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
