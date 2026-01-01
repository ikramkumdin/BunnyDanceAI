import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Fetch image result from Kie.ai by taskId
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

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Poll Kie.ai for the image result
    const statusUrl = `https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`;
    
    console.log(`📸 Fetching image from Kie.ai for task: ${taskId}`);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      return NextResponse.json(
        { error: 'Failed to fetch image from Kie.ai', details: errorText },
        { status: statusResponse.status }
      );
    }

    const statusData = await statusResponse.json();
    console.log('✅ Kie.ai response:', JSON.stringify(statusData, null, 2));
    
    if (statusData.code && statusData.code !== 200) {
      return NextResponse.json(
        { error: statusData.msg || 'Failed to fetch image', code: statusData.code },
        { status: 400 }
      );
    }
    
    let foundImageUrl = null;
    const data = statusData.data;

    // Check for image URLs in multiple possible locations
    if (data?.response) {
      try {
        const responseObj = typeof data.response === 'string' 
          ? JSON.parse(data.response) 
          : data.response;
        
        if (responseObj.result_urls && Array.isArray(responseObj.result_urls) && responseObj.result_urls.length > 0) {
          foundImageUrl = responseObj.result_urls[0];
        } else if (Array.isArray(responseObj) && responseObj.length > 0 && typeof responseObj[0] === 'string' && responseObj[0].startsWith('http')) {
          foundImageUrl = responseObj[0];
        } else if (typeof responseObj === 'string' && responseObj.startsWith('http')) {
          foundImageUrl = responseObj;
        }
      } catch (e) {
        console.error('Failed to parse data.response field:', e);
      }
    }
    
    if (!foundImageUrl && data?.resultUrls) {
      try {
        const urls = typeof data.resultUrls === 'string' 
          ? JSON.parse(data.resultUrls) 
          : data.resultUrls;
        
        if (Array.isArray(urls) && urls.length > 0) {
          foundImageUrl = urls[0];
        } else if (typeof urls === 'string' && urls.startsWith('http')) {
          foundImageUrl = urls;
        }
      } catch (e) {
        console.error('Failed to parse resultUrls:', e);
      }
    }
    
    if (!foundImageUrl && data?.imageUrl) {
      foundImageUrl = data.imageUrl;
    }
    
    if (!foundImageUrl && data?.url) {
      foundImageUrl = data.url;
    }

    if (!foundImageUrl) {
      return NextResponse.json(
        { error: 'Image URL not found in Kie.ai response', data: statusData },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId,
      imageUrl: foundImageUrl,
      status: data?.successFlag === 1 ? 'completed' : 'processing',
    });

  } catch (error) {
    console.error('Fetch Kie.ai image error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}




