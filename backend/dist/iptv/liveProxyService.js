import { getSafeOutboundUrl, safeFetch } from '../utils/safeUrl.js';
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
/**
 * Proxy live IPTV streams (HLS/m3u8) with full CORS, HTTPS URL rewriting,
 * and robust error isolation preventing Mixed Content and CORS leakage.
 */
export async function proxyLiveStream(c, streamUrl) {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, Authorization');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    const safeUrl = getSafeOutboundUrl(streamUrl, { allowPrivate: true, allowHttp: true });
    if (!safeUrl) {
        return c.json({ error: 'URL de flux refusée par la politique de sécurité', code: 'UNSAFE_URL' }, 400);
    }
    try {
        const upstreamHeaders = {
            'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
            'Accept': '*/*',
        };
        const range = c.req.header('range');
        if (range)
            upstreamHeaders['Range'] = range;
        const upstreamRes = await safeFetch(safeUrl.toString(), { allowPrivate: true, allowHttp: true }, { headers: upstreamHeaders, signal: AbortSignal.timeout(15000) });
        if (!upstreamRes.ok) {
            const status = upstreamRes.status;
            const statusText = status === 403
                ? 'Accès refusé par le diffuseur source (HTTP 403 Forbidden)'
                : status === 404
                    ? 'Flux introuvable sur le serveur source (HTTP 404 Not Found)'
                    : `Erreur diffuseur source (HTTP ${status})`;
            return c.json({
                error: `Diffusion en direct indisponible : ${statusText}.`,
                code: 'UPSTREAM_STREAM_ERROR',
                upstreamStatus: status,
                sourceHost: safeUrl.host,
            }, 502);
        }
        const contentType = upstreamRes.headers.get('content-type') || '';
        const isM3u8 = contentType.includes('mpegurl') || streamUrl.endsWith('.m3u8') || streamUrl.includes('m3u8') || contentType.includes('text');
        if (isM3u8) {
            // Les URLs de segments réécrites doivent conserver l'authentification du
            // manifeste : sinon le proxy (désormais protégé) refuserait chaque segment.
            const authParams = new URLSearchParams();
            for (const key of ['token', 'auth', 'share', 'share_token']) {
                const value = c.req.query(key);
                if (value)
                    authParams.set(key, value);
            }
            const authQuery = authParams.toString();
            const buildProxyUrl = (absoluteUrl) => `/api/iptv/proxy?url=${encodeURIComponent(absoluteUrl)}${authQuery ? `&${authQuery}` : ''}`;
            const contentLength = parseInt(upstreamRes.headers.get('content-length') || '0', 10);
            if (contentLength > MAX_MANIFEST_BYTES) {
                return c.json({ error: 'Manifeste HLS trop volumineux', code: 'UPSTREAM_MANIFEST_TOO_LARGE' }, 502);
            }
            const manifestText = await upstreamRes.text();
            if (manifestText.length > MAX_MANIFEST_BYTES) {
                return c.json({ error: 'Manifeste HLS trop volumineux', code: 'UPSTREAM_MANIFEST_TOO_LARGE' }, 502);
            }
            // Résoudre les URLs relatives par rapport à l'URL FINALE (après
            // redirections éventuelles), sinon les segments peuvent pointer vers le
            // mauvais hôte.
            const baseUrl = new URL(upstreamRes.url || safeUrl.toString());
            const rewritten = manifestText
                .split('\n')
                .map((line) => {
                const trimmed = line.trim();
                if (!trimmed)
                    return line;
                if (trimmed.startsWith('#')) {
                    // Réécrire les URI="..." relatives contenues dans les en-têtes HLS (#EXT-X-MEDIA, #EXT-X-MAP, #EXT-X-KEY)
                    return line.replace(/URI=["']([^"']+)["']/g, (match, relUri) => {
                        try {
                            const absUri = new URL(relUri, baseUrl).toString();
                            return `URI="${buildProxyUrl(absUri)}"`;
                        }
                        catch {
                            return match;
                        }
                    });
                }
                try {
                    const absUrl = new URL(trimmed, baseUrl).toString();
                    return buildProxyUrl(absUrl);
                }
                catch {
                    return line;
                }
            })
                .join('\n');
            c.header('Content-Type', 'application/vnd.apple.mpegurl');
            c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            return c.text(rewritten);
        }
        // Flux binaire direct (.ts, audio/video)
        c.header('Content-Type', contentType || 'video/mp2t');
        c.header('Cache-Control', 'public, max-age=3600');
        const upstreamLength = upstreamRes.headers.get('content-length');
        const upstreamRange = upstreamRes.headers.get('content-range');
        const upstreamAcceptRanges = upstreamRes.headers.get('accept-ranges');
        if (upstreamLength)
            c.header('Content-Length', upstreamLength);
        if (upstreamRange)
            c.header('Content-Range', upstreamRange);
        if (upstreamAcceptRanges)
            c.header('Accept-Ranges', upstreamAcceptRanges);
        if (c.req.method === 'HEAD')
            return c.body(null, upstreamRes.status);
        return c.body(upstreamRes.body, upstreamRes.status);
    }
    catch (err) {
        return c.json({
            error: `Délai d'attente dépassé ou diffuseur inaccessible (${err.message || 'Timeout'}).`,
            code: 'UPSTREAM_TIMEOUT',
            sourceHost: safeUrl.host,
        }, 504);
    }
}
