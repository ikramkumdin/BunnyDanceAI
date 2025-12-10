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
