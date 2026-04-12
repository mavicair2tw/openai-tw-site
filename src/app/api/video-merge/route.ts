import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type MergeVideoInput = {
  src: string;
  id?: string;
  title?: string;
};

async function downloadFile(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const videos: MergeVideoInput[] = Array.isArray(body?.videos)
    ? body.videos.filter((item: MergeVideoInput) => typeof item?.src === 'string' && item.src)
    : [];

  if (videos.length === 0) {
    return NextResponse.json({ error: 'No videos provided.' }, { status: 400 });
  }

  const jobId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `creator-merge-${jobId}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const inputFiles: string[] = [];

    for (let index = 0; index < videos.length; index += 1) {
      const inputPath = path.join(tempDir, `input-${index}.mp4`);
      await downloadFile(videos[index].src, inputPath);
      inputFiles.push(inputPath);
    }

    const listFilePath = path.join(tempDir, 'inputs.txt');
    const listContent = inputFiles.map((file) => `file '${file.replace(/'/g, `'\\''`)}'`).join('\n');
    await fs.writeFile(listFilePath, listContent, 'utf8');

    const outputPath = path.join(tempDir, 'merged.webm');

    await execFileAsync('/opt/homebrew/bin/ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFilePath,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '2M',
      '-c:a',
      'libopus',
      outputPath,
    ]);

    const outputBuffer = await fs.readFile(outputPath);

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/webm',
        'Content-Disposition': `attachment; filename="playlist-${Date.now()}.webm"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Merge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
