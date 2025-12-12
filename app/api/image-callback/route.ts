import { NextRequest, NextResponse } from 'next/server';
import { storeCallbackResult } from '@/lib/imageCallbackCache';

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
      // direct URL
      if (node.startsWith('http://') || node.startsWith('https://')) {
        urls.push(node);
        return;
      }
      // maybe JSON-encoded payload containing URLs
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

  // de-dupe while preserving order
  return urls.filter((u, i) => urls.indexOf(u) === i);
}

// This endpoint receives callbacks from Kie.ai when image generation completes
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Received Kie.ai image callback:', request.method, request.url);
    console.log('🔔 Headers:', Object.fromEntries(request.headers.entries()));

    // Read raw body as text FIRST so we can log exactly what Kie.ai sent.
    // (NextRequest body can only be consumed once.)
    const rawText = await request.text();
    console.log('--- RAW KIE.AI CALLBACK PAYLOAD (text) ---');
    console.log(rawText);
    console.log('-----------------------------------------');

    let data: any;
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.error('Failed to parse callback JSON:', e);
      // Return 200 to avoid Kie.ai retry loops, but keep signal in logs.
      return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 200 });
    }

    console.log('🔔 Callback Body (parsed JSON):', JSON.stringify(data, null, 2));

    // Kie.ai callback format (from their docs):
    // {
    //   "taskId": "xxx",
    //   "status": "SUCCESS" or "GENERATE_FAILED",
    //   "result_urls": ["https://..."] or null,
    //   "error": "error message" or null
    // }
    
    // Handle different possible formats from Kie.ai
    const taskId = data?.data?.taskId || data?.data?.task_id || data?.taskId || data?.task_id || data?.data?.id || data?.id;
    const status = data?.data?.status || data?.status || data?.data?.state || data?.state || 'SUCCESS';
    
    // Try multiple possible locations for result URLs
    // Kie.ai might send: result_urls, resultUrls, response, or directly in the body
    let resultUrls =
      data?.data?.response?.resultUrls ||
      data?.data?.response?.result_urls ||
      data?.response?.resultUrls ||
      data?.response?.result_urls ||
      data?.data?.result_urls ||
      data?.data?.resultUrls ||
      data?.result_urls ||
      data?.resultUrls ||
      data?.image_urls ||
      data?.imageUrls ||
      data?.data?.image_urls ||
      data?.data?.imageUrls ||
      data?.data?.response || // might be JSON string or object containing resultUrls
      data?.response || // might be JSON string or object containing resultUrls
      data?.data?.resultJson || // might be JSON string containing resultUrls
      data?.resultJson;
    
    // Handle case where the entire body might be an array (rare but possible)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string' && data[0].startsWith('http')) {
      resultUrls = data;
      console.log('📋 Found result URLs as direct array in body');
    }
    
    // If resultUrls is a string, try to parse it as JSON
    if (typeof resultUrls === 'string') {
      try {
        const parsed = JSON.parse(resultUrls);
        // common shapes:
        // - ["http..."]
        // - { resultUrls: ["http..."] }
        // - { result_urls: ["http..."] }
        // - { data: { resultUrls: [...] } }
        const extracted =
          (parsed as any)?.resultUrls ||
          (parsed as any)?.result_urls ||
          (parsed as any)?.data?.resultUrls ||
          (parsed as any)?.data?.result_urls ||
          (parsed as any)?.data?.response?.resultUrls ||
          (parsed as any)?.data?.response?.result_urls ||
          parsed;
        resultUrls = Array.isArray(extracted) ? extracted : [extracted];
        console.log('📋 Parsed result URLs from JSON string');
      } catch (e) {
        // If it's a URL string, wrap it in array
        if (resultUrls.startsWith('http')) {
          resultUrls = [resultUrls];
          console.log('📋 Wrapped single URL string into array');
        } else {
          resultUrls = null;
        }
      }
    }
    
    // Ensure it's an array
    if (resultUrls && !Array.isArray(resultUrls)) {
      resultUrls = [resultUrls];
      console.log('📋 Converted single value to array');
    }
    
    // Filter out any non-URL values
    if (Array.isArray(resultUrls)) {
      resultUrls = resultUrls.filter(url => typeof url === 'string' && url.startsWith('http'));
      console.log(`📋 Filtered to ${resultUrls.length} valid URL(s)`);
    }

    // Last resort: deep-scan the payload for any http(s) URLs (including inside JSON-encoded strings)
    if ((!resultUrls || (Array.isArray(resultUrls) && resultUrls.length === 0)) && data) {
      const scanned = collectHttpUrls(data);
      if (scanned.length > 0) {
        resultUrls = scanned;
        console.log(`📋 Deep-scanned and found ${scanned.length} URL(s) in callback payload`);
      }
    }
    
    const error = data?.error || data?.errorMessage || data?.data?.error || data?.data?.failMsg || data?.failMsg;
    
    console.log('📋 Task ID:', taskId);
    console.log('📋 Status:', status);
    console.log('📋 Result URLs:', resultUrls);
    console.log('📋 Full callback data keys:', Object.keys(data));

    if (!taskId) {
      console.error('⚠️ No taskId in callback data');
      console.error('📋 Full data received:', JSON.stringify(data, null, 2));
      return NextResponse.json({
        success: false,
        error: 'Missing taskId in callback data'
      }, { status: 200 });
    }

    // Store the callback result in cache
    storeCallbackResult({
      taskId,
      status: status.toUpperCase(),
      resultUrls: resultUrls,
      error
    });

    if (Array.isArray(resultUrls) && resultUrls.length > 0) {
      console.log(`✅ Callback result stored in cache for polling to retrieve. URL found for taskId=${taskId}`);
    } else {
      console.log(`⚠️ Callback stored, but NO URL extracted for taskId=${taskId}. (This usually means Kie.ai did not include URLs in the callback payload, or used an undocumented field.)`);
    }
    
    // Acknowledge receipt to Kie.ai
    return NextResponse.json({
      success: true,
      message: 'Callback received and stored',
      taskId: taskId
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error processing Kie.ai callback:', error);
    
    // Still return 200 to avoid Kie.ai retrying
    return NextResponse.json({
      success: false,
      error: 'Failed to process callback',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 });
  }
}

// Also support GET for testing and retrieving cached results
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  
  if (taskId) {
    const { getCallbackResult } = await import('@/lib/imageCallbackCache');
    const result = getCallbackResult(taskId);
    
    if (result) {
      return NextResponse.json({
        message: 'Callback result found in cache',
        result: result
      });
    }
    
    return NextResponse.json({
      message: 'No callback result found for this task ID',
      taskId: taskId
    }, { status: 404 });
  }
  
  // Show cache stats
  const { getCacheStats } = await import('@/lib/imageCallbackCache');
  const stats = getCacheStats();
  
  return NextResponse.json({
    message: 'Kie.ai image callback endpoint is active',
    note: 'This endpoint receives POST requests from Kie.ai when images are ready',
    cacheStats: stats
  });
}

