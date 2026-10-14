import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

interface TranscodeOptions {
  quality?: string;
  audio?: string;
  startSec?: number;
}

export function getTranscodeStream(filePath: string, opts: TranscodeOptions): Readable {
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (opts.startSec && opts.startSec > 0) {
    args.push('-ss', String(opts.startSec));
  }
  args.push('-i', filePath);

  if (opts.quality === '480p') {
    args.push('-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '1200k');
  } else if (opts.quality === '720p') {
    args.push('-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '2500k');
  } else {
    args.push('-c:v', 'copy');
  }

  if (opts.audio === 'fr' || opts.audio === 'vf') {
    args.push('-map', '0:v:0', '-map', '0:m:language:fre?', '-map', '0:m:language:fra?', '-map', '0:a:0');
  } else if (opts.audio === 'en' || opts.audio === 'vo') {
    args.push('-map', '0:v:0', '-map', '0:m:language:eng?', '-map', '0:a:0');
  } else if (opts.audio === 'track2') {
    args.push('-map', '0:v:0', '-map', '0:a:1?');
  } else {
    args.push('-map', '0:v:0', '-map', '0:a:0?');
  }

  args.push('-c:a', 'aac', '-b:a', '160k', '-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1');
  const proc = spawn('ffmpeg', args);
  return proc.stdout;
}
