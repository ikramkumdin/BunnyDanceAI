import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const provider = searchParams.get('provider') || 'kie'; // Default to kie for backward compatibility

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      );
    }

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

    // Handle Kie.ai polling (less reliable, but fallback option)
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'GROK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const statusUrl = `https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`;
    
    console.log(`📸 Polling Kie.ai image task: ${statusUrl}`);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (statusResponse.ok) {
      let statusData = await statusResponse.json();
      console.log('✅ Image poll response:', JSON.stringify(statusData, null, 2));
      
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
      
      // Check for image URLs in multiple possible locations
      let foundImageUrl = null;
      
      // 1. Check data.response field (might be JSON string, array, or object with result_urls)
      if (statusData.data?.response && statusData.data.response !== null) {
        console.log('🔍 Checking data.response field:', typeof statusData.data.response);
        try {
          const response = typeof statusData.data.response === 'string' 
            ? JSON.parse(statusData.data.response) 
            : statusData.data.response;
          
          console.log('📦 Parsed response object:', JSON.stringify(response, null, 2));
          
          // Check for result_urls (standard Kie.ai 4o Image response format)
          if (response.result_urls && Array.isArray(response.result_urls) && response.result_urls.length > 0) {
            foundImageUrl = response.result_urls[0];
            console.log('✅ Found image URL in response.result_urls:', foundImageUrl);
          }
          // Check if response is directly an array of URLs
          else if (Array.isArray(response) && response.length > 0 && typeof response[0] === 'string' && response[0].startsWith('http')) {
            foundImageUrl = response[0];
            console.log('✅ Found image URL in response array:', foundImageUrl);
          }
          // Check if response is directly a URL string
          else if (typeof response === 'string' && response.startsWith('http')) {
            foundImageUrl = response;
            console.log('✅ Found image URL in response string:', foundImageUrl);
          }
          // Check for url field in response object
          else if (response.url && typeof response.url === 'string' && response.url.startsWith('http')) {
            foundImageUrl = response.url;
            console.log('✅ Found image URL in response.url:', foundImageUrl);
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
      
      // Map successFlag from record-info endpoint
      // 0: Generating, 1: Success, 2/3: Failed
      if (statusData.data?.successFlag !== undefined) {
        const flag = statusData.data.successFlag;
        const completeTime = statusData.data.completeTime;
        console.log(`🏁 Success flag: ${flag}, Complete time: ${completeTime}`);
        
        // If we found an image URL, mark as completed regardless of successFlag
        if (foundImageUrl) {
          statusData.imageUrl = foundImageUrl;
          statusData.status = 'completed';
          console.log('✅ Image generation completed with URL:', foundImageUrl);
        } else {
          // No image URL yet, check successFlag
          if (flag === 0) {
            // Still generating - but check if completeTime is set (API inconsistency?)
            if (completeTime) {
              console.log('⚠️ CompleteTime is set but successFlag still 0 - Kie.ai API lag detected');
              console.log('🔄 Trying alternative approach: checking paramJson for result...');
              
              // Try parsing paramJson to see if result is embedded there
              if (statusData.data.paramJson) {
                try {
                  const params = JSON.parse(statusData.data.paramJson);
                  console.log('📦 Parsed paramJson:', JSON.stringify(params, null, 2));
                } catch (e) {
                  console.error('Failed to parse paramJson:', e);
                }
              }
            }
            statusData.status = 'processing';
            console.log('⏳ Still processing... will keep polling');
          } else if (flag === 1) {
            statusData.status = 'completed';
            console.log('⚠️ Success flag = 1 but no image URL found! This should not happen.');
            console.log('📋 Full response data:', JSON.stringify(statusData.data, null, 2));
          } else if (flag === 2 || flag === 3) {
            statusData.status = 'failed';
            statusData.error = statusData.data.failReason || statusData.data.errorMessage || 'Image generation failed';
            console.log('❌ Generation failed:', statusData.error);
          }
        }
      }

      return NextResponse.json(statusData);
    }

    const errorText = await statusResponse.text();
    return NextResponse.json(
      { error: 'Failed to check task status', details: errorText },
      { status: statusResponse.status }
    );

  } catch (error) {
    console.error('Poll image task error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

