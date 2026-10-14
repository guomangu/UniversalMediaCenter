import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
function classifyChapterType(title) {
    const t = title.toLowerCase();
    if (/intro|opening|^op\b|générique début/i.test(t))
        return 'INTRO';
    if (/outro|credit|ending|^ed\b|générique fin/i.test(t))
        return 'OUTRO';
    return 'NORMAL';
}
/**
 * Inspection technique approfondie via ffprobe en JSON
 */
export async function probeMediaFile(filePath) {
    try {
        const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', filePath], { timeout: 7000 });
        const data = JSON.parse(stdout);
        const duration = data.format?.duration ? parseFloat(data.format.duration) : undefined;
        const containerTitle = data.format?.tags?.title || data.format?.tags?.TITLE;
        let videoCodec;
        let videoWidth;
        let videoHeight;
        let videoQuality;
        let aspectRatio;
        const audioTracks = [];
        const subtitleTracks = [];
        for (const st of data.streams || []) {
            if (st.codec_type === 'video' && !videoCodec) {
                videoCodec = st.codec_name;
                videoWidth = st.width;
                videoHeight = st.height;
                aspectRatio = st.display_aspect_ratio || (videoWidth && videoHeight ? `${videoWidth}:${videoHeight}` : undefined);
                if (videoHeight) {
                    if (videoHeight >= 2100)
                        videoQuality = '2160p';
                    else if (videoHeight >= 1000)
                        videoQuality = '1080p';
                    else if (videoHeight >= 700)
                        videoQuality = '720p';
                    else
                        videoQuality = '480p';
                }
            }
            else if (st.codec_type === 'audio') {
                const lang = st.tags?.language || st.tags?.LANGUAGE;
                audioTracks.push({
                    language: lang ? lang.slice(0, 3).toLowerCase() : undefined,
                    codec: st.codec_name,
                    channels: st.channels,
                });
            }
            else if (st.codec_type === 'subtitle') {
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
        const chapters = (data.chapters || []).map((ch) => {
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
    }
    catch {
        return null;
    }
}
