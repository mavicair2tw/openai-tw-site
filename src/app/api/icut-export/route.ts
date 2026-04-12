import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type ClipInput = {
  src: string;
  trimStart?: number;
  trimEnd?: number;
  fadeIn?: number;
  fadeOut?: number;
};

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clips: ClipInput[] = Array.isArray(body?.clips) ? body.clips : [];

  if (clips.length === 0) {
    return NextResponse.json({ error: 'No clips provided.' }, { status: 400 });
  }

  const jobId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `icut-export-${jobId}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const processedFiles: string[] = [];

    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const inputPath = path.join(tempDir, `input-${index}.mp4`);
      const outputPath = path.join(tempDir, `processed-${index}.mp4`);
      await downloadFile(clip.src, inputPath);

      const videoFilters: string[] = [];
      const fadeIn = Math.max(0, Number(clip.fadeIn || 0));
      const fadeOut = Math.max(0, Number(clip.fadeOut || 0));
      const trimStart = Math.max(0, Number(clip.trimStart || 0));
      const trimEnd = Math.max(trimStart, Number(clip.trimEnd || 0));
      const duration = trimEnd > trimStart ? trimEnd - trimStart : 0;

      if (fadeIn > 0) videoFilters.push(`fade=t=in:st=0:d=${fadeIn}`);
      if (fadeOut > 0 && duration > fadeOut) videoFilters.push(`fade=t=out:st=${duration - fadeOut}:d=${fadeOut}`);

      const args = ['-y'];
      if (trimStart > 0) args.push('-ss', String(trimStart));
      args.push('-i', inputPath);
      if (duration > 0) args.push('-t', String(duration));
      if (videoFilters.length > 0) args.push('-vf', videoFilters.join(','));
      args.push('-c:v', 'libx264', '-c:a', 'aac', outputPath);

      await execFileAsync('/opt/homebrew/bin/ffmpeg', args);
      processedFiles.push(outputPath);
    }

    const listFilePath = path.join(tempDir, 'concat.txt');
    const listContent = processedFiles.map((file) => `file '${file.replace(/'/g, `'\\''`)}'`).join('\n');
    await fs.writeFile(listFilePath, listContent, 'utf8');

    const finalOutputPath = path.join(tempDir, 'icut-export.mp4');
    await execFileAsync('/opt/homebrew/bin/ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFilePath,
      '-c', 'copy',
      finalOutputPath,
    ]);

    const outputBuffer = await fs.readFile(finalOutputPath);
    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="icut-export-${Date.now()}.mp4"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'iCut export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
