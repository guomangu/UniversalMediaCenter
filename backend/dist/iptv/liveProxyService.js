/**
 * Proxy live IPTV streams (HLS/m3u8) with full CORS, HTTPS URL rewriting,
 * and robust error isolation preventing Mixed Content and CORS leakage.
 */
export async function proxyLiveStream(c, streamUrl) {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, Authorization');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    try {
        const upstreamRes = await fetch(streamUrl, {
            headers: {
                'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(9000),
        });
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
                sourceUrl: streamUrl,
            }, 502);
        }
        const contentType = upstreamRes.headers.get('content-type') || '';
        const isM3u8 = contentType.includes('mpegurl') || streamUrl.endsWith('.m3u8') || streamUrl.includes('m3u8') || contentType.includes('text');
        if (isM3u8) {
            const manifestText = await upstreamRes.text();
            const baseUrl = new URL(streamUrl);
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
                            return `URI="/api/iptv/proxy?url=${encodeURIComponent(absUri)}"`;
                        }
                        catch {
                            return match;
                        }
                    });
                }
                try {
                    const absUrl = new URL(trimmed, baseUrl).toString();
                    return `/api/iptv/proxy?url=${encodeURIComponent(absUrl)}`;
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
        return c.body(upstreamRes.body);
    }
    catch (err) {
        return c.json({
            error: `Délai d'attente dépassé ou diffuseur inaccessible (${err.message || 'Timeout'}).`,
            code: 'UPSTREAM_TIMEOUT',
            sourceUrl: streamUrl,
        }, 504);
    }
}
