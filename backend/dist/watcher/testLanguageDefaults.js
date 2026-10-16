import assert from 'node:assert';
import { normalizeLangCode, matchesLanguagePreference, } from '../routes/mediaTracks.js';
console.log('🧪 Testing Language and Subtitle Fallback Engine...');
// 1. Language Normalization & Mapping
assert.strictEqual(normalizeLangCode('fra'), 'fra');
assert.strictEqual(normalizeLangCode('fre'), 'fra');
assert.strictEqual(normalizeLangCode('fr'), 'fra');
assert.strictEqual(normalizeLangCode('French'), 'fra');
assert.strictEqual(normalizeLangCode('Français'), 'fra');
assert.strictEqual(normalizeLangCode('eng'), 'eng');
assert.strictEqual(normalizeLangCode('en'), 'eng');
assert.strictEqual(normalizeLangCode('English'), 'eng');
assert.strictEqual(normalizeLangCode('jpn'), 'jpn');
assert.strictEqual(normalizeLangCode('ja'), 'jpn');
assert.strictEqual(normalizeLangCode('Japanese'), 'jpn');
console.log('  ✅ normalizeLangCode passed');
// 2. Language Preference Matching
assert.strictEqual(matchesLanguagePreference('fra', 'Français (AC3)', 'fra'), true);
assert.strictEqual(matchesLanguagePreference('fre', 'French (AAC)', 'fra'), true);
assert.strictEqual(matchesLanguagePreference('fr', 'Français', 'fra'), true);
assert.strictEqual(matchesLanguagePreference('eng', 'English (E-AC3)', 'fra'), false);
assert.strictEqual(matchesLanguagePreference('eng', 'English (E-AC3)', 'fra, eng'), true);
assert.strictEqual(matchesLanguagePreference('und', 'VF French Dub', 'fra'), true);
console.log('  ✅ matchesLanguagePreference passed');
// 3. Fallback scenario test function
function computeTrackDefaults(audioTracks, subtitleTracks, prefAudio, prefSub, subMode) {
    const matchedAudio = audioTracks.find((t) => matchesLanguagePreference(t.language, t.label, prefAudio));
    const isDefaultAudioAvailable = Boolean(matchedAudio);
    const defaultAudioTrack = matchedAudio ? String(matchedAudio.index) : 'auto';
    const matchedSubtitle = subtitleTracks.find((s) => matchesLanguagePreference(s.language, s.fileName || s.label, prefSub));
    let defaultSubtitle = 'off';
    let subtitleFallbackTriggered = false;
    if (subMode === 'always') {
        if (matchedSubtitle) {
            defaultSubtitle = matchedSubtitle.fileName ? `file:${matchedSubtitle.fileName}` : `track:${matchedSubtitle.index}`;
        }
    }
    else if (subMode === 'fallback_if_audio_missing') {
        if (!isDefaultAudioAvailable && matchedSubtitle) {
            defaultSubtitle = matchedSubtitle.fileName ? `file:${matchedSubtitle.fileName}` : `track:${matchedSubtitle.index}`;
            subtitleFallbackTriggered = true;
        }
    }
    return { defaultAudioTrack, defaultSubtitle, isDefaultAudioAvailable, subtitleFallbackTriggered };
}
// Scenario A: French audio present -> French audio selected, subtitles remain OFF
const sampleA_audio = [
    { index: 1, language: 'eng', codec: 'eac3', label: 'English (EAC3)' },
    { index: 2, language: 'fra', codec: 'ac3', label: 'Français (AC3)' },
];
const sampleA_subs = [
    { index: 3, language: 'fra', label: 'Français (Intégré)' },
];
const resA = computeTrackDefaults(sampleA_audio, sampleA_subs, 'fra', 'fra', 'fallback_if_audio_missing');
assert.strictEqual(resA.isDefaultAudioAvailable, true);
assert.strictEqual(resA.defaultAudioTrack, '2');
assert.strictEqual(resA.defaultSubtitle, 'off');
assert.strictEqual(resA.subtitleFallbackTriggered, false);
console.log('  ✅ Scenario A: Default audio found -> Subtitles OFF');
// Scenario B: Only English audio present -> Audio fallback 'auto', Subtitles automatically engaged (VOSTFR)
const sampleB_audio = [
    { index: 1, language: 'eng', codec: 'eac3', label: 'English (EAC3)' },
    { index: 2, language: 'jpn', codec: 'aac', label: 'Japonais (AAC)' },
];
const sampleB_subs = [
    { index: 3, language: 'fra', label: 'Français (Intégré)' },
    { index: -1, language: 'eng', fileName: 'movie.en.srt', label: 'English (movie.en.srt)' },
];
const resB = computeTrackDefaults(sampleB_audio, sampleB_subs, 'fra', 'fra', 'fallback_if_audio_missing');
assert.strictEqual(resB.isDefaultAudioAvailable, false);
assert.strictEqual(resB.defaultAudioTrack, 'auto');
assert.strictEqual(resB.defaultSubtitle, 'track:3');
assert.strictEqual(resB.subtitleFallbackTriggered, true);
console.log('  ✅ Scenario B: Default audio missing -> Subtitles automatically activated (VOSTFR fallback)');
// Scenario C: Japanese anime with external .srt subtitle -> Subtitles auto-engaged with file:
const sampleC_subs = [
    { index: -1, language: 'fra', fileName: 'Anime.E01.VOSTFR.srt', label: 'Français (Anime.E01.VOSTFR.srt)' },
];
const resC = computeTrackDefaults(sampleB_audio, sampleC_subs, 'fra', 'fra', 'fallback_if_audio_missing');
assert.strictEqual(resC.defaultSubtitle, 'file:Anime.E01.VOSTFR.srt');
assert.strictEqual(resC.subtitleFallbackTriggered, true);
console.log('  ✅ Scenario C: External subtitle (.srt file) auto-engaged as file:');
// Scenario D: Subtitle mode ALWAYS -> Subtitles engaged even if French audio is present
const resD = computeTrackDefaults(sampleA_audio, sampleA_subs, 'fra', 'fra', 'always');
assert.strictEqual(resD.isDefaultAudioAvailable, true);
assert.strictEqual(resD.defaultSubtitle, 'track:3');
assert.strictEqual(resD.subtitleFallbackTriggered, false);
console.log('  ✅ Scenario D: Subtitle mode ALWAYS -> Subtitles engaged');
// Scenario E: Subtitle mode NEVER -> Subtitles remain OFF even if French audio is missing
const resE = computeTrackDefaults(sampleB_audio, sampleB_subs, 'fra', 'fra', 'never');
assert.strictEqual(resE.defaultSubtitle, 'off');
assert.strictEqual(resE.subtitleFallbackTriggered, false);
console.log('  ✅ Scenario E: Subtitle mode NEVER -> Subtitles remain OFF');
console.log('🎉 All 5 language and subtitle fallback test scenarios passed successfully!');
process.exit(0);
