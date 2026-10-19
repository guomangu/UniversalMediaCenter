/**
 * Garde-fous pour les requêtes sortantes (streams IPTV, artworks distants, webhooks).
 *
 * Objectif : empêcher qu'un client puisse utiliser l'API comme proxy SSRF vers
 * des services internes (loopback, link-local, métadonnées cloud, réseaux privés).
 *
 * Les flux IPTV domestiques peuvent légitimement pointer vers une adresse LAN
 * (192.168.x.x, 10.x.x.x, etc.). On autorise donc ces plages par défaut pour les
 * flux, tout en bloquant systématiquement le loopback, le link-local et les
 * endpoints de métadonnées cloud.
 */

const ALWAYS_BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

export interface SafeUrlOptions {
  /** Autorise les plages RFC1918 (réseau local). Par défaut : false. */
  allowPrivate?: boolean;
  /** Autorise HTTP en plus de HTTPS. Par défaut : true (IPTV locale). */
  allowHttp?: boolean;
}

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return NaN;
    return Number(p);
  });
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isAlwaysBlockedIPv4([a, b]: number[]): boolean {
  // Loopback 127.0.0.0/8
  if (a === 127) return true;
  // Link-local 169.254.0.0/16 (inclut 169.254.169.254 des métadonnées cloud)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  // Multicast / réservé
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv4([a, b]: number[]): boolean {
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // CGNAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;
  // Bancs de test 198.18.0.0/15
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

function ipv4FromMappedIpv6(hostname: string): string | null {
  // ::ffff:192.168.1.1 ou ::ffff:c0a8:0101
  const lower = hostname.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;
  const rest = lower.slice('::ffff:'.length);
  if (rest.includes('.')) return rest;
  const hex = rest.split(':').filter(Boolean);
  if (hex.length !== 2) return null;
  const hi = parseInt(hex[0], 16);
  const lo = parseInt(hex[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

function isAlwaysBlockedIPv6(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  // Link-local fe80::/10
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // ULA fc00::/7 (réseau privé IPv6)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // Métadonnées AWS IPv6
  if (lower === 'fd00:ec2::254') return true;
  return false;
}

/**
 * Analyse une URL et retourne null si elle est interdite.
 */
export function getSafeOutboundUrl(raw: string, options: SafeUrlOptions = {}): URL | null {
  const { allowPrivate = false, allowHttp = true } = options;
  if (!raw || typeof raw !== 'string') return null;
  if (raw.length > 8192) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
    return null;
  }

  const rawHostname = parsed.hostname.toLowerCase();
  // Un point final (FQDN) ne doit pas permettre de contourner les listes noires.
  const hostname = stripIpv6Brackets(rawHostname).replace(/\.$/, '');

  if (!hostname) return null;

  // Une forme entièrement numérique (ex: 2130706433) est une représentation
  // alternative d'IPv4 : on la refuse pour éviter un contournement SSRF.
  if (/^\d+$/.test(hostname)) return null;

  if (
    ALWAYS_BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return null;
  }

  const mappedV4 = ipv4FromMappedIpv6(hostname);
  const ipv4 = mappedV4 ? parseIPv4(mappedV4) : parseIPv4(hostname);

  if (ipv4) {
    if (isAlwaysBlockedIPv4(ipv4)) return null;
    if (!allowPrivate && isPrivateIPv4(ipv4)) return null;
    return parsed;
  }

  if (hostname.includes(':')) {
    if (isAlwaysBlockedIPv6(hostname)) return null;
    // Toute adresse IPv6 littérale restante est considérée comme non publique.
    if (!allowPrivate) return null;
  }

  // Un nom d'hôte sans point (ex: "backend", "database") désigne presque toujours
  // un service interne Docker/Kubernetes.
  if (!hostname.includes('.')) return null;

  return parsed;
}

export function isSafeOutboundUrl(raw: string, options: SafeUrlOptions = {}): boolean {
  return getSafeOutboundUrl(raw, options) !== null;
}

/**
 * `fetch` qui valide l'URL initiale ET chaque redirection.
 *
 * Le `fetch` natif suit les redirections automatiquement : sans ce garde-fou,
 * une URL publique pouvait rediriger vers 127.0.0.1 ou 169.254.169.254.
 */
export async function safeFetch(
  raw: string,
  options: SafeUrlOptions = {},
  init: RequestInit = {}
): Promise<Response> {
  let current = getSafeOutboundUrl(raw, options);
  if (!current) {
    throw new Error('URL sortante refusée par la politique de sécurité');
  }

  const MAX_REDIRECTS = 4;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: 'manual' });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) return response;

    // Libérer le corps de la redirection avant de suivre la suivante.
    try {
      await response.body?.cancel();
    } catch {}

    let nextRaw: string;
    try {
      nextRaw = new URL(location, current).toString();
    } catch {
      throw new Error('Redirection sortante invalide');
    }

    const next = getSafeOutboundUrl(nextRaw, options);
    if (!next) {
      throw new Error('Redirection sortante refusée par la politique de sécurité');
    }
    current = next;
  }

  throw new Error('Trop de redirections sortantes');
}
