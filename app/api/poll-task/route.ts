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

    // Also try alternative base URLs in case the API structure is different
    const alternativeBases = [
      'https://api.kie.ai',
      'https://kie.ai/api',
      'https://app.kie.ai/api',
      'https://platform.kie.ai/api'
    ];

    // Try common task status endpoints and variations based on Kie.ai patterns
    const possibleEndpoints = [
      // Kie.ai specific patterns (based on their API structure)
      `${baseUrl}/api/v1/veo/task/${taskId}`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}`,
      `${baseUrl}/api/v1/veo/generation/${taskId}`,
      `${baseUrl}/api/v1/veo/jobs/${taskId}`,

      // Status endpoints
      `${baseUrl}/api/v1/veo/task/${taskId}/status`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}/status`,
      `${baseUrl}/api/v1/veo/generation/${taskId}/status`,
      `${baseUrl}/api/v1/veo/jobs/${taskId}/status`,

      // Direct endpoints
      `${baseUrl}/api/v1/task/${taskId}`,
      `${baseUrl}/api/v1/tasks/${taskId}`,
      `${baseUrl}/api/v1/generation/${taskId}`,
      `${baseUrl}/api/v1/jobs/${taskId}`,

      // Result endpoints
      `${baseUrl}/api/v1/veo/task/${taskId}/result`,
      `${baseUrl}/api/v1/veo/tasks/${taskId}/result`,
      `${baseUrl}/api/v1/veo/generation/${taskId}/result`,
      `${baseUrl}/api/v1/veo/jobs/${taskId}/result`,

      // Alternative API versions
      `${baseUrl}/v1/veo/task/${taskId}`,
      `${baseUrl}/v1/veo/tasks/${taskId}`,
      `${baseUrl}/v1/veo/generation/${taskId}`,
      `${baseUrl}/v1/veo/jobs/${taskId}`,

      // Root level (less likely but worth trying)
      `${baseUrl}/veo/task/${taskId}`,
      `${baseUrl}/veo/tasks/${taskId}`,
      `${baseUrl}/task/${taskId}`,
      `${baseUrl}/tasks/${taskId}`,

      // Query parameter approach
      `${baseUrl}/api/v1/veo/generate/status?taskId=${taskId}`,
      `${baseUrl}/api/v1/veo/generate/result?taskId=${taskId}`,
      `${baseUrl}/api/v1/generate/status?taskId=${taskId}`,

      // POST request approach (some APIs require POST for status checks)
      // We'll handle POST requests separately below

      // Alternative patterns
      `${baseUrl}/api/v1/status/${taskId}`,
      `${baseUrl}/api/v1/result/${taskId}`,
      `${baseUrl}/api/v1/queue/${taskId}`,
      `${baseUrl}/api/v1/progress/${taskId}`,

      // Video generation specific endpoints
      `${baseUrl}/api/v1/video/${taskId}`,
      `${baseUrl}/api/v1/video/${taskId}/status`,
      `${baseUrl}/api/v1/video/${taskId}/result`,
    ];

    // Also try POST requests to some endpoints (some APIs require POST for status)
    const postEndpoints = [
      `${baseUrl}/api/v1/veo/generate/status`,
      `${baseUrl}/api/v1/generate/status`,
      `${baseUrl}/api/v1/task/status`,
      `${baseUrl}/api/v1/status`,
    ];
    
    // Try each GET endpoint until one works
    let lastError: any = null;
    for (const statusUrl of possibleEndpoints) {
      try {
        console.log(`Trying GET: ${statusUrl}`);
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('✅ Poll response (GET):', JSON.stringify(statusData, null, 2));
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
        console.error(`Error polling GET ${statusUrl}:`, error);
        // Continue to next endpoint
        continue;
      }
    }

    // Try POST endpoints if GET failed
    console.log('GET requests failed, trying POST requests...');
    for (const statusUrl of postEndpoints) {
      try {
        console.log(`Trying POST: ${statusUrl}`);
        const statusResponse = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId }),
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('✅ Poll response (POST):', JSON.stringify(statusData, null, 2));
          return NextResponse.json(statusData);
        } else {
          // Continue to next endpoint even for non-404 errors
          lastError = { status: statusResponse.status, message: `POST to ${statusUrl} failed` };
          continue;
        }
      } catch (error) {
        lastError = error;
        console.error(`Error polling POST ${statusUrl}:`, error);
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

