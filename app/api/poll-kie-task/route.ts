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

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Poll Kie.ai's task status endpoint
    const kieApiUrl = process.env.GROK_API_URL || 'https://api.kie.ai/api/v1/veo/generate';

    console.log(`🔍 Polling Kie.ai status for task: ${taskId}`);

    const statusResponse = await fetch(`${kieApiUrl}/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Kie.ai status check failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to check task status', details: errorText },
        { status: statusResponse.status }
      );
    }

    const statusData = await statusResponse.json();
    console.log('Kie.ai task status:', JSON.stringify(statusData, null, 2));

    // Handle different status formats
    if (statusData.code === 200 && statusData.data) {
      const taskData = statusData.data;

      // Check if task is completed
      if (taskData.status === 'completed' || taskData.status === 'success') {
        // Extract video URL
        let videoUrl = null;
        if (taskData.videoUrl) videoUrl = taskData.videoUrl;
        else if (taskData.url) videoUrl = taskData.url;
        else if (taskData.video_url) videoUrl = taskData.video_url;
        else if (taskData.result && taskData.result.videoUrl) videoUrl = taskData.result.videoUrl;

        if (videoUrl) {
          return NextResponse.json({
            ready: true,
            videoUrl: videoUrl,
            status: 'completed',
            taskId: taskId
          });
        }
      }

      // Task still processing
      if (taskData.status === 'processing' || taskData.status === 'pending') {
        return NextResponse.json({
          ready: false,
          status: taskData.status || 'processing',
          message: 'Video generation in progress'
        });
      }

      // Task failed
      if (taskData.status === 'failed' || taskData.status === 'error') {
        return NextResponse.json({
          ready: false,
          status: 'failed',
          error: taskData.error || taskData.message || 'Video generation failed'
        });
      }
    }

    // Default response for unknown status
    return NextResponse.json({
      ready: false,
      status: 'unknown',
      message: 'Unable to determine task status'
    });

  } catch (error) {
    console.error('Poll Kie task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

