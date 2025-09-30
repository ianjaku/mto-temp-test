export function languageCodesInclude(
    languageCodes: string[],
    languageCodeToTest: string,
    langCodeToTestCanBeDialect?: boolean,
): boolean {
    const languageCode = langCodeToTestCanBeDialect ?
        languageCodeToTest.split("-")[0] :
        languageCodeToTest;
    return languageCodes.includes(languageCode);
}

export function isDialect(languageCode: string): boolean {
    return languageCode && languageCode.includes("-");
}

// sort languageCodes putting the standard ones last
export function byDialectPresence(languageCode1: string, languageCode2: string): number {
    if (isDialect(languageCode1) && !isDialect(languageCode2)) {
        return -1;
    }
    if (!isDialect(languageCode1) && isDialect(languageCode2)) {
        return 1;
    }
    return 0;
}