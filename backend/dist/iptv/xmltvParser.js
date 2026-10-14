import { XMLParser } from 'fast-xml-parser';
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['programme', 'channel'].includes(name),
});
export function parseXmltvContent(xmlContent) {
    const result = parser.parse(xmlContent);
    const tv = result.tv || {};
    const rawPrograms = tv.programme || [];
    return rawPrograms.map((p) => {
        const rawStart = p['@_start'] || '';
        const rawStop = p['@_stop'] || '';
        // Format XMLTV standard: YYYYMMDDHHMMSS +ZZZZ
        const parseDate = (dStr) => {
            if (dStr.length >= 14) {
                const year = dStr.slice(0, 4);
                const month = dStr.slice(4, 6);
                const day = dStr.slice(6, 8);
                const hour = dStr.slice(8, 10);
                const min = dStr.slice(10, 12);
                const sec = dStr.slice(12, 14);
                return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
            }
            return new Date();
        };
        const title = typeof p.title === 'string' ? p.title : p.title?.['#text'] || 'Programme';
        const desc = typeof p.desc === 'string' ? p.desc : p.desc?.['#text'];
        const cat = typeof p.category === 'string' ? p.category : p.category?.['#text'];
        return {
            channelId: p['@_channel'] || '',
            title,
            description: desc,
            category: cat,
            start: parseDate(rawStart),
            stop: parseDate(rawStop),
        };
    });
}
