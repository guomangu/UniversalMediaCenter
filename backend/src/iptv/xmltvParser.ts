import { XMLParser } from 'fast-xml-parser';

export interface ParsedEpgChannel {
  id: string;
  displayName?: string;
  iconUrl?: string;
}

export interface ParsedEpgProgram {
  channelId: string;
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  iconUrl?: string;
  start: Date;
  stop: Date;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['programme', 'channel', 'category', 'display-name', 'icon'].includes(name),
});

/** Extrait une valeur texte d'un nœud XMLTV (string, nombre ou objet `#text`). */
function readText(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const text = readText(entry);
      if (text) return text;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    if (value['#text'] !== undefined) return readText(value['#text']);
  }
  return undefined;
}

/** Extrait l'URL d'icône d'un nœud XMLTV. */
function readIcon(value: any): string | undefined {
  if (!value) return undefined;
  const first = Array.isArray(value) ? value[0] : value;
  const src = first?.['@_src'];
  return typeof src === 'string' && src.trim() ? src.trim() : undefined;
}

/**
 * Convertit une date XMLTV (`YYYYMMDDHHMMSS +ZZZZ`) en Date UTC.
 *
 * Le format XMLTV exprime une heure locale accompagnée de son décalage. La
 * version précédente ajoutait un `Z` sans appliquer le décalage, ce qui
 * décalait toute la grille de plusieurs heures pour les flux non-UTC.
 */
export function parseXmltvDate(raw: string): Date | null {
  if (!raw) return null;
  const match = raw
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{2}:?\d{2})?$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, offset] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second || '0')
  );

  let offsetMinutes = 0;
  if (offset) {
    const normalized = offset.replace(':', '');
    const sign = normalized.startsWith('-') ? -1 : 1;
    const hours = Number(normalized.slice(1, 3));
    const minutes = Number(normalized.slice(3, 5));
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  const date = new Date(utcMillis - offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseXmltvChannels(xmlContent: string): ParsedEpgChannel[] {
  const result = parser.parse(xmlContent);
  const rawChannels = result.tv?.channel || [];

  return rawChannels
    .map((channel: any) => ({
      id: String(channel['@_id'] || '').trim(),
      displayName: readText(channel['display-name']),
      iconUrl: readIcon(channel.icon),
    }))
    .filter((channel: ParsedEpgChannel) => Boolean(channel.id));
}

export function parseXmltvContent(xmlContent: string): ParsedEpgProgram[] {
  const result = parser.parse(xmlContent);
  const rawPrograms = result.tv?.programme || [];
  const programs: ParsedEpgProgram[] = [];

  for (const p of rawPrograms) {
    const channelId = String(p['@_channel'] || '').trim();
    const start = parseXmltvDate(p['@_start'] || '');
    const stop = parseXmltvDate(p['@_stop'] || '');
    const title = readText(p.title);

    // Un programme sans chaîne, sans titre ou sans horaires exploitables ne
    // peut pas être affiché dans la grille : on l'ignore proprement au lieu
    // d'insérer une ligne vide à la date du jour.
    if (!channelId || !title || !start || !stop || stop.getTime() <= start.getTime()) {
      continue;
    }

    const categoryNode = Array.isArray(p.category) ? p.category[0] : p.category;

    programs.push({
      channelId,
      title,
      subtitle: readText(p['sub-title']),
      description: readText(p.desc),
      category: readText(categoryNode),
      iconUrl: readIcon(p.icon),
      start,
      stop,
    });
  }

  return programs;
}
