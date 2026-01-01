import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const apiKey = process.env.GROK_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                error: 'GROK_API_KEY not configured',
                configured: false
            }, { status: 500 });
        }

        console.log('🔑 Testing Kie.ai API key...');
        console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...');

        // Test 1: Check if we can access the API
        const testUrl = 'https://api.kie.ai/api/v1/jobs/recordInfo?taskId=test';
        console.log('📡 Testing API endpoint:', testUrl);

        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        console.log('📊 API Response:', data);

        // Test 2: Try to get account info or list tasks
        const listUrl = 'https://api.kie.ai/api/v1/jobs/list';
        console.log('📡 Testing list endpoint:', listUrl);

        const listResponse = await fetch(listUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        const listData = await listResponse.json();
        console.log('📊 List Response:', listData);

        return NextResponse.json({
            configured: true,
            apiKeyPrefix: apiKey.substring(0, 10) + '...',
            testResponse: {
                status: response.status,
                data: data
            },
            listResponse: {
                status: listResponse.status,
                data: listData
            },
            message: 'API key test completed. Check the response data above.'
        });

    } catch (error) {
        console.error('❌ API test error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            configured: !!process.env.GROK_API_KEY
        }, { status: 500 });
    }
}
