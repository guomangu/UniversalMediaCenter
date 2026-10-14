export interface ParsedM3uChannel {
  name: string;
  streamUrl: string;
  tvgId?: string;
  tvgName?: string;
  logoUrl?: string;
  groupTitle?: string;
  country?: string;
  language?: string;
}

export function parseM3uContent(content: string): ParsedM3uChannel[] {
  const lines = content.split('\n');
  const channels: ParsedM3uChannel[] = [];
  let currentInfo: Partial<ParsedM3uChannel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      currentInfo = {};

      // Extraction des attributs tvg-
      const idMatch = line.match(/tvg-id="([^"]*)"/i);
      if (idMatch) currentInfo.tvgId = idMatch[1];

      const nameMatch = line.match(/tvg-name="([^"]*)"/i);
      if (nameMatch) currentInfo.tvgName = nameMatch[1];

      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      if (logoMatch) currentInfo.logoUrl = logoMatch[1];

      const groupMatch = line.match(/group-title="([^"]*)"/i);
      if (groupMatch) currentInfo.groupTitle = groupMatch[1];

      const countryMatch = line.match(/tvg-country="([^"]*)"/i);
      if (countryMatch) currentInfo.country = countryMatch[1];

      const langMatch = line.match(/tvg-language="([^"]*)"/i);
      if (langMatch) currentInfo.language = langMatch[1];

      // Extraction du nom affiché (après la dernière virgule)
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentInfo.name = line.substring(commaIndex + 1).trim();
      }
    } else if (line && !line.startsWith('#') && currentInfo) {
      currentInfo.streamUrl = line;
      if (currentInfo.name && currentInfo.streamUrl) {
        channels.push({
          name: currentInfo.name,
          streamUrl: currentInfo.streamUrl,
          tvgId: currentInfo.tvgId,
          tvgName: currentInfo.tvgName,
          logoUrl: currentInfo.logoUrl,
          groupTitle: currentInfo.groupTitle,
          country: currentInfo.country,
          language: currentInfo.language,
        });
      }
      currentInfo = null;
    }
  }

  return channels;
}
