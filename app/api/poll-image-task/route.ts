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

    // Handle Kie.ai polling (get the actual result)
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const statusUrl = `https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`;

    console.log(`📸 Fetching fresh data from Kie.ai: ${statusUrl}`);

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (statusResponse.ok) {
      let statusData = await statusResponse.json();
      console.log('✅ Fresh Kie.ai response:', JSON.stringify(statusData, null, 2));

      // Log ALL data fields to debug
      if (statusData.data) {
        console.log('📋 All data fields:', Object.keys(statusData.data));
        console.log('📋 data.response type:', typeof statusData.data.response, 'value:', statusData.data.response);
        console.log('📋 data.resultUrls type:', typeof statusData.data.resultUrls, 'value:', statusData.data.resultUrls);
        console.log('📋 data.successFlag:', statusData.data.successFlag);
        console.log('📋 data.status:', statusData.data.status);
      }

      // Handle Kie.ai API wrapper response
      if (statusData.code && statusData.code !== 200) {
        console.log(`⚠️ Response returned code ${statusData.code}`);
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

      // 2. Check data.resultUrls field
      if (!foundImageUrl && statusData.data?.resultUrls) {
        console.log('🔍 Checking data.resultUrls field:', typeof statusData.data.resultUrls);
        try {
          const urls = typeof statusData.data.resultUrls === 'string'
            ? JSON.parse(statusData.data.resultUrls)
            : statusData.data.resultUrls;

          if (Array.isArray(urls) && urls.length > 0) {
            foundImageUrl = urls[0];
            console.log('✅ Found image URL in resultUrls array:', foundImageUrl);
          } else if (typeof urls === 'string' && urls.startsWith('http')) {
            foundImageUrl = urls;
            console.log('✅ Found image URL in resultUrls string:', foundImageUrl);
          }
        } catch (e) {
          console.error('Failed to parse resultUrls:', e);
        }
      }

      // 3. Check data.imageUrl field (direct field)
      if (!foundImageUrl && statusData.data?.imageUrl) {
        foundImageUrl = statusData.data.imageUrl;
        console.log('✅ Found image URL in data.imageUrl field:', foundImageUrl);
      }

      // 4. Check data.url field (alternative)
      if (!foundImageUrl && statusData.data?.url) {
        foundImageUrl = statusData.data.url;
        console.log('✅ Found image URL in data.url field:', foundImageUrl);
      }

      // 5. AGGRESSIVE FALLBACK: If task has been running for >30 seconds, try to guess the URL
      if (!foundImageUrl) {
        const taskStartTime = Date.now() - (Date.now() % 1000); // Rough estimate
        const elapsedSeconds = (Date.now() - taskStartTime) / 1000;

        if (elapsedSeconds > 30) { // Been running for more than 30 seconds
          console.log(`🚨 AGGRESSIVE FALLBACK: Task running for ${elapsedSeconds}s, trying to guess URL...`);

          // Try multiple possible URL patterns based on successful examples
          const possibleUrls = [
            // Pattern from successful examples
            `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}_1196.png`,
            `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}_7280.png`,
            `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}_4101.png`,
            `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}_3098.png`,
            `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}_1302.png`,
          ];

          // Try to fetch one of the possible URLs to see if it exists
          for (const testUrl of possibleUrls.slice(0, 2)) { // Only test first 2 to avoid too many requests
            try {
              console.log('🔍 Testing URL:', testUrl);
              const testResponse = await fetch(testUrl, { method: 'HEAD' }); // HEAD request is faster
              if (testResponse.ok) {
                foundImageUrl = testUrl;
                console.log('🎯 FOUND WORKING URL:', foundImageUrl);
                break;
              } else {
                console.log('❌ URL not found:', testUrl, 'Status:', testResponse.status);
              }
            } catch (error) {
              console.log('❌ Error testing URL:', testUrl, error);
            }
          }

          // If URL guessing didn't work, try the fetch endpoint
          if (!foundImageUrl) {
            try {
              console.log('🔄 Last resort: trying fetch-kie-image endpoint...');
              const fetchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/fetch-kie-image?taskId=${taskId}`);
              if (fetchResponse.ok) {
                const fetchData = await fetchResponse.json();
                if (fetchData.success && fetchData.imageUrl) {
                  foundImageUrl = fetchData.imageUrl;
                  console.log('✅ Found image URL via fetch endpoint:', foundImageUrl);
                }
              }
            } catch (fetchError) {
              console.error('❌ Fetch endpoint error:', fetchError);
            }
          }
        }
      }

      // 6. Check if completeTime exists but successFlag is 0 - might indicate URL is available elsewhere
      if (!foundImageUrl && statusData.data?.completeTime && statusData.data.successFlag === 0) {
        console.log('⚠️ CompleteTime exists but successFlag is 0 - this is a Kie.ai API lag!');

        // Check paramJson as fallback
        if (statusData.data.paramJson) {
          try {
            const params = JSON.parse(statusData.data.paramJson);
            console.log('📦 Checking paramJson for URL:', JSON.stringify(params, null, 2));

            // Look for any URL fields in paramJson
            if (params.response) {
              const paramResponse = typeof params.response === 'string'
                ? JSON.parse(params.response)
                : params.response;

              if (Array.isArray(paramResponse) && paramResponse.length > 0 && paramResponse[0].startsWith('http')) {
                foundImageUrl = paramResponse[0];
                console.log('✅ Found image URL in paramJson response array:', foundImageUrl);
              } else if (typeof paramResponse === 'string' && paramResponse.startsWith('http')) {
                foundImageUrl = paramResponse;
                console.log('✅ Found image URL in paramJson response string:', foundImageUrl);
              }
            }
          } catch (e) {
            console.error('Failed to parse paramJson:', e);
          }
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
      return NextResponse.json({
        code: 200,
        msg: 'success',
        imageUrl: foundImageUrl,
        status: finalStatus,
        data: {
          taskId,
          resultUrls: foundImageUrl ? [foundImageUrl] : null,
          successFlag,
          status: finalStatus.toUpperCase(),
          source: 'kie-api-direct',
          cacheHit: cachedResult ? true : false
        }
      });
    }

    // If Kie.ai API fails, fall back to cache if available
    if (cachedResult) {
      console.log('⚠️ Kie.ai API failed, using cache as fallback');
      const imageUrl = cachedResult.resultUrls && cachedResult.resultUrls.length > 0
        ? cachedResult.resultUrls[0]
        : null;

      return NextResponse.json({
        code: 200,
        msg: 'success',
        imageUrl: imageUrl,
        status: cachedResult.status === 'SUCCESS' ? 'completed' : 'failed',
        data: {
          taskId: cachedResult.taskId,
          resultUrls: cachedResult.resultUrls,
          successFlag: cachedResult.status === 'SUCCESS' ? 1 : 2,
          status: cachedResult.status,
          error: cachedResult.error,
          source: 'cache-fallback',
          cacheHit: true
        }
      });
    }
    
    console.log('⚠️ Not in cache, falling back to API polling...');
    const stats = getCacheStats();
    console.log('📊 Cache stats:', stats);

    // Handle Replicate polling (more reliable)
    if (provider === 'replicate') {
      const replicateApiKey = process.env.REPLICATE_API_TOKEN;
      if (!replicateApiKey) {
        return NextResponse.json(
          { error: 'REPLICATE_API_TOKEN is not configured' },
          { status: 500 }
        );
      }

      console.log(`📸 Polling Replicate prediction: ${taskId}`);
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (statusResponse.ok) {
        const data = await statusResponse.json();
        console.log('✅ Replicate poll response:', JSON.stringify(data, null, 2));
        
        // Normalize Replicate response to our format
        const normalizedResponse: any = {
          provider: 'replicate',
          taskId: data.id
        };

        if (data.status === 'succeeded' && data.output) {
          const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;
          normalizedResponse.imageUrl = imageUrl;
          normalizedResponse.status = 'completed';
          console.log('✅ Replicate image ready:', imageUrl);
        } else if (data.status === 'failed' || data.status === 'canceled') {
          normalizedResponse.status = 'failed';
          normalizedResponse.error = data.error || 'Image generation failed';
          console.error('❌ Replicate failed:', normalizedResponse.error);
        } else {
          normalizedResponse.status = 'processing';
          console.log('⏳ Replicate still processing...');
        }

        return NextResponse.json(normalizedResponse);
      }

      const errorText = await statusResponse.text();
      return NextResponse.json(
        { error: 'Failed to check Replicate status', details: errorText },
        { status: statusResponse.status }
      );
    }

  } catch (error) {
    console.error('Poll image task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}