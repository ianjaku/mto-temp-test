import { UNDEFINED_LANG, UNDEFINED_LANG_UI } from "../util/languages";
import getDialects from "./dialects"

/*
* If you change the below, make sure the import works from the editor and from the playwright tests
*/
// import iso6391 from "iso-639-1";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const iso6391Module = require("iso-639-1");
const iso6391 = iso6391Module.default ?? iso6391Module;


const RTL_MAP = {
    "ar":1,
    "dv":1,
    "fa":1,
    "ha":1,
    "he":1,
    "ks":1,
    "ku":1,
    "ps":1,
    "ur":1,
    "yi":1
};

const getAllDialects = (includeGhentianDialect = false) => {
    const allDialects = getDialects(includeGhentianDialect);
    return Object.keys(allDialects).reduce((reduced, languageCode) => {
        return {
            ...reduced,
            ...allDialects[languageCode],
        }
    }, {});
}

export interface ILanguageInfo {
    iso639_1: string;
    name: string;
    nativeName: string;
    direction: "rtl" | "ltr";
}

function langInfo(code: string): ILanguageInfo {
    const name = iso6391.getName(code);
    const nativeName = iso6391.getNativeName(code);
    const iso639_1 = code;
    const direction = RTL_MAP[code] ? "rtl" : "ltr";
    return {
        direction,
        iso639_1,
        name,
        nativeName
    }
}

export const getLanguageInfo = (code: string): ILanguageInfo => {
    if (code === UNDEFINED_LANG) {
        return {
            iso639_1: "xx",
            name: UNDEFINED_LANG_UI,
            nativeName: UNDEFINED_LANG_UI,
            direction: "ltr"
        }
    }
    return !isDialect(code) ? langInfo(code) : getAllDialects(true)[code]
};

export function getLanguageName(code: string): string {
    return (getLanguageInfo(code)?.name) || code;
}

export const toLanguageLabel = (code: string): string => {
    const { name, nativeName } = getLanguageInfo(code);
    return nativeName === name ? name : `${name} / ${nativeName}`;
};

export const getLanguageLabel = (code: string, includeNative: boolean): string => {
    const { name, nativeName } = getLanguageInfo(code);
    return `${name}${includeNative && (nativeName !== name) ? ` / ${nativeName}` : ""}`;
};

export const getAllLanguageCodes = (includeDialects = false, includeGhentianDialect = false): string[] => {
    const allCodes = iso6391.getAllCodes();
    if (!includeDialects) {
        return allCodes;
    }
    const dialects = getDialects(includeGhentianDialect);
    return allCodes.concat(...Object.keys(dialects).reduce((prev, d) => [...prev, ...Object.keys(dialects[d])], []));
}

export function getLanguageNativeName(code: string): string {
    return (getLanguageInfo(code)?.nativeName) || code;
}

export const isDialect = (code: string): boolean => code.indexOf("-") > -1;


export const isLanguageRTL = (code: string): boolean => {
    const info = getLanguageInfo(code);
    return info.direction === "rtl";
}