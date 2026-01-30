import { adminDb } from './firebase-admin';
import { User } from '@/types';

// Free tier limits
export const FREE_IMAGE_CREDITS = 3;
export const FREE_VIDEO_CREDITS = 3;

// Credit costs for each generation type
export const CREDIT_COSTS = {
  IMAGE: 1,
  VIDEO: 1,
};

/**
 * Check if user has enough credits for a specific action
 */
export async function hasCredits(userId: string, type: 'image' | 'video'): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data() as User;
    
    // Pro and lifetime users have unlimited credits
    if (userData.tier === 'pro' || userData.tier === 'lifetime') {
      return true;
    }
    
    // Check credits based on type
    if (type === 'image') {
      return (userData.imageCredits || 0) > 0;
    } else {
      return (userData.videoCredits || 0) > 0;
    }
  } catch (error) {
    console.error('Error checking credits:', error);
    return false;
  }
}

/**
 * Deduct credits from user account
 */
export async function deductCredit(userId: string, type: 'image' | 'video'): Promise<boolean> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data() as User;
    
    // Pro and lifetime users don't need credit deduction
    if (userData.tier === 'pro' || userData.tier === 'lifetime') {
      return true;
    }
    
    // Deduct credit based on type
    if (type === 'image') {
      const currentCredits = userData.imageCredits || 0;
      if (currentCredits <= 0) return false;
      
      await userRef.update({
        imageCredits: currentCredits - CREDIT_COSTS.IMAGE,
      });
    } else {
      const currentCredits = userData.videoCredits || 0;
      if (currentCredits <= 0) return false;
      
      await userRef.update({
        videoCredits: currentCredits - CREDIT_COSTS.VIDEO,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error deducting credits:', error);
    return false;
  }
}

/**
 * Get user's remaining credits
 */
export async function getRemainingCredits(userId: string): Promise<{ imageCredits: number; videoCredits: number }> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { imageCredits: 0, videoCredits: 0 };
    }
    
    const userData = userDoc.data() as User;
    
    // Pro and lifetime users have unlimited
    if (userData.tier === 'pro' || userData.tier === 'lifetime') {
      return { imageCredits: Infinity, videoCredits: Infinity };
    }
    
    return {
      imageCredits: userData.imageCredits || 0,
      videoCredits: userData.videoCredits || 0,
    };
  } catch (error) {
    console.error('Error getting remaining credits:', error);
    return { imageCredits: 0, videoCredits: 0 };
  }
}

/**
 * Add credits to user account (for purchases)
 */
export async function addCredits(
  userId: string,
  imageCredits: number = 0,
  videoCredits: number = 0
): Promise<boolean> {
  try {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data() as User;
    
    await userRef.update({
      imageCredits: (userData.imageCredits || 0) + imageCredits,
      videoCredits: (userData.videoCredits || 0) + videoCredits,
    });
    
    return true;
  } catch (error) {
    console.error('Error adding credits:', error);
    return false;
  }
}
