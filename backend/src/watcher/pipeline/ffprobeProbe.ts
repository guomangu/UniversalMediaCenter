import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Chapter } from '../../db/schema/nodes.js';

const execFileAsync = promisify(execFile);

export interface ProbedStreamData {
  durationSeconds?: number;
  videoCodec?: string;
  videoQuality?: string;
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: string;
  audioTracks: Array<{ language?: string; codec?: string; channels?: number }>;
  subtitleTracks: Array<{ language?: string; codec?: string; forced?: boolean; sdh?: boolean }>;
  containerTitle?: string;
  chapters: Chapter[];
}

function classifyChapterType(title: string): 'INTRO' | 'OUTRO' | 'NORMAL' {
  const t = title.toLowerCase();
  if (/intro|opening|^op\b|générique début/i.test(t)) return 'INTRO';
  if (/outro|credit|ending|^ed\b|générique fin/i.test(t)) return 'OUTRO';
  return 'NORMAL';
}

/**
 * Inspection technique approfondie via ffprobe en JSON
 */
export async function probeMediaFile(filePath: string): Promise<ProbedStreamData | null> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', filePath],
      { timeout: 7000 }
    );
    const data = JSON.parse(stdout);
    const duration = data.format?.duration ? parseFloat(data.format.duration) : undefined;
    const containerTitle = data.format?.tags?.title || data.format?.tags?.TITLE;

    let videoCodec: string | undefined;
    let videoWidth: number | undefined;
    let videoHeight: number | undefined;
    let videoQuality: string | undefined;
    let aspectRatio: string | undefined;

    const audioTracks: Array<{ language?: string; codec?: string; channels?: number }> = [];
    const subtitleTracks: Array<{ language?: string; codec?: string; forced?: boolean; sdh?: boolean }> = [];

    for (const st of data.streams || []) {
      if (st.codec_type === 'video' && !videoCodec) {
        videoCodec = st.codec_name;
        videoWidth = st.width;
        videoHeight = st.height;
        aspectRatio = st.display_aspect_ratio || (videoWidth && videoHeight ? `${videoWidth}:${videoHeight}` : undefined);
        const w = videoWidth || 0;
        const h = videoHeight || 0;
        if (w > 0 || h > 0) {
          if (w >= 3800 || h >= 2000) videoQuality = '4K UHD';
          else if (w >= 1900 && h >= 1000) videoQuality = '1080p FHD';
          else if (w >= 1900 && h >= 720) videoQuality = '1080p Scope';
          else if (w >= 1200 || h >= 700) videoQuality = '720p HD';
          else if (h >= 480 || w >= 600) videoQuality = '480p SD';
          else videoQuality = 'SD';
        }
      } else if (st.codec_type === 'audio') {
        const lang = st.tags?.language || st.tags?.LANGUAGE;
        audioTracks.push({
          language: lang ? lang.slice(0, 3).toLowerCase() : undefined,
          codec: st.codec_name,
          channels: st.channels,
        });
      } else if (st.codec_type === 'subtitle') {
        const lang = st.tags?.language || st.tags?.LANGUAGE;
        const disposition = st.disposition || {};
        subtitleTracks.push({
          language: lang ? lang.slice(0, 3).toLowerCase() : undefined,
          codec: st.codec_name,
          forced: Boolean(disposition.forced),
          sdh: Boolean(disposition.hearing_impaired),
        });
      }
    }

    const chapters: Chapter[] = (data.chapters || []).map((ch: any) => {
      const start = parseFloat(ch.start_time || '0');
      const end = parseFloat(ch.end_time || '0');
      const title = ch.tags?.title || `Chapitre ${ch.id || ''}`.trim();
      return {
        title,
        startSeconds: start,
        endSeconds: end,
        type: classifyChapterType(title),
      };
    });

    return {
      durationSeconds: duration && !isNaN(duration) ? Math.round(duration) : undefined,
      videoCodec,
      videoQuality,
      videoWidth,
      videoHeight,
      aspectRatio,
      audioTracks,
      subtitleTracks,
      containerTitle,
      chapters,
    };
  } catch {
    return null;
  }
}
