export function generateSlug(text) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function sanitizeText(value) {
    if (value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'object')
        return JSON.stringify(value);
    return String(value).trim();
}
