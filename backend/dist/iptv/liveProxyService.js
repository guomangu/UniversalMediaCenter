/**
 * Proxy live IPTV streams (HLS/m3u8) with CORS, manifest URL rewriting,
 * and robust error isolation preventing client-side raw HTTP/403 leakage.
 */
export async function proxyLiveStream(c, streamUrl) {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
    try {
        const upstreamRes = await fetch(streamUrl, {
            headers: {
                'User-Agent': 'UniversalMediaStack/3.0 (compatible; VLC/3.0.18)',
                'Accept': '*/*',
            },
            signal: AbortSignal.timeout(8000),
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
                            return `URI="${new URL(relUri, baseUrl).toString()}"`;
                        }
                        catch {
                            return match;
                        }
                    });
                }
                try {
                    return new URL(trimmed, baseUrl).toString();
                }
                catch {
                    return line;
                }
            })
                .join('\n');
            c.header('Content-Type', 'application/vnd.apple.mpegurl');
            c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
            return c.body(rewritten);
        }
        // For direct binary streams, redirect or pipe
        return c.redirect(streamUrl, 302);
    }
    catch (err) {
        return c.json({
            error: `Délai d'attente dépassé ou diffuseur inaccessible (${err.message || 'Timeout'}).`,
            code: 'UPSTREAM_TIMEOUT',
            sourceUrl: streamUrl,
        }, 504);
    }
}
