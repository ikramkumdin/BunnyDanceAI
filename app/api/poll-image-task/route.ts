import { NextRequest, NextResponse } from 'next/server';
import { getCallbackResult, getCacheStats, storeCallbackResult } from '@/lib/imageCallbackCache';

// Helper to ensure Bearer token is correctly formatted
function formatAuthToken(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') || 'kie'; // Default to kie for backward compatibility
    const forceComplete = searchParams.get('forceComplete') === 'true'; // Emergency manual completion
    const debug = searchParams.get('debug') === 'true'; // Debug mode
    const manualUrl = searchParams.get('manualUrl'); // Added manualUrl parameter

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // If a manual URL is provided, use it directly (bypassing Kie.ai APIs)
    if (manualUrl) {
      console.log(`🔧 Manual URL provided: ${manualUrl}`);
      // Optionally, you might want to add a check here to verify the URL's accessibility

      storeCallbackResult({
        taskId: taskId || 'manual_task', // Use provided taskId or a generic one
        status: 'SUCCESS',
        resultUrls: [manualUrl],
      });

      return NextResponse.json({
        code: 200,
        msg: 'success',
        imageUrl: manualUrl,
        status: 'completed',
        data: {
          taskId: taskId || 'manual_task',
          resultUrls: [manualUrl],
          successFlag: 1,
          status: 'SUCCESS',
          source: 'manual-url-injection',
          cacheHit: false
        }
      });
    }

  // Emergency manual completion for stuck tasks
  if (forceComplete) {
    console.log(`🚨 EMERGENCY: Force completing task ${taskId}`);
      console.log(`🚨 EMERGENCY: Force completing task ${taskId}`);

      // Try to fetch the URL directly
      try {
        const fetchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-kie-image?taskId=${taskId}`);
        if (fetchResponse.ok) {
          const fetchData = await fetchResponse.json();
          if (fetchData.success && fetchData.imageUrl) {
            console.log('✅ Force completion successful:', fetchData.imageUrl);

            // Update cache
            storeCallbackResult({
              taskId,
              status: 'SUCCESS',
              resultUrls: [fetchData.imageUrl],
            });

            return NextResponse.json({
              code: 200,
              msg: 'success',
              imageUrl: fetchData.imageUrl,
              status: 'completed',
              data: {
                taskId,
                resultUrls: [fetchData.imageUrl],
                successFlag: 1,
                status: 'SUCCESS',
                source: 'force-complete',
                cacheHit: false
              }
            });
          }
        }
      } catch (error) {
        console.error('❌ Force completion failed:', error);
      }

      return NextResponse.json(
        { error: 'Force completion failed - could not fetch image URL' },
        { status: 500 }
      );
    }

    // Check callback cache first
    console.log(`🔍 Checking callback cache for task: ${taskId}`);
    const cachedResult = getCallbackResult(taskId);

    if (cachedResult) {
      console.log(`✅ Found cached result for task ${taskId}:`, JSON.stringify(cachedResult));
      return NextResponse.json({
        code: 200,
        msg: 'success',
        imageUrl: cachedResult.resultUrls && cachedResult.resultUrls.length > 0 ? cachedResult.resultUrls[0] : null,
        status: cachedResult.status === 'SUCCESS' ? 'completed' : 'processing',
        data: {
          taskId,
          resultUrls: cachedResult.resultUrls,
          successFlag: cachedResult.status === 'SUCCESS' ? 1 : 0,
          status: cachedResult.status,
          source: 'callback-cache',
          cacheHit: true
        }
      });
    }

    // --- NEW STRATEGY: Poll the official /api/v1/jobs/recordInfo Endpoint ---
    console.log(`🚀 Polling official Kie.ai recordInfo endpoint for task ${taskId}`);

    const MAX_RETRIES = 60; // Up to 5 minutes (5s interval * 60 attempts)
    const POLL_INTERVAL = 5000; // 5 seconds
    let attempts = 0;

    const authToken = process.env.GROK_API_KEY; // Use Kie.ai API Key
    if (!authToken) {
      return NextResponse.json(
        { error: 'No Kie.ai API key available (GROK_API_KEY)' },
        { status: 500 }
      );
    }

    while (attempts < MAX_RETRIES) {
      try {
        console.log(`[Polling] Checking recordInfo for task ${taskId}... Attempt ${attempts + 1}`);

        const response = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
          headers: {
            'Authorization': formatAuthToken(authToken),
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`[Polling] API Error: ${response.status} - ${await response.text()}`);
          // For API errors, we might want to retry, but not for 401/404 if it's persistent
          if (response.status === 401 || response.status === 404) {
            return NextResponse.json(
              { status: 'FAILED', error: `Kie.ai API Error: ${response.status} - ${response.statusText}` },
              { status: 200 } // Return 200 to indicate our server processed the error
            );
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          attempts++;
          continue;
        }

        const result = await response.json();
        console.log(`[Polling] Raw recordInfo response for task ${taskId}:`, JSON.stringify(result, null, 2));

        if (result.code !== 200) {
          console.error(`[Polling] Kie.ai returned error code: ${result.code}, message: ${result.message}`);
          return NextResponse.json(
            { status: 'FAILED', error: `Kie.ai Error: ${result.message || 'Unknown error'}` },
            { status: 200 }
          );
        }

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
                parsedResponse = JSON.parse(dataResponse);
              }
              if (parsedResponse.resultUrls && parsedResponse.resultUrls.length > 0) {
                finalUrl = parsedResponse.resultUrls[0];
              }
            }
          } catch (parseError) {
            console.error("[Polling] Error parsing resultJson or response string:", parseError);
          }

          if (finalUrl) {
            // Store successful result in cache
            storeCallbackResult({
              taskId,
              status: 'SUCCESS',
              resultUrls: [finalUrl],
            });

            return NextResponse.json({
              code: 200,
              msg: 'success',
              imageUrl: finalUrl,
              status: 'completed',
              data: {
                taskId,
                resultUrls: [finalUrl],
                successFlag: 1,
                status: 'SUCCESS',
                source: 'official-api-polling',
                cacheHit: false
              }
            });
          }
        } else if (state === 'fail') {
          console.error(`[Polling] Task ${taskId} failed: ${failMsg}`);
          return NextResponse.json({
            code: 200,
            msg: 'failed',
            imageUrl: null,
            status: 'failed',
            data: {
              taskId,
              resultUrls: null,
              successFlag: 2,
              status: 'FAILED',
              error: failMsg || 'Generation failed',
              source: 'official-api-failed',
              cacheHit: false
            }
          });
        }

      } catch (error) {
        console.error(`[Polling] Network error during polling for task ${taskId}:`, error);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      attempts++;
    }

    // If loop finishes, it means timeout
    console.log(`[Polling] Task ${taskId} timed out after ${MAX_RETRIES} attempts.`);
    return NextResponse.json({
      code: 200,
      msg: 'timeout',
      imageUrl: null,
      status: 'timeout',
      data: {
        taskId,
        resultUrls: null,
        successFlag: 0,
        status: 'TIMEOUT',
        error: 'Polling timed out',
        source: 'official-api-timeout',
        cacheHit: false
      }
    });
  } catch (error) {
    console.error('Poll image task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
