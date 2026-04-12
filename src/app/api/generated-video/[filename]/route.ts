import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(_req: Request, { params }: { params: { filename: string } }) {
  const filename = path.basename(params.filename || '');
  if (!filename) {
    return NextResponse.json({ error: 'Missing filename.' }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'generated-videos', filename);
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Generated video not found.' }, { status: 404 });
  }
}
