import { Hono } from 'hono';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Readable } from 'node:stream';
import { checkMediaAccess } from '../auth/mediaAccess.js';
import { proxyLiveStream } from '../iptv/liveProxyService.js';
const execFileAsync = promisify(execFile);
export const streamRouter = new Hono();
const MIME_MAP = {
    '.mp4': 'video/mp4', '.mkv': 'video/mp4', '.webm': 'video/webm',
    '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.ts': 'video/mp2t',
};
const BROWSER_NATIVE_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
const BROWSER_NATIVE_VIDEO_CODECS = ['h264', 'av1', 'vp8', 'vp9'];
const inFlightSegments = new Map();
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
function setStreamCors(c) {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Origin, Range, Content-Type, Accept, Authorization, X-Requested-With');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
}
async function findMediaByIdOrSlug(idOrSlug) {
    if (!idOrSlug)
        return null;
    if (isUuid(idOrSlug)) {
        return await db.query.mediaNodes.findFirst({
            where: (t, { eq }) => eq(t.id, idOrSlug),
        });
    }
    return await db.query.mediaNodes.findFirst({
        where: (t, { eq }) => eq(t.slug, idOrSlug),
    });
}
const probeCache = new Map();
async function getMediaProbe(filePath) {
    const cached = probeCache.get(filePath);
    if (cached)
        return cached;
    const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'stream=index,codec_type,codec_name:stream_tags=language:format=duration',
        '-of', 'json',
        filePath,
    ], { timeout: 10000 });
    const info = JSON.parse(stdout);
    const duration = Math.max(1, parseFloat(info.format?.duration || '0'));
    const streams = info.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const videoCodec = (videoStream?.codec_name || '').toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
    const isVideoNative = BROWSER_NATIVE_VIDEO_CODECS.includes(videoCodec) && ext !== '.avi';
    const audioStreams = streams
        .filter((s) => s.codec_type === 'audio')
        .map((s) => ({
        index: s.index,
        codec: (s.codec_name || '').toLowerCase(),
        language: s.tags?.language,
    }));
    const probe = {
        duration,
        videoCodec,
        isVideoNative,
        audioStreams,
    };
    probeCache.set(filePath, probe);
    return probe;
}
// ---------------------------------------------------------------------------
// HLS VOD Streaming Routes (Zero-latency on-the-fly transcoding for any media)
// ---------------------------------------------------------------------------
streamRouter.options('/:id/hls/:file', (c) => {
    setStreamCors(c);
    return c.body(null, 204);
});
streamRouter.get('/:id/hls/:file', async (c) => {
    setStreamCors(c);
    const id = c.req.param('id');
    const file = c.req.param('file') || '';
    const user = c.get('user');
    const shareToken = c.req.query('share');
    const queryToken = c.req.query('token') || c.req.query('auth');
    const targetAudio = c.req.query('audio') || 'auto';
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    // Chaînes TV en direct
    if (media.nodeType === 'LIVE_CHANNEL' && media.streamUrl) {
        return await proxyLiveStream(c, media.streamUrl);
    }
    const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
        videoFilePath: media.videoFilePath,
        nfoFilePath: media.nfoFilePath,
        searchVectorText: media.searchVectorText,
    });
    if (!isAuthorized) {
        return c.json({
            error: user ? "Accès refusé pour votre profil" : 'Connexion requise',
            code: user ? 'FORBIDDEN' : 'UNAUTHORIZED',
        }, user ? 403 : 401);
    }
    if (!media.videoFilePath || !fs.existsSync(media.videoFilePath)) {
        return c.json({ error: 'Fichier vidéo introuvable sur le disque', code: 'FILE_INACCESSIBLE' }, 404);
    }
    let probe;
    try {
        probe = await getMediaProbe(media.videoFilePath);
    }
    catch (err) {
        return c.json({ error: 'Erreur analyse média', details: err?.message }, 500);
    }
    // 1. Fichier Manifeste Master M3U8
    if (file === 'master.m3u8') {
        const tokenParam = queryToken ? `&token=${encodeURIComponent(queryToken)}` : '';
        const shareParam = shareToken ? `&share=${encodeURIComponent(shareToken)}` : '';
        const segmentDuration = 6.0;
        const totalSegments = Math.max(1, Math.ceil(probe.duration / segmentDuration));
        let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:7\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n';
        for (let i = 0; i < totalSegments; i++) {
            const isLast = i === totalSegments - 1;
            const dur = isLast ? Math.max(0.1, Number((probe.duration - i * segmentDuration).toFixed(3))) : segmentDuration;
            manifest += `#EXTINF:${dur.toFixed(3)},\n`;
            manifest += `/api/media/${media.id}/hls/segment_${i}.ts?audio=${encodeURIComponent(targetAudio)}${tokenParam}${shareParam}\n`;
        }
        manifest += '#EXT-X-ENDLIST\n';
        c.header('Content-Type', 'application/vnd.apple.mpegurl');
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        return c.text(manifest);
    }
    // 2. Segments Vidéo TS
    if (file.startsWith('segment_') && file.endsWith('.ts')) {
        const indexStr = file.slice('segment_'.length, -'.ts'.length);
        const index = parseInt(indexStr, 10);
        if (isNaN(index) || index < 0)
            return c.text('Invalid segment index', 400);
        const cacheDir = '/tmp/ums_cache/segments';
        const segFile = path.join(cacheDir, `${media.id}_a${targetAudio}_seg${index}.ts`);
        if (!fs.existsSync(segFile)) {
            if (!inFlightSegments.has(segFile)) {
                const segPromise = (async () => {
                    await fsp.mkdir(cacheDir, { recursive: true });
                    const tempSeg = `${segFile}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.ts`;
                    const startTime = index * 6;
                    let resolvedAudio = targetAudio;
                    if (!resolvedAudio || resolvedAudio === 'auto') {
                        const firstNative = probe.audioStreams.find((s) => BROWSER_NATIVE_AUDIO_CODECS.includes(s.codec));
                        resolvedAudio = String(firstNative ? firstNative.index : (probe.audioStreams[0]?.index ?? 1));
                    }
                    const selectedAudioStream = probe.audioStreams.find((s) => String(s.index) === String(resolvedAudio));
                    const isAudioNative = selectedAudioStream ? BROWSER_NATIVE_AUDIO_CODECS.includes(selectedAudioStream.codec) : false;
                    const ffmpegArgs = [
                        '-ss', String(startTime),
                        '-i', media.videoFilePath,
                        '-t', '6.05',
                        '-map', '0:v:0',
                        '-map', `0:${resolvedAudio}`,
                        ...(probe.isVideoNative
                            ? ['-c:v', 'copy']
                            : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p']),
                        ...(isAudioNative
                            ? ['-c:a', 'copy']
                            : ['-c:a', 'aac', '-b:a', '192k', '-ac', '2']),
                        '-f', 'mpegts',
                        '-y',
                        tempSeg,
                    ];
                    try {
                        await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 20000 });
                        if (fs.existsSync(tempSeg)) {
                            await fsp.rename(tempSeg, segFile);
                        }
                    }
                    catch (err) {
                        console.error(`Erreur génération segment HLS ${segFile}:`, err);
                    }
                    finally {
                        inFlightSegments.delete(segFile);
                    }
                    return segFile;
                })();
                inFlightSegments.set(segFile, segPromise);
            }
            await inFlightSegments.get(segFile);
        }
        if (fs.existsSync(segFile)) {
            const stat = await fsp.stat(segFile);
            c.header('Content-Type', 'video/mp2t');
            c.header('Content-Length', String(stat.size));
            c.header('Cache-Control', 'public, max-age=86400');
            if (c.req.method === 'HEAD')
                return c.body(null, 200);
            const stream = fs.createReadStream(segFile);
            return c.body(Readable.toWeb(stream), 200);
        }
        return c.text('Segment generation failed', 500);
    }
    return c.text('File not found', 404);
});
// ---------------------------------------------------------------------------
// Standard Direct Byte-Range Streaming Route
// ---------------------------------------------------------------------------
streamRouter.options('/:id/stream', (c) => {
    setStreamCors(c);
    return c.body(null, 204);
});
streamRouter.on(['GET', 'HEAD'], '/:id/stream', async (c) => {
    setStreamCors(c);
    const id = c.req.param('id');
    const user = c.get('user');
    const shareToken = c.req.query('share');
    const audio = c.req.query('audio');
    const media = await findMediaByIdOrSlug(id);
    if (!media)
        return c.json({ error: 'Média introuvable' }, 404);
    // Chaînes TV en direct ou flux externes
    if (media.nodeType === 'LIVE_CHANNEL' && media.streamUrl) {
        return await proxyLiveStream(c, media.streamUrl);
    }
    const isAuthorized = checkMediaAccess(user, media.id, shareToken, media.parentId, media.nodeType, {
        videoFilePath: media.videoFilePath,
        nfoFilePath: media.nfoFilePath,
        searchVectorText: media.searchVectorText,
    });
    if (!isAuthorized) {
        return c.json({
            error: user ? "Accès refusé pour votre profil" : 'Connexion requise',
            code: user ? 'FORBIDDEN' : 'UNAUTHORIZED',
        }, user ? 403 : 401);
    }
    if (media.streamUrl) {
        return await proxyLiveStream(c, media.streamUrl);
    }
    if (!media.videoFilePath || !fs.existsSync(media.videoFilePath)) {
        return c.json({ error: 'Fichier vidéo absent ou introuvable', code: 'FILE_INACCESSIBLE' }, 404);
    }
    let activeFilePath = media.videoFilePath;
    const originalExt = path.extname(activeFilePath).toLowerCase();
    // Vérification de l'intégrité minimale du conteneur
    try {
        const fh = await fsp.open(activeFilePath, 'r');
        const headerBuf = Buffer.alloc(16);
        await fh.read(headerBuf, 0, 16, 0);
        await fh.close();
        const isAllZero = headerBuf.subarray(0, 4).every((b) => b === 0);
        const isCorruptMkv = originalExt === '.mkv' && headerBuf.subarray(0, 4).toString('hex') !== '1a45dfa3';
        if (isAllZero || isCorruptMkv) {
            await db.execute(sql `UPDATE media_nodes SET state = 'ERROR' WHERE id = ${media.id}`);
            return c.json({
                error: "Ce fichier vidéo est incomplet ou corrompu sur le disque de stockage.",
                code: 'CORRUPTED_FILE',
            }, 422);
        }
    }
    catch {
        return c.json({ error: 'Fichier vidéo inaccessible ou introuvable sur le disque', code: 'FILE_INACCESSIBLE' }, 404);
    }
    // Sonde de compatibilité navigateur pour orienter vers HLS si nécessaire (.avi, HEVC, audio non-native)
    let probe = null;
    try {
        probe = await getMediaProbe(activeFilePath);
    }
    catch { }
    const isVideoNative = probe ? probe.isVideoNative : (originalExt !== '.avi');
    let isAudioNative = true;
    if (probe) {
        const targetA = audio && audio !== 'auto' ? audio : '0';
        const stream = probe.audioStreams.find((s) => String(s.index) === String(targetA)) || probe.audioStreams[0];
        if (stream) {
            isAudioNative = BROWSER_NATIVE_AUDIO_CODECS.includes(stream.codec);
        }
    }
    // Si le média nécessite un transcodage (ex: .avi, hevc, dts/ac3), rediriger vers le flux HLS on-the-fly
    if (!isVideoNative || !isAudioNative || originalExt === '.avi') {
        const p = new URLSearchParams();
        if (audio)
            p.set('audio', audio);
        if (shareToken)
            p.set('share', shareToken);
        const token = c.req.query('token') || c.req.query('auth');
        if (token)
            p.set('token', token);
        const qs = p.toString();
        return c.redirect(`/api/media/${media.id}/hls/master.m3u8${qs ? `?${qs}` : ''}`, 307);
    }
    const stat = await fsp.stat(activeFilePath);
    const fileSize = stat.size;
    const currentExt = path.extname(activeFilePath).toLowerCase();
    const mimeType = MIME_MAP[currentExt] || 'video/mp4';
    const range = c.req.header('range');
    const isHead = c.req.method === 'HEAD';
    if (!range) {
        c.header('Content-Type', mimeType);
        c.header('Content-Length', String(fileSize));
        c.header('Accept-Ranges', 'bytes');
        if (isHead)
            return c.body(null, 200);
        const stream = fs.createReadStream(activeFilePath);
        return c.body(Readable.toWeb(stream), 200);
    }
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize || end >= fileSize) {
        c.header('Content-Range', `bytes */${fileSize}`);
        return c.body(null, 416);
    }
    const chunksize = end - start + 1;
    c.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    c.header('Accept-Ranges', 'bytes');
    c.header('Content-Length', String(chunksize));
    c.header('Content-Type', mimeType);
    if (isHead)
        return c.body(null, 206);
    const stream = fs.createReadStream(activeFilePath, { start, end });
    return c.body(Readable.toWeb(stream), 206);
});
