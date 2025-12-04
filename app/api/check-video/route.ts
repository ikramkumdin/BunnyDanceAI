import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const taskId = searchParams.get('taskId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Get user's videos - use a simpler query that doesn't require an index
    // Just get all videos for the user and filter in memory
    try {
      const q = query(
        collection(db, 'videos'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      const videos = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || 
                     (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
        };
      });
      
      // Sort by createdAt in memory (no index needed)
      videos.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; // Most recent first
      });
      
      // Check if we have a video that was recently created (within last 5 minutes)
      const recentVideo = videos.find(video => {
        const createdAt = new Date(video.createdAt).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return createdAt > fiveMinutesAgo;
      });

      if (recentVideo) {
        return NextResponse.json({
          ready: true,
          videoUrl: recentVideo.videoUrl,
          videoId: recentVideo.id,
        });
      }

      return NextResponse.json({
        ready: false,
        message: 'Video not ready yet',
      });
    } catch (firestoreError: any) {
      // If index error, try without orderBy
      if (firestoreError.code === 'failed-precondition') {
        console.warn('Firestore index not found, using fallback query');
        const q = query(
          collection(db, 'videos'),
          where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        
        const videos = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || 
                       (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
          };
        });
        
        // Sort in memory
        videos.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
        
        const recentVideo = videos.find(video => {
          const createdAt = new Date(video.createdAt).getTime();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          return createdAt > fiveMinutesAgo;
        });

        if (recentVideo) {
          return NextResponse.json({
            ready: true,
            videoUrl: recentVideo.videoUrl,
            videoId: recentVideo.id,
          });
        }

        return NextResponse.json({
          ready: false,
          message: 'Video not ready yet',
        });
      }
      throw firestoreError;
    }
  } catch (error) {
    console.error('Check video error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

