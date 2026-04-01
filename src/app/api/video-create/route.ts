import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Gemini video integration has not been wired in this workspace yet. The exact SDK/API surface needs to be matched to your installed package version.',
    },
    { status: 501 },
  );
}
