import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Check if this is a test task
    const isTestMode = process.env.KIE_TEST_MODE === 'true' && taskId.startsWith('test-');
    if (isTestMode) {
      console.log('🧪 TEST MODE: Simulating task status check for:', taskId);

      // Simulate task completion after 30 seconds
      const taskStartTime = parseInt(taskId.replace('test-', ''));
      const elapsed = Date.now() - taskStartTime;

      if (elapsed > 30000) { // 30 seconds
        console.log('✅ TEST MODE: Task completed');
        return NextResponse.json({
          status: 'completed',
          videoUrl: 'https://example.com/test-video.mp4',
          taskId: taskId
        });
      } else {
        console.log('⏳ TEST MODE: Task still processing');
        return NextResponse.json({
          status: 'processing',
          progress: Math.min(95, Math.floor((elapsed / 30000) * 100)),
          taskId: taskId
        });
      }
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Try different possible endpoints for task status
    const kieApiUrl = process.env.GROK_API_URL || 'https://api.kie.ai/api/v1/veo/generate';
    const baseUrl = kieApiUrl.replace('/api/v1/veo/generate', '');

    // Try common task status endpoints and variations
    const possibleEndpoints = [
      // Direct task endpoints (most likely)
      `${baseUrl}/api/v1/task/${taskId}`,
      `${baseUrl}/api/v1/tasks/${taskId}`,
      `${baseUrl}/api/v1/veo/task/${taskId}`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}`,

      // Status endpoints
      `${baseUrl}/api/v1/task/${taskId}/status`,
      `${baseUrl}/api/v1/tasks/${taskId}/status`,
      `${baseUrl}/api/v1/veo/task/${taskId}/status`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}/status`,

      // Generation endpoints
      `${baseUrl}/api/v1/generation/${taskId}`,
      `${baseUrl}/api/v1/veo/generation/${taskId}`,
      `${baseUrl}/api/v1/generation/${taskId}/status`,
      `${baseUrl}/api/v1/veo/generation/${taskId}/status`,

      // Job endpoints
      `${baseUrl}/api/v1/job/${taskId}`,
      `${baseUrl}/api/v1/jobs/${taskId}`,
      `${baseUrl}/api/v1/veo/job/${taskId}`,
      `${baseUrl}/api/v1/veo/jobs/${taskId}`,

      // Result endpoints
      `${baseUrl}/api/v1/task/${taskId}/result`,
      `${baseUrl}/api/v1/tasks/${taskId}/result`,
      `${baseUrl}/api/v1/veo/task/${taskId}/result`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}/result`,

      // Alternative API versions (v1 instead of api/v1)
      `${baseUrl}/v1/task/${taskId}`,
      `${baseUrl}/v1/tasks/${taskId}`,
      `${baseUrl}/v1/veo/task/${taskId}`,
      `${baseUrl}/v1/veo/tasks/${taskId}`,

      // Root level endpoints
      `${baseUrl}/task/${taskId}`,
      `${baseUrl}/tasks/${taskId}`,
      `${baseUrl}/veo/task/${taskId}`,
      `${baseUrl}/veo/tasks/${taskId}`,

      // Query parameter approach
      `${baseUrl}/api/v1/veo/generate?taskId=${taskId}`,
      `${baseUrl}/api/v1/generate?taskId=${taskId}`,
      `${baseUrl}/v1/generate?taskId=${taskId}`,
    ];
    
    // Try each endpoint until one works
    let lastError: any = null;
    for (const statusUrl of possibleEndpoints) {
      try {
        console.log(`Trying to poll: ${statusUrl}`);
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('Poll response:', JSON.stringify(statusData, null, 2));
          return NextResponse.json(statusData);
        } else {
          // If 404, try next endpoint
          if (statusResponse.status === 404) {
            lastError = { status: 404, message: `Endpoint ${statusUrl} not found` };
            continue;
          }
          // For other errors, return immediately
          const errorText = await statusResponse.text();
          return NextResponse.json(
            { error: 'Failed to check task status', details: errorText, endpoint: statusUrl },
            { status: statusResponse.status }
          );
        }
      } catch (error) {
        lastError = error;
        console.error(`Error polling ${statusUrl}:`, error);
        // Continue to next endpoint
        continue;
      }
    }
    
    // If all endpoints failed, return error
    return NextResponse.json(
      { 
        error: 'Failed to check task status - all endpoints failed',
        details: lastError?.message || 'Unknown error',
        suggestion: 'Please configure KIE_CALLBACK_URL in .env.local to use webhook-based completion instead of polling'
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Poll task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

