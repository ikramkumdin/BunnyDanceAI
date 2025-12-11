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
    const PAGE_SIZE = 10; // Kie.ai API appears to cap at 10
    let allRecords: any[] = [];
    let totalRecords = 0;
    let currentPage = 1;
    let totalPages = 1;
    let maxPages = 10; // safety cap to avoid infinite loops

    try {
      while (currentPage <= maxPages) {
        console.log(`🚀 CALLING GOLDEN ENDPOINT page ${currentPage} (pageSize: ${PAGE_SIZE})...`);

        const historyResponse = await fetch('https://api.kie.ai/client/v1/userRecord/gpt4o-image/page', {
          method: 'POST',
          headers: {
            'Authorization': authToken, // Raw token without "Bearer" prefix
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://kie.ai',
            'Referer': 'https://kie.ai/',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'uniqueid': '80ee02e0ac69022f3ed8fcf09f636808', // Session unique ID from browser
            'priority': 'u=1, i',
          },
          body: JSON.stringify({
            pageNum: currentPage,
            pageSize: PAGE_SIZE
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
          const pageCount = pageData.data?.pages || Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));

        if (currentPage === 1) {
          totalRecords = pageTotal;
          totalPages = pageCount;
          console.log(`📊 Response structure: total=${totalRecords}, pages=${totalPages}`);
          // Allow as many pages as API reports, capped by maxPages
          maxPages = Math.max(maxPages, totalPages);
        }

        allRecords = allRecords.concat(pageRecords);
        console.log(`📄 Page ${currentPage}: ${pageRecords.length} records (total so far: ${allRecords.length})`);

        // Check if we have all records or if this is the last page
        if (allRecords.length >= totalRecords || pageRecords.length === 0 || currentPage >= maxPages) {
          break;
        }

        currentPage++;
      }

      let records = allRecords;
      console.log(`📊 Found ${records.length} total records across ${currentPage} pages (expected: ${totalRecords})`);

      // DEBUG: Log ALL taskIds we're checking
      const allTaskIds = records.map((r: any) => r.taskId || r.task_id || 'NO_TASK_ID');
      console.log(`🔍 Looking for taskId: ${taskId}`);
      console.log(`📋 All taskIds in records (first 10):`, allTaskIds.slice(0, 10));
      console.log(`📋 TaskId in list?`, allTaskIds.includes(taskId));
      
      // Try multiple field name variations
      let targetRecord = records.find((r: any) => 
        r.taskId === taskId || 
        r.task_id === taskId ||
        String(r.id) === String(taskId)
      );

      if (targetRecord) {
        // Log full record structure for debugging
        console.log(`🎯 Found task ${taskId}! Full record structure:`, JSON.stringify(targetRecord, null, 2));
        console.log(`📋 Record fields:`, Object.keys(targetRecord));
        console.log(`📊 successFlag: ${targetRecord.successFlag}, resultJson: ${targetRecord.resultJson ? 'exists' : 'null'}, response: ${targetRecord.response ? 'exists' : 'null'}`);
      } else {
        // Show what we DID find
        console.log(`❌ Task ${taskId} NOT found. Sample record structure:`, records.length > 0 ? JSON.stringify(records[0], null, 2) : 'No records');
      }

      if (!targetRecord) {
        console.log(`❌ Task ${taskId} not found after ${records.length} records`);
        console.log(`📊 Total reported: ${totalRecords}, Records fetched: ${records.length}`);
        
        // If we got fewer records than total, or if this is a very recent task, try fetching page 1 again
        // Sometimes new tasks take a moment to appear in the paginated results
        if (records.length < totalRecords || (Date.now() - parseInt(taskId.slice(0, 8), 16) * 1000) < 60000) {
          console.log(`🔄 Task might be very recent, trying to fetch page 1 again with fresh request...`);
          try {
            const retryResponse = await fetch('https://api.kie.ai/client/v1/userRecord/gpt4o-image/page', {
              method: 'POST',
              headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': 'https://kie.ai',
                'Referer': 'https://kie.ai/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'uniqueid': '80ee02e0ac69022f3ed8fcf09f636808',
                'priority': 'u=1, i',
              },
              body: JSON.stringify({
                pageNum: 1,
                pageSize: 20 // Check more records on retry
              })
            });

            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const retryRecords = retryData.data?.records || [];
              const retryTotal = retryData.data?.total || 0;
              console.log(`🔄 Retry found ${retryRecords.length} records (total: ${retryTotal})`);
              
              // Check if total increased
              if (retryTotal > totalRecords) {
                console.log(`📈 Total increased from ${totalRecords} to ${retryTotal} - new task likely appeared!`);
              }
              
              // Try to find the task in retry results
              targetRecord = retryRecords.find((r: any) => 
                r.taskId === taskId || 
                r.task_id === taskId ||
                String(r.id) === String(taskId)
              );
              
              if (targetRecord) {
                console.log(`✅ Found task in retry!`);
                // Update records to use retry results
                records = retryRecords;
                totalRecords = retryTotal;
              }
            }
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }

        if (!targetRecord) {
          console.log(`❌ Task still not found, trying record-info fallback...`);
          // As final fallback, try to get the image directly from Kie.ai's record-info endpoint
          console.log(`🔄 Trying direct Kie.ai record-info API as final fallback...`);
          try {
          const recordResponse = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
            headers: {
              'Authorization': authToken,
              'Content-Type': 'application/json',
            },
          });

          if (recordResponse.ok) {
            const recordData = await recordResponse.json();
            console.log('📋 Record-info response:', JSON.stringify(recordData, null, 2));

            if (recordData.code === 200 && recordData.data) {
              const record = recordData.data;

              // Check if task is completed
              if (record.successFlag === 1 && record.response) {
                try {
                  const responseData = typeof record.response === 'string' ?
                    JSON.parse(record.response) : record.response;

                  if (responseData.result_urls && responseData.result_urls.length > 0) {
                    const imageUrl = responseData.result_urls[0];
                    console.log(`✅ Found image via record-info: ${imageUrl}`);

                    // Store and return success
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
                        source: 'record-info-fallback',
                        cacheHit: false
                      }
                    });
                  }
                } catch (parseError) {
                  console.log('❌ Error parsing record-info response');
                }
              }
            }
          }
        } catch (error) {
          console.log('❌ Record-info API failed:', error);
        }

        console.log(`💔 All fallback methods failed for task ${taskId}`);

        // Final fallback: allow manual URL injection via query parameter
        const manualUrl = searchParams.get('manualUrl');
        if (manualUrl && manualUrl.startsWith('https://tempfile.aiquickdraw.com/')) {
          console.log(`🔧 Manual URL provided: ${manualUrl}`);

          // Verify the URL exists
          try {
            const headResponse = await fetch(manualUrl, { method: 'HEAD' });
            if (headResponse.ok) {
              console.log(`✅ Manual URL verified and working: ${manualUrl}`);

              storeCallbackResult({
                taskId,
                status: 'SUCCESS',
                resultUrls: [manualUrl],
              });

              return NextResponse.json({
                code: 200,
                msg: 'success',
                imageUrl: manualUrl,
                status: 'completed',
                data: {
                  taskId,
                  resultUrls: [manualUrl],
                  successFlag: 1,
                  status: 'SUCCESS',
                  source: 'manual-url-injection',
                  cacheHit: false
                }
              });
            } else {
              console.log(`❌ Manual URL not accessible: ${manualUrl}`);
            }
          } catch (error) {
            console.log(`❌ Error verifying manual URL: ${error}`);
          }
        }
        } // Close the nested if (!targetRecord) at line 269
      } // Close the first if (!targetRecord) at line 205

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

      // Check if task has completeTime (indicates completion even if successFlag is 0)
      const hasCompleteTime = targetRecord.completeTime || targetRecord.completedAt;
      const isActuallyComplete = targetRecord.successFlag === 1 || hasCompleteTime;

      // Try to extract image URL from multiple possible locations
      let foundImageUrl = null;

      // 1. Check resultJson (primary location)
      if (targetRecord.resultJson) {
        try {
          console.log('📦 Raw resultJson:', targetRecord.resultJson);
          const parsedResult = JSON.parse(targetRecord.resultJson);
          console.log('📦 Parsed resultJson:', JSON.stringify(parsedResult, null, 2));

          // Try multiple paths in the parsed result
          if (parsedResult.data?.result_urls && Array.isArray(parsedResult.data.result_urls) && parsedResult.data.result_urls.length > 0) {
            foundImageUrl = parsedResult.data.result_urls[0];
          } else if (parsedResult.result_urls && Array.isArray(parsedResult.result_urls) && parsedResult.result_urls.length > 0) {
            foundImageUrl = parsedResult.result_urls[0];
          } else if (parsedResult.url) {
            foundImageUrl = parsedResult.url;
          }
        } catch (parseError) {
          console.error('❌ Error parsing resultJson:', parseError);
        }
      }

      // 2. Check response field (alternative location)
      if (!foundImageUrl && targetRecord.response) {
        try {
          console.log('📦 Checking response field:', typeof targetRecord.response);
          let responseData = targetRecord.response;
          
          // Parse if it's a string
          if (typeof responseData === 'string') {
            responseData = JSON.parse(responseData);
          }

          // Try multiple paths
          if (responseData.data?.result_urls && Array.isArray(responseData.data.result_urls) && responseData.data.result_urls.length > 0) {
            foundImageUrl = responseData.data.result_urls[0];
          } else if (responseData.result_urls && Array.isArray(responseData.result_urls) && responseData.result_urls.length > 0) {
            foundImageUrl = responseData.result_urls[0];
          } else if (responseData.url) {
            foundImageUrl = responseData.url;
          } else if (typeof responseData === 'string' && responseData.startsWith('http')) {
            foundImageUrl = responseData;
          }
        } catch (parseError) {
          console.error('❌ Error parsing response field:', parseError);
        }
      }

      // 3. If we found an image URL, return success
      if (foundImageUrl) {
        console.log('✅ SUCCESS! Found image URL:', foundImageUrl);

        // Update cache for future reference
        storeCallbackResult({
          taskId,
          status: 'SUCCESS',
          resultUrls: [foundImageUrl],
        });

        return NextResponse.json({
          code: 200,
          msg: 'success',
          imageUrl: foundImageUrl,
          status: 'completed',
          data: {
            taskId,
            resultUrls: [foundImageUrl],
            successFlag: isActuallyComplete ? 1 : 0,
            status: 'SUCCESS',
            source: 'golden-endpoint-success',
            cacheHit: false
          }
        });
      }

      // 4. If task has completeTime but no URL found, it might be completed but URL not yet populated
      if (hasCompleteTime && !foundImageUrl) {
        console.log('⚠️ Task has completeTime but no image URL found yet. This might indicate completion with delayed URL population.');
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
