import {
    Dispatch,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import Binder from "@binders/client/lib/binders/custom/class";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { byDialectPresence } from "../helpers/language";
import { getBinderPrimaryLanguageCode } from "../helpers/binder";
import { intersection } from "ramda";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";

export default function useInitialComposerView(
    binder: Binder,
    setPrimaryLanguageCode: (code: string) => void,
    setSecondaryLanguageCode: (code: string) => void,
    translatorLanguageCodes: string[],
    setTranslatorNewLangModalVisibility: Dispatch<SetStateAction<boolean>>,
): void {

    const primaryLangCode = useMemo(() => {
        const q = window.location.search;
        const params = new URLSearchParams(q);
        const langCodeParam = params.get("langCode");
        if (langCodeParam?.length && binder.getLanguageIndex(langCodeParam) > -1) return langCodeParam;
        return getBinderPrimaryLanguageCode(binder);
    }, [binder]);
    const binderLanguagesStr = useMemo(() => binder.getLanguagesWithInfo().map(({ iso639_1 }) => iso639_1).join(","), [binder]); // stringify because arrays don't work as hook dependencies

    const setInitialTranslatorView = useCallback(() => {
        setPrimaryLanguageCode(primaryLangCode);
        const binderLanguages = binderLanguagesStr.split(",");
        const binderTranslatorLangsIntersection = intersection(binderLanguages, translatorLanguageCodes);
        const translableLanguage = [...binderTranslatorLangsIntersection.sort(byDialectPresence)].pop();
        const primaryLanguageIsInTranslatorLangs = translatorLanguageCodes.includes(primaryLangCode);
        const isUndefinedLang = binderLanguages.indexOf(UNDEFINED_LANG) === -1;
        if (!primaryLanguageIsInTranslatorLangs && translableLanguage) {
            if (isMobileView()) {
                setPrimaryLanguageCode(translableLanguage);
            } else {
                setSecondaryLanguageCode(translableLanguage);
            }
        } else if (!translableLanguage && isUndefinedLang) {
            setTranslatorNewLangModalVisibility(true);
        }
    }, [primaryLangCode, setSecondaryLanguageCode, translatorLanguageCodes,
        setPrimaryLanguageCode, setTranslatorNewLangModalVisibility, binderLanguagesStr]);

    const setInitialDefaultView = useCallback(() => {
        setPrimaryLanguageCode(primaryLangCode);
    }, [primaryLangCode, setPrimaryLanguageCode]);

    const setInitialView = useCallback(() => {
        if (translatorLanguageCodes) {
            setInitialTranslatorView();
            return;
        }
        setInitialDefaultView();
    }, [translatorLanguageCodes, setInitialTranslatorView, setInitialDefaultView]);

    const [wasSetup, setWasSetup] = useState(false);

    useEffect(() => {
        if (wasSetup) {
            return; // avoid setting initial view again once it has been setup (eg after deleting a language from the binder)
        }
        setInitialView();
        setWasSetup(true);
    }, [setInitialView, setWasSetup, wasSetup]);
}
