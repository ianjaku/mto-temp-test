export function checkLanguageAvailability(
    supportedLanguagesMap: { [engineType: string]: string[] },
    langCode: string,
    opposingLangCode: string
): boolean {
    if (supportedLanguagesMap) {
        for (const engine in supportedLanguagesMap) {
            const languages = supportedLanguagesMap[engine]
            if (languages.includes(langCode) && languages.includes(opposingLangCode)) {
                return true;
            }
        }
    }
    return false;
}