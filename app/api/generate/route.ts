// app/api/generate/route.ts
import { NextResponse } from 'next/server';

// The URL of your Python LangGraph service
const LANGGRAPH_API_URL = 'http://127.0.0.1:8000/api/generate'; // Or wherever you deploy it

export async function POST(req: Request) {
  try {
    const { prompt, base64Image, framework } = await req.json();

    // Forward the request to the Python service
    const response = await fetch(LANGGRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, base64Image, framework }),
    });

    if (!response.ok || !response.body) {
      // If the Python service returned an error, forward it
      const errorText = await response.text();
      console.error('LangGraph service error:', errorText);
      return NextResponse.json(
        { error: `LangGraph service error: ${errorText}` },
        { status: response.status }
      );
    }

    // The response from FastAPI is already a stream. We can pass it directly to the client.
    const stream = response.body;

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to the generation service.' },
      { status: 500 }
    );
  }
}