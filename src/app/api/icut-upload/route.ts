import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const filePath = path.join(uploadsDir, safeName);
    await fs.writeFile(filePath, bytes);

    return NextResponse.json({
      title: file.name,
      src: `/uploads/${safeName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
