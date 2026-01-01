
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*', // Allow all origins for this proxy
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 });
    }
}
