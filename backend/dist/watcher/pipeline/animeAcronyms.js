/**
 * Dictionnaire de remapping sémantique des acronymes d'anime vers leurs titres canoniques
 */
export const ANIME_ACRONYM_MAP = {
    lotgh: 'Legend of the Galactic Heroes',
    'fma:b': 'Fullmetal Alchemist: Brotherhood',
    fmab: 'Fullmetal Alchemist: Brotherhood',
    fma: 'Fullmetal Alchemist',
    kny: 'Kimetsu no Yaiba',
    snk: 'Shingeki no Kyojin',
    aot: 'Attack on Titan',
    hxh: 'Hunter x Hunter',
    sao: 'Sword Art Online',
    jjk: 'Jujutsu Kaisen',
    klk: 'Kill la Kill',
    ttgl: 'Tengen Toppa Gurren Lagann',
    cg: 'Code Geass',
    sel: 'Serial Experiments Lain',
    mha: 'My Hero Academia',
    op: 'One Piece',
    hnk: 'Houseki no Kuni',
    eva: 'Neon Genesis Evangelion',
    nge: 'Neon Genesis Evangelion',
};
/**
 * Traduit un acronyme éventuel en son titre canonique
 */
export function resolveAnimeAcronym(rawTitle) {
    const normalized = rawTitle.trim().toLowerCase();
    if (ANIME_ACRONYM_MAP[normalized]) {
        return ANIME_ACRONYM_MAP[normalized];
    }
    return rawTitle;
}
