import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error:
        'OpenAI video API is not wired correctly in this environment yet. The installed SDK does not expose the video methods we tried to call.',
    },
    { status: 500 },
  );
}
