import { NextRequest, NextResponse } from 'next/server';
import { getCallbackResult, getCacheStats, storeCallbackResult } from '@/lib/imageCallbackCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') || 'kie'; // Default to kie for backward compatibility
    const forceComplete = searchParams.get('forceComplete') === 'true'; // Emergency manual completion
    const debug = searchParams.get('debug') === 'true'; // Debug mode

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Emergency manual completion for stuck tasks
    if (forceComplete) {
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

    // Check cache first (for Kie.ai callbacks) - but always verify with API
    console.log(`🔍 Checking callback cache for task: ${taskId}`);
    const cachedResult = getCallbackResult(taskId);

    // Always try to get fresh data from Kie.ai API, but use cache as hint
    console.log('🔄 Always fetching fresh data from Kie.ai API...');

    // --- GOLDEN ENDPOINT STRATEGY: Use User Record Page ---
    // Instead of broken task status, get recent task history
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    console.log(`📸 Using Golden Endpoint for task ${taskId}`);

    const historyResponse = await fetch('https://api.kie.ai/client/v1/userRecord/gpt4o-image/page', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pageNum: 1,
        pageSize: 20 // Check last 20 images
      })
    });

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      console.log('✅ Golden Endpoint response:', JSON.stringify(historyData, null, 2));

      const records = historyData.data?.records || [];

      // Find our specific task in the history
      const targetRecord = records.find((r: any) => r.taskId === taskId);

      if (targetRecord) {
        console.log(`🎯 Found task in history: Status ${targetRecord.successFlag}`);

        // Parse the resultJson string (double-encoded JSON)
        let foundImageUrl = null;

        if (targetRecord.successFlag === 1 && targetRecord.resultJson) {
          try {
            console.log('📦 Raw resultJson:', targetRecord.resultJson);
            const parsedResult = JSON.parse(targetRecord.resultJson);
            console.log('📦 Parsed resultJson:', JSON.stringify(parsedResult, null, 2));

            // Extract URL from parsed object
            if (parsedResult.data?.result_urls && Array.isArray(parsedResult.data.result_urls) && parsedResult.data.result_urls.length > 0) {
              foundImageUrl = parsedResult.data.result_urls[0];
              console.log('✅ Extracted image URL from resultJson:', foundImageUrl);
            }
          } catch (parseError) {
            console.error('❌ Error parsing resultJson:', parseError);
          }
        }

        // Return appropriate response based on status
        if (targetRecord.successFlag === 1 && foundImageUrl) {
          return NextResponse.json({
            code: 200,
            msg: 'success',
            imageUrl: foundImageUrl,
            status: 'completed',
            data: {
              taskId,
              resultUrls: [foundImageUrl],
              successFlag: 1,
              status: 'SUCCESS',
              source: 'golden-endpoint',
              cacheHit: false
            }
          });
        } else if (targetRecord.successFlag === 2) {
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
              error: 'Generation failed',
              source: 'golden-endpoint',
              cacheHit: false
            }
          });
        }
      }

      // Task not found in recent history yet
      console.log('⏳ Task not found in recent history, will retry...');
    } else {
      console.error('❌ Golden Endpoint failed:', historyResponse.status);
    }

    // If Golden Endpoint fails or task not found, return processing status
    return NextResponse.json({
      code: 200,
      msg: 'processing',
      imageUrl: null,
      status: 'processing',
      data: {
        taskId,
        resultUrls: null,
        successFlag: 0,
        status: 'PROCESSING',
        source: 'golden-endpoint-processing',
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
