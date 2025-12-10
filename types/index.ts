export type UserTier = 'free' | 'pro' | 'lifetime';
export type IntensityLevel = 'mild' | 'spicy' | 'extreme';
export type TemplateCategory = 'all' | 'for-you' | 'sway' | 'shimmy' | 'peach' | 'halloween' | 'playful' | 'fright-zone' | 'jk' | 'bunny-girl' | 'catgirl' | 'custom';

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: TemplateCategory;
  intensity: IntensityLevel;
  prompt: string;
  isPremium: boolean;
  isHidden: boolean; // For Hidden Vault
  price?: number; // For pay-per-video
  previewVideo?: string; // Optional preview video URL
}

export interface GeneratedVideo {
  id: string;
  videoUrl: string;
  thumbnail: string;
  templateId: string;
  templateName: string;
  createdAt: string;
  isWatermarked: boolean;
  tags?: string[];
  userId?: string; // User who generated the video
  type: 'video'; // Asset type
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  thumbnail?: string;
  prompt?: string;
  createdAt: string;
  tags?: string[];
  userId?: string; // User who generated the image
  type: 'image'; // Asset type
  source?: 'text-to-image' | 'image-to-video'; // How it was generated
}

export interface User {
  id: string;
  email?: string;
  tier: UserTier;
  credits: number;
  dailyVideoCount: number;
  lastVideoDate: string;
  isAgeVerified: boolean;
  createdAt: string;
}

export interface VideoGenerationRequest {
  imageUrl: string;
  templateId: string;
  intensity?: IntensityLevel;
}

export interface VideoGenerationResponse {
  videoId: string;
  videoUrl: string;
  status: 'processing' | 'completed' | 'failed';
  estimatedTime?: number;
}

