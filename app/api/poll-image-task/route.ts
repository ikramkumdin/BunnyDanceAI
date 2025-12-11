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

    // --- ONLY GOLDEN ENDPOINT: No polling, no fallbacks ---
    console.log(`🔍 Checking callback cache for task: ${taskId}`);
    const cachedResult = getCallbackResult(taskId);

    console.log(`📸 ONLY USING GOLDEN ENDPOINT for task ${taskId}`);

    // Check for required authentication
    const authToken = process.env.KIE_USER_TOKEN || process.env.GROK_API_KEY;
    if (!authToken) {
      return NextResponse.json(
        { error: 'No authentication token available (KIE_USER_TOKEN or GROK_API_KEY)' },
        { status: 500 }
      );
    }

    console.log(`🔐 Using ${process.env.KIE_USER_TOKEN ? 'user token' : 'API key'} for Golden Endpoint`);
    console.log(`🔑 Auth token: ${authToken?.substring(0, 10)}...`);
    console.log('🚀 CALLING GOLDEN ENDPOINT...');

    try {
      const historyResponse = await fetch('https://api.kie.ai/client/v1/userRecord/gpt4o-image/page', {
        method: 'POST',
        headers: {
          'Authorization': authToken, // Raw token without "Bearer" prefix
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://kie.ai',
          'Referer': 'https://kie.ai/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
        },
        body: JSON.stringify({
          pageNum: 1,
          pageSize: 20 // Check last 20 images
        })
      });

      console.log(`📡 Golden Endpoint response status: ${historyResponse.status}`);

      if (!historyResponse.ok) {
        const errorText = await historyResponse.text();
        console.error('❌ Golden Endpoint failed:', historyResponse.status, errorText);
        return NextResponse.json({
          code: 500,
          msg: 'Golden Endpoint failed',
          imageUrl: null,
          status: 'error',
          data: {
            taskId,
            resultUrls: null,
            successFlag: 0,
            status: 'ERROR',
            error: `HTTP ${historyResponse.status}: ${errorText}`,
            source: 'golden-endpoint-error',
            cacheHit: false
          }
        });
      }

      const historyData = await historyResponse.json();
      console.log('✅ Golden Endpoint response received');
      console.log('📊 Full response:', JSON.stringify(historyData, null, 2));

      const records = historyData.data?.records || [];
      console.log(`📊 Found ${records.length} records in history`);

      // Find our specific task
      const targetRecord = records.find((r: any) => r.taskId === taskId);

      if (!targetRecord) {
        console.log(`❌ Task ${taskId} not found in history`);
        return NextResponse.json({
          code: 200,
          msg: 'Task not found in history yet',
          imageUrl: null,
          status: 'processing',
          data: {
            taskId,
            resultUrls: null,
            successFlag: 0,
            status: 'PROCESSING',
            source: 'golden-endpoint-not-found',
            cacheHit: false
          }
        });
      }

      console.log(`🎯 Found task: Status ${targetRecord.successFlag}, hasResultJson: ${!!targetRecord.resultJson}`);

      // Parse resultJson for successful tasks
      if (targetRecord.successFlag === 1 && targetRecord.resultJson) {
        try {
          console.log('📦 Raw resultJson:', targetRecord.resultJson);
          const parsedResult = JSON.parse(targetRecord.resultJson);
          console.log('📦 Parsed resultJson:', JSON.stringify(parsedResult, null, 2));

          if (parsedResult.data?.result_urls && Array.isArray(parsedResult.data.result_urls) && parsedResult.data.result_urls.length > 0) {
            const imageUrl = parsedResult.data.result_urls[0];
            console.log('✅ SUCCESS! Found image URL:', imageUrl);

            // Update cache for future reference
            storeCallbackResult({
              taskId,
              status: 'SUCCESS',
              resultUrls: [imageUrl],
            });

            return NextResponse.json({
              code: 200,
              msg: 'success',
              imageUrl: imageUrl,
              status: 'completed',
              data: {
                taskId,
                resultUrls: [imageUrl],
                successFlag: 1,
                status: 'SUCCESS',
                source: 'golden-endpoint-success',
                cacheHit: false
              }
            });
          }
        } catch (parseError) {
          console.error('❌ Error parsing resultJson:', parseError);
        }
      }

      // Handle failed tasks
      if (targetRecord.successFlag === 2) {
        return NextResponse.json({
          code: 200,
          msg: 'Generation failed',
          imageUrl: null,
          status: 'failed',
          data: {
            taskId,
            resultUrls: null,
            successFlag: 2,
            status: 'FAILED',
            error: 'Image generation failed',
            source: 'golden-endpoint-failed',
            cacheHit: false
          }
        });
      }

      // Task found but not complete yet
      return NextResponse.json({
        code: 200,
        msg: 'Task found but not complete yet',
        imageUrl: null,
        status: 'processing',
        data: {
          taskId,
          resultUrls: null,
          successFlag: targetRecord.successFlag || 0,
          status: 'PROCESSING',
          source: 'golden-endpoint-pending',
          cacheHit: false
        }
      });

    } catch (error) {
      console.error('❌ Golden Endpoint network error:', error);
      return NextResponse.json({
        code: 500,
        msg: 'Network error',
        imageUrl: null,
        status: 'error',
        data: {
          taskId,
          resultUrls: null,
          successFlag: 0,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown network error',
          source: 'golden-endpoint-network-error',
          cacheHit: false
        }
      });
    }
  } catch (error) {
    console.error('Poll image task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
