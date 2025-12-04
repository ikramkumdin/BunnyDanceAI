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
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Try different possible endpoints for task status
    const kieApiUrl = process.env.GROK_API_URL || 'https://api.kie.ai/api/v1/veo/generate';
    const baseUrl = kieApiUrl.replace('/api/v1/veo/generate', '');
    
    // Try common task status endpoints
    const possibleEndpoints = [
      `${baseUrl}/api/v1/veo/task/${taskId}`,
      `${baseUrl}/api/v1/veo/status/${taskId}`,
      `${baseUrl}/api/v1/task/${taskId}`,
      `${baseUrl}/api/v1/veo/generate/${taskId}`,
      `${baseUrl}/api/v1/veo/result/${taskId}`,
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

