import { adminDb } from './firebase-admin';
import { User } from '@/types';
import { CREDIT_COSTS, FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS } from './credit-constants';
export { FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS, CREDIT_COSTS };

/**
 * Check if user has enough credits for a specific action
 */
export async function hasCredits(userId: string, type: 'image' | 'video'): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data() as User;
    
    // Check credits based on type
    // Video requires 20 credits, image requires 1 credit
    if (type === 'image') {
      return (userData.imageCredits || 0) >= CREDIT_COSTS.IMAGE;
    } else {
      return (userData.videoCredits || 0) >= CREDIT_COSTS.VIDEO;
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
    
    // Deduct credit based on type
    if (type === 'image') {
      const currentCredits = userData.imageCredits || 0;
      if (currentCredits < CREDIT_COSTS.IMAGE) return false;
      
      await userRef.update({
        imageCredits: currentCredits - CREDIT_COSTS.IMAGE,
      });
    } else {
      const currentCredits = userData.videoCredits || 0;
      if (currentCredits < CREDIT_COSTS.VIDEO) return false;
      
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
