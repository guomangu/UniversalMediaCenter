
/**
 * Échantillonne des frames non-noires (à 25%, 50%, 75% du film) via ffmpeg cropdetect
 * Détecte si le flux 16:9 (1920x1080 ou 3840x2160) contient des bandes noires Scope (2.39:1 / 2.40:1) encodées en dur.
 */
async function detectActualActiveVisualRatio(
  filePath: string,
  durationSeconds: number,
  containerWidth: number,
  containerHeight: number
): Promise<{ isScope: boolean; activeRatio?: string; detectedHeight?: number }> {
  try {
    const points = [
      Math.floor(durationSeconds * 0.25),
      Math.floor(durationSeconds * 0.5),
      Math.floor(durationSeconds * 0.75),
    ];
    const detectedHeights: number[] = [];

    for (const ss of points) {
      try {
        const { stderr } = await execFileAsync(
          'ffmpeg',
          ['-ss', String(ss), '-i', filePath, '-vframes', '2', '-vf', 'cropdetect=24:16:0', '-f', 'null', '-'],
          { timeout: 1200 }
        );
        const matches = Array.from(stderr.matchAll(/crop=\d+:(\d+):\d+:\d+/g));
        for (const m of matches) {
          const h = parseInt(m[1], 10);
          if (h > 200 && h <= containerHeight) {
            detectedHeights.push(h);
          }
        }
      } catch {}
    }

    if (detectedHeights.length === 0) return { isScope: false };

    // Médiane des hauteurs détectées pour neutraliser les fondus au noir
    detectedHeights.sort((a, b) => a - b);
    const medianH = detectedHeights[Math.floor(detectedHeights.length / 2)];

    // Si la hauteur utile est inférieure ou égale à 80% du conteneur (ex: <= 864 pour 1080p)
    const scopeThreshold = containerHeight * 0.80;
    if (medianH <= scopeThreshold) {
      const ratio = (containerWidth / medianH).toFixed(2);
      return {
        isScope: true,
        activeRatio: `${ratio}:1`,
        detectedHeight: medianH,
      };
    }
  } catch {}
  return { isScope: false };
}

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

          // Détection heuristique non-bloquante du CinémaScope réel (bandes noires encodées en dur)
          if ((videoQuality === '1080p FHD' || videoQuality === '4K UHD') && duration && duration > 180) {
            const actual = await detectActualActiveVisualRatio(filePath, duration, w, h);
            if (actual.isScope) {
              videoQuality = w >= 3800 ? '4K Scope' : '1080p Scope';
              aspectRatio = actual.activeRatio || '2.39:1';
            }
          }
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
