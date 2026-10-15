import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
/**
 * Inspection interne du conteneur MKV/MP4 via ffprobe
 * Récupère le vrai titre de l'œuvre dans les propriétés du segment, les IDs injectés et les chapitres.
 */
export async function inspectContainerMetadata(filePath) {
    const result = {
        chapterTitles: [],
        rawTags: {},
    };
    try {
        const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', '-show_chapters', filePath], { timeout: 7000 });
        const data = JSON.parse(stdout);
        const formatTags = data.format?.tags || {};
        result.rawTags = formatTags;
        // 1. Titre interne du conteneur
        const title = formatTags.title || formatTags.TITLE || formatTags.Title;
        if (title && typeof title === 'string' && title.trim().length > 0) {
            result.segmentTitle = title.trim();
            result.suggestedTitle = title.trim();
        }
        // 2. Identifiants IMDb / TMDb / TVDb injectés dans les tags
        const allTagsString = JSON.stringify(formatTags);
        // IMDb (ttXXXXXXX)
        const imdbMatch = /(?:imdb[-_:\s]*id|imdb|tt)[-_:\s]*(tt\d{6,10})/i.exec(allTagsString);
        if (imdbMatch) {
            result.imdbId = imdbMatch[1];
        }
        else if (formatTags.IMDB || formatTags.imdb) {
            const val = String(formatTags.IMDB || formatTags.imdb);
            const m = /(tt\d{6,10})/i.exec(val);
            if (m)
                result.imdbId = m[1];
        }
        // TMDb ID
        const tmdbMatch = /(?:tmdb[-_:\s]*id|tmdb)[-_:\s]*(\d{2,9})/i.exec(allTagsString);
        if (tmdbMatch) {
            result.tmdbId = parseInt(tmdbMatch[1], 10);
        }
        // TVDb ID
        const tvdbMatch = /(?:tvdb[-_:\s]*id|tvdb)[-_:\s]*(\d{2,9})/i.exec(allTagsString);
        if (tvdbMatch) {
            result.tvdbId = parseInt(tvdbMatch[1], 10);
        }
        // 3. Année dans les tags de conteneur
        const dateStr = formatTags.DATE || formatTags.date || formatTags.YEAR || formatTags.year || formatTags.creation_time;
        if (dateStr) {
            const yMatch = /\b(19\d{2}|20\d{2})\b/.exec(String(dateStr));
            if (yMatch) {
                result.releaseYear = parseInt(yMatch[1], 10);
            }
        }
        // 4. Édition ou version dans les streams ou le titre
        const fullText = `${title || ''} ${allTagsString}`;
        if (/director'?s\s*cut/i.test(fullText))
            result.edition = "Director's Cut";
        else if (/extended(?:\s*cut|\s*edition)?/i.test(fullText))
            result.edition = "Extended Edition";
        else if (/remaster(?:ed)?/i.test(fullText))
            result.edition = "Remastered";
        else if (/theatrical/i.test(fullText))
            result.edition = "Theatrical Cut";
        else if (/unrated/i.test(fullText))
            result.edition = "Unrated";
        // 5. Extraction des chapitres nommés
        if (Array.isArray(data.chapters)) {
            for (const ch of data.chapters) {
                const chTitle = ch.tags?.title || ch.tags?.TITLE;
                if (chTitle && typeof chTitle === 'string') {
                    const trimmed = chTitle.trim();
                    // Ignorer les chapitres génériques sous forme de timestamps '00:01:23.456' ou 'Chapter 01'
                    if (!/^\d{2}:\d{2}:\d{2}/.test(trimmed) && trimmed.length > 2) {
                        result.chapterTitles.push(trimmed);
                    }
                }
            }
        }
    }
    catch {
        // Si échec ffprobe, retourner métadonnées vides gracieusement
    }
    return result;
}
