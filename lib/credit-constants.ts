// Credit constants that can be used on both client and server
// This file does NOT import firebase-admin, so it's safe for client components

// Free tier limits - 40 credits total for free trial (sufficient for 1-2 videos and images)
// According to pricing strategy: 40 credits = enough for 1-2 videos (20 credits each) and images
export const FREE_IMAGE_CREDITS = 20; // 20 credits for images
export const FREE_VIDEO_CREDITS = 20; // 20 credits for 1 video (20 credits per video)

// Credit costs for each generation type
// According to pricing strategy: Video = 20 credits, Image = 1 credit
export const CREDIT_COSTS = {
  IMAGE: 1, // 1 credit per image
  VIDEO: 20, // 20 credits per video (as per pricing strategy document)
};
