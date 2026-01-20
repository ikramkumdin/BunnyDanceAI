import { NextRequest } from 'next/server';
import { adminAuth } from './firebase-admin';

/**
 * Verify Firebase Auth token from request headers
 * Returns the user's UID if authenticated, null otherwise
 */
export async function verifyAuthToken(request: NextRequest): Promise<string | null> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!idToken) {
      return null;
    }

    // Verify the token using Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * Verify user is authenticated and return UID or throw error
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const uid = await verifyAuthToken(request);
  
  if (!uid) {
    throw new Error('Unauthorized: Authentication required');
  }
  
  return uid;
}
