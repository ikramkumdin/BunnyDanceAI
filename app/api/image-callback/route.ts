import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This endpoint receives callbacks from Kie.ai when image generation completes
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    console.log('🔔 Received Kie.ai image callback:', JSON.stringify(data, null, 2));

    // Kie.ai callback format (from their docs):
    // {
    //   "taskId": "xxx",
    //   "status": "SUCCESS" or "GENERATE_FAILED",
    //   "result_urls": ["https://..."] or null,
    //   "error": "error message" or null
    // }

    // Store the result temporarily (you could use a database, Redis, or in-memory cache)
    // For now, we'll just log it and acknowledge receipt
    
    const taskId = data.taskId || data.task_id;
    const status = data.status;
    const resultUrls = data.result_urls || data.resultUrls;
    
    console.log('📋 Task ID:', taskId);
    console.log('📋 Status:', status);
    console.log('📋 Result URLs:', resultUrls);

    // TODO: Store this in a database or cache so the frontend can retrieve it
    // For now, the frontend will still need to poll, but the data will be ready
    
    // Acknowledge receipt to Kie.ai
    return NextResponse.json({
      success: true,
      message: 'Callback received and processed',
      taskId: taskId
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error processing Kie.ai callback:', error);
    
    // Still return 200 to avoid Kie.ai retrying
    return NextResponse.json({
      success: false,
      error: 'Failed to process callback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 });
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Kie.ai image callback endpoint is active',
    note: 'This endpoint receives POST requests from Kie.ai when images are ready'
  });
}

