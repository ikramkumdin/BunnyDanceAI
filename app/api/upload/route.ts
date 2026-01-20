import { NextRequest, NextResponse } from 'next/server';
import { uploadImage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    // NextRequest.formData() returns a web FormData (undici) at runtime, but TS can
    // sometimes pick up a Node FormData type without .get(). Cast to the web FormData shape.
    const formData = (await request.formData()) as unknown as {
      get(name: string): FormDataEntryValue | null;
    };
    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string | null) || 'anonymous';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type' },
        { status: 400 }
      );
    }

    // Upload to GCP Cloud Storage
    const imageUrl = await uploadImage(file, userId, 'images');
    
    return NextResponse.json({
      imageUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

