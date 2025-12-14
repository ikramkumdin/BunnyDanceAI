import { NextRequest, NextResponse } from 'next/server';
import { getVideoCallbackResult } from '@/lib/videoCallbackCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (!s) return value;
  if (!(s.startsWith('{') || s.startsWith('['))) return value;
  try {
    return JSON.parse(s);
  } catch {
    return value;
  }
}

function collectHttpUrls(input: unknown, maxDepth = 7): string[] {
  const urls: string[] = [];
  const seen = new Set<unknown>();

  const visit = (node: unknown, depth: number) => {
    if (depth > maxDepth) return;
    if (node === null || node === undefined) return;
    if (seen.has(node)) return;

    if (typeof node === 'string') {
      if (node.startsWith('http://') || node.startsWith('https://')) {
        urls.push(node);
        return;
      }
      const parsed = tryParseJson(node);
      if (parsed !== node) visit(parsed, depth + 1);
      return;
    }

    if (Array.isArray(node)) {
      seen.add(node);
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node === 'object') {
      seen.add(node);
      for (const value of Object.values(node as Record<string, unknown>)) {
        visit(value, depth + 1);
      }
    }
  };

  visit(input, 0);
  return urls.filter((u, i) => urls.indexOf(u) === i);
}

function pickVideoUrl(payload: any): string | undefined {
  // Common direct fields
  const direct =
    payload?.videoUrl ||
    payload?.url ||
    payload?.data?.videoUrl ||
    payload?.data?.url ||
    payload?.result?.videoUrl ||
    payload?.output?.videoUrl ||
    payload?.result?.url ||
    payload?.output?.url;

  if (typeof direct === 'string' && direct.startsWith('http')) return direct;

  // Veo record-info often stores results inside data.response or data.resultJson
  const candidates = [
    payload?.data?.response,
    payload?.data?.resultJson,
    payload?.resultJson,
    payload?.response,
    payload?.data?.resultUrls,
    payload?.data?.result_urls,
  ];

  for (const c of candidates) {
    const parsed = tryParseJson(c) as any;
    const fromParsed =
      (typeof parsed === 'string' && parsed.startsWith('http') ? parsed : undefined) ||
      parsed?.videoUrl ||
      parsed?.url ||
      parsed?.resultUrls?.[0] ||
      parsed?.result_urls?.[0] ||
      parsed?.data?.resultUrls?.[0] ||
      parsed?.data?.result_urls?.[0] ||
      (Array.isArray(parsed) ? parsed.find((u) => typeof u === 'string' && u.startsWith('http')) : undefined);
    if (typeof fromParsed === 'string' && fromParsed.startsWith('http')) return fromParsed;
  }

  // Last resort: deep scan and prefer mp4
  const scanned = collectHttpUrls(payload);
  return scanned.find((u) => u.includes('.mp4') || u.includes('mp4')) || scanned[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

    // Fast path: if we received a callback for this task, return it immediately.
    const cached = getVideoCallbackResult(taskId);
    if (cached?.videoUrl && cached.videoUrl.startsWith('http')) {
      return NextResponse.json({
        status: 'completed',
        videoUrl: cached.videoUrl,
        taskId,
        source: 'cache',
      });
    }

    // Check if this is a test task
    const isTestMode = process.env.KIE_TEST_MODE === 'true' && taskId.startsWith('test-');
    if (isTestMode) {
      console.log('🧪 TEST MODE: Simulating task status check for:', taskId);

      // Simulate task completion after 30 seconds
      const taskStartTime = parseInt(taskId.replace('test-', ''));
      const elapsed = Date.now() - taskStartTime;

      if (elapsed > 30000) { // 30 seconds
        console.log('✅ TEST MODE: Task completed');
        return NextResponse.json({
          status: 'completed',
          videoUrl: 'https://example.com/test-video.mp4',
          taskId: taskId
        });
      } else {
        console.log('⏳ TEST MODE: Task still processing');
        return NextResponse.json({
          status: 'processing',
          progress: Math.min(95, Math.floor((elapsed / 30000) * 100)),
          taskId: taskId
        });
      }
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Try different possible endpoints for task status
    // Based on search results and common Kie.ai patterns
    const kieApiUrl = process.env.GROK_API_URL || 'https://api.kie.ai/api/v1/veo/generate';
    const baseUrl = kieApiUrl.includes('/api/v1') 
      ? kieApiUrl.split('/api/v1')[0] 
      : 'https://api.kie.ai';

    // Try common task status endpoints and variations based on Kie.ai patterns
    const possibleEndpoints = [
      // Correct endpoint for Veo task status per documentation search
      // Note the hyphen in 'record-info'
      `${baseUrl}/api/v1/veo/record-info?taskId=${taskId}`,
      
      // Fallback: older endpoint style
      `${baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`,
      
      // Fallback: direct task endpoint
      `${baseUrl}/api/v1/task/${taskId}`,
    ];

    // Also try POST requests to some endpoints (some APIs require POST for status)
    const postEndpoints = [
      `${baseUrl}/api/v1/veo/generate/status`,
      `${baseUrl}/api/v1/generate/status`,
      `${baseUrl}/api/v1/task/status`,
      `${baseUrl}/api/v1/status`,
    ];
    
    // Try each GET endpoint until one works
    let lastError: any = null;
    for (const statusUrl of possibleEndpoints) {
      try {
        console.log(`Trying GET: ${statusUrl}`);
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (statusResponse.ok) {
          let statusData = await statusResponse.json();
          console.log('✅ Poll response (GET):', JSON.stringify(statusData, null, 2));
          
          // Handle Kie.ai API wrapper response (code 200/422 in the body)
          if (statusData.code === 422) {
            // This endpoint returned 422 "recordInfo is null" - task might still be processing or endpoint is wrong
            console.log(`⚠️ Endpoint ${statusUrl} returned code 422 in body, trying next...`);
            lastError = { status: 422, message: statusData.msg || 'recordInfo is null' };
            continue;
          }
          
          // If code is not 200, skip to next endpoint
          if (statusData.code && statusData.code !== 200) {
            console.log(`⚠️ Endpoint ${statusUrl} returned code ${statusData.code}, trying next...`);
            lastError = { status: statusData.code, message: statusData.msg };
            continue;
          }
          
          // Normalize response for frontend
          // Map 'state' to 'status' (Kie.ai uses 'state' sometimes)
          if (statusData.state && !statusData.status) {
            statusData.status = statusData.state;
          }
          
          // Map 'successFlag' from record-info endpoint
          // 0: Generating, 1: Success, 2/3: Failed
          if (statusData.data?.successFlag !== undefined) {
            const flag = statusData.data.successFlag;
            
            // Check if response field has video URLs (task might be complete even if flag is 0)
            let hasVideoUrl = false;
            if (statusData.data.response) {
              try {
                const response = typeof statusData.data.response === 'string' 
                  ? tryParseJson(statusData.data.response) 
                  : statusData.data.response;
                
                // Check if response is an array of URLs
                const picked = pickVideoUrl({ data: { response } });
                if (picked) {
                  statusData.videoUrl = picked;
                  statusData.status = 'completed';
                  statusData.completed = true;
                  hasVideoUrl = true;
                  console.log('✅ Found video URL in response field:', statusData.videoUrl);
                }
              } catch (e) {
                console.error('Failed to parse response field:', e);
              }
            }
            
            // Only check successFlag if we didn't find a video URL in response
            if (!hasVideoUrl) {
              if (flag === 0) {
                statusData.status = 'processing';
              } else if (flag === 1) {
                statusData.status = 'completed';
                statusData.completed = true;
                
                // Extract from resultJson/response/resultUrls
                const picked = pickVideoUrl(statusData);
                if (picked) statusData.videoUrl = picked;
              } else if (flag === 2 || flag === 3) {
                statusData.status = 'failed';
                statusData.error = statusData.data.failReason || 'Video generation failed';
              }
            }
          }
          
          // Ensure status is lowercase for comparison
          if (statusData.status) {
            statusData.status = statusData.status.toLowerCase();
          }

          // Extract video URL if nested and not already found
          if (!statusData.videoUrl) {
            const picked = pickVideoUrl(statusData);
            if (picked) statusData.videoUrl = picked;
          }

          return NextResponse.json(statusData);
        } else {
          // If 404 (task not found for this endpoint), try next endpoint
          if (statusResponse.status === 404) {
            lastError = { status: statusResponse.status, message: `Endpoint ${statusUrl} returned ${statusResponse.status}` };
            console.log(`⚠️ Endpoint ${statusUrl} returned ${statusResponse.status}, trying next...`);
            continue;
          }
          // For other errors, return immediately
          const errorText = await statusResponse.text();
          return NextResponse.json(
            { error: 'Failed to check task status', details: errorText, endpoint: statusUrl },
            { status: statusResponse.status }
          );
        }
      } catch (error) {
        lastError = error;
        console.error(`Error polling GET ${statusUrl}:`, error);
        // Continue to next endpoint
        continue;
      }
    }

    // Try POST endpoints if GET failed
    console.log('GET requests failed, trying POST requests...');
    for (const statusUrl of postEndpoints) {
      try {
        console.log(`Trying POST: ${statusUrl}`);
        const statusResponse = await fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId }),
        });

        if (statusResponse.ok) {
          let statusData = await statusResponse.json();
          console.log('✅ Poll response (POST):', JSON.stringify(statusData, null, 2));
          
          // Normalize response for frontend
          if (statusData.state && !statusData.status) {
            statusData.status = statusData.state;
          }
          
          if (statusData.status) {
            statusData.status = statusData.status.toLowerCase();
          }

          if (!statusData.videoUrl) {
             statusData.videoUrl = statusData.url || 
                                  statusData.result?.videoUrl || 
                                  statusData.output?.videoUrl || 
                                  statusData.data?.videoUrl ||
                                  statusData.result?.url ||
                                  statusData.output?.url;
          }

          return NextResponse.json(statusData);
        } else {
          // Continue to next endpoint even for non-404 errors
          lastError = { status: statusResponse.status, message: `POST to ${statusUrl} failed` };
          continue;
        }
      } catch (error) {
        lastError = error;
        console.error(`Error polling POST ${statusUrl}:`, error);
        continue;
      }
    }
    
    // If all endpoints failed, return error
    return NextResponse.json(
      { 
        error: 'Failed to check task status - all endpoints failed',
        details: lastError?.message || 'Unknown error',
        suggestion: 'Please configure KIE_CALLBACK_URL in .env.local to use webhook-based completion instead of polling'
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Poll task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

