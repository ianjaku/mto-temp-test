import { getAllLanguageCodes, getLanguageInfo } from "@binders/client/lib/languages/helper";
let languageInfoCache = new Map();

function getCachedLanguageInfo(languageCode) {
    let languageInfo = languageInfoCache.get(languageCode);
    if (languageInfo === undefined || Object.keys(languageInfo).length === 0) {
        languageInfo = getLanguageInfo(languageCode);
        languageInfoCache.set(languageCode, languageInfo);
    }
    return languageInfo;
}

export function getLanguageLabel(languageCode) {
    const info = getCachedLanguageInfo(languageCode);
    if (info.nativeName === info.name) {
        return info.name;
    }
    return `${info.nativeName} / ${info.name}`;
}

const toLanguageLabel = (code) => {
    const { name, nativeName } = getLanguageInfo(code);
    return nativeName === name ? name : `${name} / ${nativeName}`;
};

const compareLanguageLabels = (l1, l2) => l1.label < l2.label ? -1 : 1;

export const setupLanguages = (languageCodesToOmit = []) => {
    return getAllLanguageCodes().reduce((reduced, languageCode) => {
        if (languageCodesToOmit.indexOf(languageCode) === -1) {
            reduced.push({ id: languageCode, value: languageCode, label: toLanguageLabel(languageCode) });
        }
        return reduced;
    }, []).sort(compareLanguageLabels);
};
