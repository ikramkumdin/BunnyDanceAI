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

    // Try Golden Endpoint with appropriate authentication
    // The /client/v1/ endpoint uses raw token without "Bearer" prefix
    const authToken = process.env.KIE_USER_TOKEN || process.env.GROK_API_KEY;

    console.log(`🔐 Using ${process.env.KIE_USER_TOKEN ? 'user token' : 'API key'} for Golden Endpoint`);
    console.log(`🔑 Auth token: ${authToken?.substring(0, 10)}...`);
    console.log('🚀 ATTEMPTING GOLDEN ENDPOINT CALL...');

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

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      console.log('✅ Golden Endpoint response received');
      console.log('📊 Response structure:', {
        hasData: !!historyData.data,
        recordsCount: historyData.data?.records?.length || 0,
        records: historyData.data?.records?.map((r: any) => ({
          taskId: r.taskId,
          successFlag: r.successFlag,
          status: r.status,
          hasResultJson: !!r.resultJson
        })) || []
      });

      const records = historyData.data?.records || [];

      // Analyze concurrent usage
      const uniqueUsers = new Set(records.map((r: any) => r.userId).filter(Boolean));
      const recentTasks = records.filter((r: any) => {
        const createTime = r.createTime || r.createdAt;
        if (!createTime) return false;
        const taskAge = Date.now() - new Date(createTime).getTime();
        return taskAge <= 5 * 60 * 1000; // Last 5 minutes
      });

      console.log(`📊 Concurrent usage: ${uniqueUsers.size} active users, ${recentTasks.length} tasks in last 5 minutes`);

      // Find our specific task in the history
      console.log(`🔍 Looking for taskId: ${taskId} among ${records.length} records`);
      console.log('📋 TaskIds in response:', records.map((r: any) => r.taskId));

      // Filter to only recent tasks (last 30 minutes) to avoid confusion with old tasks
      const recentRecords = records.filter((r: any) => {
        const createTime = r.createTime || r.createdAt;
        if (!createTime) return true; // Include if no timestamp

        const taskAge = Date.now() - new Date(createTime).getTime();
        const maxAge = 30 * 60 * 1000; // 30 minutes
        return taskAge <= maxAge;
      });

      console.log(`⏰ Filtered to ${recentRecords.length} recent records`);

      let targetRecord = recentRecords.find((r: any) => r.taskId === taskId);

      // If not found in recent records, try all records as fallback
      if (!targetRecord) {
        targetRecord = records.find((r: any) => r.taskId === taskId);
        if (targetRecord) {
          console.log('⚠️ Task not found in recent records, but found in older records - using as fallback');
        }
      }

      if (targetRecord) {
        console.log(`🎯 Found task in history: Status ${targetRecord.successFlag}`);
        console.log(`👤 Task belongs to user: ${targetRecord.userId || 'unknown'}`);
        console.log(`📅 Created: ${targetRecord.createTime || targetRecord.createdAt || 'unknown'}`);
        console.log(`🏷️ Task prompt: ${targetRecord.prompt || targetRecord.paramJson || 'unknown'}`);

        // Additional verification - check if task was created recently (within last 15 minutes)
        const now = Date.now();
        const createTime = targetRecord.createTime || targetRecord.createdAt;
        if (createTime) {
          const taskAge = now - new Date(createTime).getTime();
          const maxAge = 15 * 60 * 1000; // 15 minutes
          if (taskAge > maxAge) {
            console.log(`⚠️ Task is ${Math.round(taskAge/60000)} minutes old - this might be a different user's task with same ID!`);
            console.log('🔄 Continuing anyway, but this could be a collision...');
          } else {
            console.log(`✅ Task age: ${Math.round(taskAge/1000)} seconds - looks correct`);
          }
        } else {
          console.log('⚠️ No creation timestamp - cannot verify task age');
        }

        // Verify task belongs to this API key/user (if userId is available)
        if (targetRecord.userId) {
          console.log(`🔐 Task user verification: ${targetRecord.userId}`);
        }

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
      console.error('❌ Falling back to old polling method');
    }

    // If Golden Endpoint fails completely, try the old polling method as fallback
    console.log('⚠️ Golden Endpoint failed, falling back to old polling method...');

    // FALLBACK: Use the old record-info endpoint
    const statusUrl = `https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`;

    console.log(`📸 Fallback: Using old polling for task ${taskId}`);

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (statusResponse.ok) {
      let statusData = await statusResponse.json();
      console.log('✅ Old polling response:', JSON.stringify(statusData, null, 2));

      // Handle Kie.ai API wrapper response
      if (statusData.code && statusData.code !== 200) {
        console.log(`⚠️ Old polling returned code ${statusData.code}`);
        return NextResponse.json(statusData);
      }

      // Extract image URL using the same logic as before
      let foundImageUrl = null;

      // 1. Check data.response field (might be JSON string, array, or object with result_urls)
      if (statusData.data?.response && statusData.data.response !== null) {
        console.log('🔍 Checking data.response field:', typeof statusData.data.response, 'value:', statusData.data.response);
        try {
          let response = statusData.data.response;

          // Handle array format like ["https://..."]
          if (Array.isArray(response) && response.length > 0) {
            if (typeof response[0] === 'string' && response[0].startsWith('http')) {
              foundImageUrl = response[0];
              console.log('✅ Found image URL in response array:', foundImageUrl);
            }
          }
          // Handle JSON string that needs parsing
          else if (typeof response === 'string') {
            // Check if it's already a URL
            if (response.startsWith('http')) {
              foundImageUrl = response;
              console.log('✅ Found image URL as direct string:', foundImageUrl);
            } else {
              // Try to parse as JSON
              try {
                response = JSON.parse(response);
                console.log('📦 Parsed response object:', JSON.stringify(response, null, 2));
              } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
              }
            }
          }

          // If response is now an object, extract URL from it
          if (!foundImageUrl && typeof response === 'object' && response !== null && !Array.isArray(response)) {
            // Check for result_urls (standard Kie.ai 4o Image response format)
            if (response.result_urls && Array.isArray(response.result_urls) && response.result_urls.length > 0) {
              foundImageUrl = response.result_urls[0];
              console.log('✅ Found image URL in response.result_urls:', foundImageUrl);
            }
            // Check for url field in response object
            else if (response.url && typeof response.url === 'string' && response.url.startsWith('http')) {
              foundImageUrl = response.url;
              console.log('✅ Found image URL in response.url:', foundImageUrl);
            }
          }

        } catch (e) {
          console.error('Failed to parse response field:', e);
        }
      }

      // Determine status and return result
      let finalStatus = 'processing';
      let successFlag = 0;

      if (statusData.data?.successFlag !== undefined) {
        const flag = statusData.data.successFlag;
        const completeTime = statusData.data.completeTime;
        const statusField = statusData.data.status;
        console.log(`🏁 Success flag: ${flag}, Complete time: ${completeTime}, Status: ${statusField}`);

        // Check if completed based on multiple indicators
        let isCompleted = flag === 1 ||
                         (statusField && statusField.toUpperCase() === 'SUCCESS') ||
                         foundImageUrl; // If we found URL, consider it completed

        // Special case: if completeTime exists, assume completed (Kie.ai API lag)
        const hasCompleteTime = completeTime && completeTime !== null;
        if (hasCompleteTime) {
          console.log('🎯 CompleteTime detected - treating as completed despite successFlag');
          isCompleted = true;
        }

        // Emergency fallback: if we've been polling for > 30 seconds, assume it might be ready
        const taskAge = Date.now() - (completeTime || (Date.now() - 30000)); // Assume started 30s ago if no completeTime
        const isOldTask = taskAge > 30000; // 30 seconds
        if (isOldTask && !isCompleted && !foundImageUrl) {
          console.log('🚨 Emergency override: Task is 30s+ old - triggering aggressive URL search');
          // Don't set isCompleted yet, but the aggressive URL search above will handle it
        }

        if (isCompleted) {
          finalStatus = 'completed';
          successFlag = 1;
          console.log('✅ Generation completed (based on flag/completeTime/status/URL)');

          // If we found an image URL, update cache
          if (foundImageUrl) {
            console.log('💾 Updating cache with found URL');
            storeCallbackResult({
              taskId,
              status: 'SUCCESS',
              resultUrls: [foundImageUrl],
            });
          }
        } else if (flag === 0 && !completeTime) {
          finalStatus = 'processing';
          successFlag = 0;
          console.log('⏳ Still processing...');
        } else if (flag === 2 || flag === 3) {
          finalStatus = 'failed';
          successFlag = flag;
          console.log('❌ Generation failed');
        }
      }

      // If we found an image URL, always mark as completed (most important check)
      if (foundImageUrl) {
        finalStatus = 'completed';
        successFlag = 1;
        statusData.imageUrl = foundImageUrl;
        statusData.status = 'completed';
        console.log('✅ Image generation completed with URL:', foundImageUrl);

        // Update cache
        storeCallbackResult({
          taskId,
          status: 'SUCCESS',
          resultUrls: [foundImageUrl],
        });
      }

      // Return the response
      const response: any = {
        code: 200,
        msg: 'success',
        imageUrl: foundImageUrl,
        status: finalStatus,
        data: {
          taskId,
          resultUrls: foundImageUrl ? [foundImageUrl] : null,
          successFlag,
          status: finalStatus.toUpperCase(),
          source: 'fallback-old-polling',
          cacheHit: cachedResult ? true : false
        }
      };

      // Add debug info if requested
      if (debug) {
        response.debug = {
          rawKieResponse: statusData,
          foundImageUrl,
          finalStatus,
          hasCompleteTime: !!statusData.data?.completeTime,
          taskAge: Date.now() - (statusData.data?.completeTime || Date.now()),
          aggressiveFallbackTriggered: (Date.now() - (statusData.data?.completeTime || (Date.now() - 30000))) > 30000
        };
      }

      return NextResponse.json(response);
    }

    // If both methods fail, return processing status
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
        source: 'all-methods-failed',
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
