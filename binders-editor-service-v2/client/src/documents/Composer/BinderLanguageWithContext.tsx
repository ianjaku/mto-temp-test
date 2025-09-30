import * as React from "react";
import { FC, ReactNode } from "react";
import BinderClass from "@binders/client/lib/binders/custom/class";
import { BinderLanguagePropsContextProvider } from "./contexts/binderLanguagePropsContext";
import { Language } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { SetStateBinderFn } from "./hooks/useStateBinder";

export const BinderLanguageWithContext: FC<{
    binder: BinderClass;
    children: ReactNode;
    hasDraft: boolean;
    hasPublications: boolean;
    languageCode: string;
    index: number;
    isPrimary: boolean;
    isInTranslationView: boolean;
    isInDiffView: boolean;
    primaryLanguageCode: string;
    secondaryLanguageCode: string;
    setPrimaryLanguageCode(code: string): void;
    setSecondaryLanguageCode(code: string): void;
    setStateBinder: SetStateBinderFn;
    translatorLanguageCodes: string[];
    visibleLanguages: Language[];
}> = props => {
    const {
        binder,
        children,
        hasDraft,
        hasPublications,
        languageCode,
        index,
        isPrimary,
        isInDiffView,
        isInTranslationView,
        primaryLanguageCode,
        secondaryLanguageCode,
        setPrimaryLanguageCode,
        setSecondaryLanguageCode,
        setStateBinder,
        translatorLanguageCodes,
        visibleLanguages,
    } = props;
    const readonlyMode = isInDiffView || !!translatorLanguageCodes && !(translatorLanguageCodes.includes(languageCode));
    const languagesForDropdown = visibleLanguages.filter(l => l.iso639_1 !== (isPrimary ? secondaryLanguageCode : primaryLanguageCode));
    const opposingLanguageCode = isPrimary ? secondaryLanguageCode : primaryLanguageCode;
    return (
        <BinderLanguagePropsContextProvider
            key={`binder-language-${languageCode}-${index}`}
            props={{
                binder,
                changeLanguage: isPrimary ? setPrimaryLanguageCode : setSecondaryLanguageCode,
                hasDraft,
                hasPublications,
                includeVisuals: index === 0,
                isPrimary,
                isInDiffView,
                isInTranslationView,
                languageCode,
                languagesVisibleInDropdown: languagesForDropdown,
                opposingLanguageCode,
                readonlyMode,
                setStateBinder,
            }}
        >
            {children}
        </BinderLanguagePropsContextProvider>
    )
}

