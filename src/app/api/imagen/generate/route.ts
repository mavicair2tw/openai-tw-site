import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const aspectRatio = typeof body?.aspectRatio === 'string' ? body.aspectRatio : '1:1';

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" fill="#0f172a" />
      <rect x="48" y="48" width="928" height="928" rx="40" fill="#111827" stroke="#334155" />
      <text x="80" y="140" fill="#93c5fd" font-size="36" font-family="Arial, sans-serif">Imagen Placeholder</text>
      <text x="80" y="200" fill="#e5e7eb" font-size="24" font-family="Arial, sans-serif">Aspect Ratio: ${aspectRatio}</text>
      <foreignObject x="80" y="250" width="864" height="640">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color:#f8fafc;font-size:28px;line-height:1.45;font-family:Arial, sans-serif;white-space:pre-wrap;word-break:break-word;">
          ${prompt.replace(/[&<>\"]/g, (char: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char))}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  return NextResponse.json({ imageUrl, mode: 'placeholder' });
}
