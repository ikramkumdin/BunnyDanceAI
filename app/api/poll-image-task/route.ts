import { NextRequest, NextResponse } from 'next/server';
import { formatAuthToken } from '@/utils/auth';
import { getCallbackResult, storeCallbackResult, ImageCallbackResult } from '@/lib/imageCallbackCache';
import { MAX_RETRIES, POLL_INTERVAL_MS } from '@/config/polling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This endpoint is polled by the frontend to get image generation status from Kie.ai
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const provider = searchParams.get('provider');
  const manualUrl = searchParams.get('manualUrl'); // For debugging/manual override
  const forceComplete = searchParams.get('forceComplete') === 'true'; // For debugging

  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
  }

  // 1. Check in-memory cache first (from Kie.ai callback)
  const cachedResult = getCallbackResult(taskId);
  if (cachedResult) {
    console.log(`[Polling] Task ${taskId} found in cache. Status: ${cachedResult.status}`);
    return NextResponse.json({
      status: cachedResult.status,
      imageUrl: cachedResult.resultUrls ? cachedResult.resultUrls[0] : null,
      taskId: taskId,
      source: 'cache',
      error: cachedResult.error
    });
  }

  // For debugging: manually complete a task
  if (forceComplete && manualUrl) {
    console.warn(`[Polling] FORCING task ${taskId} to complete with URL: ${manualUrl}`);
    storeCallbackResult({
      taskId,
      status: 'SUCCESS',
      resultUrls: [manualUrl]
    });
    return NextResponse.json({
      status: 'SUCCESS',
      imageUrl: manualUrl,
      taskId: taskId,
      source: 'manual_force_complete'
    });
  }

  const kieApiKey = process.env.KIE_API_KEY;
  if (!kieApiKey) {
    console.error('KIE_API_KEY is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // 2. Poll Kie.ai's official record-info endpoint for GPT4o-image tasks
  try {
    const kieAuthToken = formatAuthToken(kieApiKey);

    console.log(`[Polling] Checking recordInfo for task ${taskId}...`);
    const response = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': kieAuthToken,
        'Content-Type': 'application/json',
      },
    });

    // Check for non-OK responses from Kie.ai
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Polling] Kie.ai record-info API error for task ${taskId}: ${response.status} - ${errorText}`);
      return NextResponse.json({
        status: 'FAILED',
        error: `Kie.ai API error: ${response.status} - ${errorText}`,
        statusCode: response.status
      }, { status: response.status });
    }

    const result = await response.json();
    console.log(`[Polling] Raw recordInfo response for task ${taskId}:`, JSON.stringify(result, null, 2));

    const { status: state, resultJson, failMsg, response: dataResponse } = result.data;
    console.log(`[Polling] Task ${taskId} state: ${state}, resultJson: ${resultJson ? 'exists' : 'null'}, response: ${dataResponse ? 'exists' : 'null'}`);

    if (state === 'success') {
      let finalUrl = null;
      try {
        if (resultJson) {
          const parsedResult = JSON.parse(resultJson);
          if (parsedResult.resultUrls && parsedResult.resultUrls.length > 0) {
            finalUrl = parsedResult.resultUrls[0];
          }
        } else if (dataResponse) { // Check dataResponse if resultJson is null
          let parsedResponse = dataResponse;
          if (typeof dataResponse === 'string') {
            parsedResponse = JSON.parse(parsedResponse);
          }
          if (parsedResponse.resultUrls && parsedResponse.resultUrls.length > 0) {
            finalUrl = parsedResponse.resultUrls[0];
          }
        }
      } catch (parseError) {
        console.error("[Polling] Error parsing resultJson or response string:", parseError);
      }

      if (finalUrl) {
        // Store in cache if successful, so future polls can get it faster
        storeCallbackResult({
          taskId,
          status: 'SUCCESS',
          resultUrls: [finalUrl]
        });
        return NextResponse.json({ status: 'COMPLETED', successFlag: 1, imageUrl: finalUrl, taskId: taskId, source: 'polling' });
      } else {
        console.log(`[Polling] Task ${taskId} is 'success' but no finalUrl found in resultJson or response.`);
        // Even if 'success', if no URL, treat as still processing or failed to retrieve URL
        return NextResponse.json({ status: 'PROCESSING', successFlag: 0, taskId: taskId, error: 'URL not found in successful response' });
      }
    } else if (state === 'fail') {
      console.error(`[Polling] Task ${taskId} FAILED: ${failMsg}`);
      // Store in cache if failed
      storeCallbackResult({
        taskId,
        status: 'FAILED',
        error: failMsg
      });
      return NextResponse.json({ status: 'FAILED', error: failMsg, taskId: taskId });
    } else {
      // Task is still 'waiting', 'queuing', or 'generating'
      console.log(`[Polling] Task ${taskId} still processing (state: ${state}).`);
      return NextResponse.json({ status: 'PROCESSING', taskId: taskId });
    }
  } catch (error) {
    console.error(`[Polling] Network or unexpected error for task ${taskId}:`, error);
    return NextResponse.json({
      status: 'FAILED',
      error: `Internal server error during polling: ${error instanceof Error ? error.message : 'Unknown error'}`,
      statusCode: 500
    }, { status: 500 });
  }
}
