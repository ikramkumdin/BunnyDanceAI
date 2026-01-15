import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, GeneratedVideo, Template } from '@/types';

interface AppState {
  user: User | null;
  videos: GeneratedVideo[];
  selectedTemplate: Template | null;
  uploadedImage: string | null;
  isAgeVerified: boolean;
  images: any[];
  setUser: (user: User | null) => void;
  setVideos: (videos: GeneratedVideo[]) => void;
  addVideo: (video: GeneratedVideo) => void;
  setImages: (images: any[]) => void;
  addImage: (image: any) => void;
  setSelectedTemplate: (template: Template | null) => void;
  setUploadedImage: (image: string | null) => void;
  setAgeVerified: (verified: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      videos: [],
      images: [],
      selectedTemplate: null,
      uploadedImage: null,
      isAgeVerified: false,
      setUser: (user) => set({ user }),
      setVideos: (videos) => set({ videos }),
      addVideo: (video) => set((state) => ({ videos: [video, ...state.videos] })),
      setImages: (images) => set({ images }),
      addImage: (image) => set((state) => ({ images: [image, ...state.images] })),
      setSelectedTemplate: (template) => set({ selectedTemplate: template }),
      setUploadedImage: (image) => {
        // Only store GCP URLs in state, not base64 (too large for localStorage)
        // Base64 images will be kept in component state only
        set({ uploadedImage: image });
      },
      setAgeVerified: (verified) => set({ isAgeVerified: verified }),
    }),
    {
      name: 'bunny-dance-storage',
      partialize: (state) => ({
        // Persist user and assets (metadata only)
        user: state.user,
        videos: state.videos,
        images: state.images,
        // Only persist GCP URLs (not base64), and only if it's a URL (not base64)
        uploadedImage: state.uploadedImage && !state.uploadedImage.startsWith('data:')
          ? state.uploadedImage
          : null,
        isAgeVerified: state.isAgeVerified,
        selectedTemplate: state.selectedTemplate,
      }),
    }
  )
);

