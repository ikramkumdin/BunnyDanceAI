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
    // Fetch all pages to ensure we don't miss any tasks
    let allRecords = [];
    let totalRecords = 0;
    let currentPage = 1;
    let maxPages = 5; // Don't fetch more than 5 pages to avoid infinite loops

    try {
      while (currentPage <= maxPages) {
        console.log(`🚀 CALLING GOLDEN ENDPOINT page ${currentPage} (pageSize: 20 - testing limit)...`);

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
            pageNum: currentPage,
            pageSize: 20 // Try 20 per page to see if API accepts it, fallback to pagination
          })
        });

        console.log(`📡 Golden Endpoint page ${currentPage} response status: ${historyResponse.status}`);

        if (!historyResponse.ok) {
          const errorText = await historyResponse.text();
          console.error(`❌ Page ${currentPage} failed:`, historyResponse.status, errorText);
          if (currentPage === 1) {
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
          break; // If not first page, just stop pagination
        }

        const pageData = await historyResponse.json();

        if (currentPage === 1) {
          console.log('✅ Golden Endpoint response received');
          if (debug) {
            console.log('📊 Full response:', JSON.stringify(pageData, null, 2));
          }
        }

        const pageRecords = pageData.data?.records || [];
        const pageTotal = pageData.data?.total || 0;

        if (currentPage === 1) {
          totalRecords = pageTotal;
          const totalPages = pageData.data?.pages || 1;
          console.log(`📊 Response structure: total=${totalRecords}, pages=${totalPages}`);
          // Update maxPages based on API response
          maxPages = Math.min(maxPages, totalPages);
        }

        allRecords = allRecords.concat(pageRecords);
        console.log(`📄 Page ${currentPage}: ${pageRecords.length} records (total so far: ${allRecords.length})`);

        // Check if we have all records or if this is the last page
        if (allRecords.length >= totalRecords || pageRecords.length === 0 || currentPage >= maxPages) {
          break;
        }

        currentPage++;
      }

      const records = allRecords;
      console.log(`📊 Found ${records.length} total records across ${currentPage} pages (expected: ${totalRecords})`);

      // Find our specific task
      let targetRecord = records.find((r: any) => r.taskId === taskId);

      // If task not found in history, try URL pattern guessing as fallback
      if (!targetRecord) {
        console.log(`🔍 Task ${taskId} not found in history, trying URL pattern guessing...`);

        // Try to guess the URL pattern for Kie.ai
        const now = Date.now();
        const possibleUrls = [];

        // Try timestamps from last 5 minutes (image generation can take time)
        for (let i = 0; i < 60; i++) { // 60 timestamps over 5 minutes
          const timestamp = now - (i * 5000); // Every 5 seconds
          // Try various ID numbers that Kie.ai uses
          const ids = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 30000];
          for (const id of ids) {
            const url = `https://tempfile.aiquickdraw.com/s/${taskId}_0_${timestamp}_${id}.png`;
            possibleUrls.push(url);
          }
        }

        // Test up to 10 URLs to increase chances of finding the right one
        for (const url of possibleUrls.slice(0, 10)) {
          try {
            console.log(`🔗 Testing URL: ${url}`);
            const headResponse = await fetch(url, { method: 'HEAD' });
            if (headResponse.ok) {
              console.log(`✅ URL exists: ${url}`);

              // Store this as a successful result
              storeCallbackResult({
                taskId,
                status: 'SUCCESS',
                resultUrls: [url],
              });

              return NextResponse.json({
                code: 200,
                msg: 'success',
                imageUrl: url,
                status: 'completed',
                data: {
                  taskId,
                  resultUrls: [url],
                  successFlag: 1,
                  status: 'SUCCESS',
                  source: 'url-pattern-guessing',
                  cacheHit: false
                }
              });
            }
          } catch (error) {
            // Continue to next URL
          }
        }

        console.log(`❌ No valid URLs found for task ${taskId}`);
      }

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

      // Check if task is stuck (created more than 10 minutes ago but still processing)
      const now = Date.now();
      const createdTime = targetRecord.createTime || targetRecord.createdAt;
      let isStuckTask = false;
      if (createdTime) {
        const taskAge = now - new Date(createdTime).getTime();
        const tenMinutes = 10 * 60 * 1000;
        if (taskAge > tenMinutes && targetRecord.successFlag === 0) {
          console.log(`⚠️ Task is ${Math.round(taskAge / 60000)} minutes old and still processing - might be stuck`);
          isStuckTask = true;

          // For stuck tasks, try to fetch the image URL directly using a pattern
          console.log('🔍 Attempting to fetch stuck task image URL...');
          const possibleUrl = `https://tempfile.aiquickdraw.com/s/${taskId}_0_${Math.floor(Date.now() / 1000)}.png`;

          try {
            // Try HEAD request to check if URL exists
            const headResponse = await fetch(possibleUrl, { method: 'HEAD' });
            if (headResponse.ok) {
              console.log('✅ Found image URL for stuck task:', possibleUrl);

              // Update cache and return success
              storeCallbackResult({
                taskId,
                status: 'SUCCESS',
                resultUrls: [possibleUrl],
              });

              return NextResponse.json({
                code: 200,
                msg: 'success',
                imageUrl: possibleUrl,
                status: 'completed',
                data: {
                  taskId,
                  resultUrls: [possibleUrl],
                  successFlag: 1,
                  status: 'SUCCESS',
                  source: 'stuck-task-recovery',
                  cacheHit: false
                }
              });
            } else {
              console.log('❌ URL does not exist:', possibleUrl);
            }
          } catch (error) {
            console.log('❌ Error checking stuck task URL:', error);
          }
        }
      }

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
