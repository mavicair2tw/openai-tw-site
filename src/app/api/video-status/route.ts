import { NextResponse } from 'next/server';
import { normalizeEnvValue, d1Exec, d1Query } from '@/lib/cloudflare';
import { addVideoRecord } from '@/lib/media-store';

type JobRow = {
  status: string;
  request_id: string;
  prompt: string;
  aspect_ratio: string;
  duration_seconds: number;
  video_id?: string | null;
  error?: string | null;
};

type VideoRow = {
  id: string;
  title: string;
  src: string;
  duration: string;
  prompt: string;
  aspect_ratio: string;
  timestamp: number;
  demo?: number | null;
  object_path?: string | null;
};

async function hydrateVideo(row: VideoRow) {
  // Assuming this function is defined in media-store, but for completeness
  return {
    id: row.id,
    title: row.title,
    src: row.src, // Would normally build public URL if needed
    duration: row.duration,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio,
    timestamp: row.timestamp,
    demo: Boolean(row.demo),
    objectPath: row.object_path || undefined,
  };
}

const XAI_API_KEY = normalizeEnvValue(process.env.XAI_API_KEY);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
  }

  const jobs = await d1Query<JobRow>('SELECT * FROM media_gallery_jobs WHERE id = ? LIMIT 1', [jobId]);
  const job = jobs[0];

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }

  if (job.status === 'done' && job.video_id) {
    const videos = await d1Query<VideoRow>('SELECT * FROM media_gallery_videos WHERE id = ? LIMIT 1', [job.video_id]);
    const video = videos[0];

    if (!video) {
      return NextResponse.json({ error: 'Video not found for completed job.' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'done',
      video: await hydrateVideo(video),
    });
  }

  if (job.status === 'failed') {
    return NextResponse.json({ status: 'failed', error: job.error || 'Unknown error' }, { status: 500 });
  }

  // Poll xAI
  try {
    const response = await fetch(`https://api.x.ai/v1/videos/${job.request_id}`, {
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const err = data.error?.message || 'xAI poll failed';
      await d1Exec('UPDATE media_gallery_jobs SET status = ?, error = ? WHERE id = ?', ['failed', err, jobId]);
      return NextResponse.json({ status: 'failed', error: err }, { status: 500 });
    }

    if (data.status === 'done') {
      // Download video
      const videoResp = await fetch(data.video.url);
      if (!videoResp.ok) {
        throw new Error(`Failed to download video: ${videoResp.status}`);
      }

      const arrayBuffer = await videoResp.arrayBuffer();
      const bytes = Buffer.from(arrayBuffer);
      const mimeType = videoResp.headers.get('content-type') || 'video/mp4';
      const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';

      const videoId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const filename = `${videoId}.${extension}`;
      const objectPath = buildMediaObjectPath('videos', filename);

      const publicUrl = await uploadMediaObject({ objectPath, body: bytes, contentType: mimeType });

      const video = {
        id: videoId,
        title: `Generated: ${job.prompt.slice(0, 40)}...`,
        src: publicUrl,
        duration: data.video.duration.toString(),
        prompt: job.prompt,
        aspectRatio: job.aspect_ratio,
        timestamp: Date.now(),
        demo: false,
        objectPath,
      };

      await addVideoRecord(video);
      await d1Exec('UPDATE media_gallery_jobs SET status = ?, video_id = ? WHERE id = ?', ['done', videoId, jobId]);

      return NextResponse.json({
        status: 'done',
        video,
      });
    } else if (data.status === 'pending') {
      return NextResponse.json({ status: 'pending' });
    } else {
      const err = data.status === 'expired' ? 'Request expired' : data.error?.message || 'Failed';
      await d1Exec('UPDATE media_gallery_jobs SET status = ?, error = ? WHERE id = ?', ['failed', err, jobId]);
      return NextResponse.json({ status: 'failed', error: err }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Polling failed';
    await d1Exec('UPDATE media_gallery_jobs SET status = ?, error = ? WHERE id = ?', ['failed', message, jobId]);
    return NextResponse.json({ status: 'failed', error: message }, { status: 500 });
  }
}
