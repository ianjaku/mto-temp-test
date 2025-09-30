import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { useMemo } from "react";

export type UseToolbarLanguageProps = {
    activeLanguageCode: string;
    invisible: boolean;
    isCollapsed: boolean;
    translatedLanguage?: string;
    viewableTranslations: Translation[];
}

export function useLanguageProps(props: {
    activeLanguageCode: string;
    translatedLanguage?: string;
    viewableTranslations: Translation[];
}) {
    const translations = useMemo(() => {
        return (props.viewableTranslations || [])
            .filter(translation => translation.languageCode !== props.activeLanguageCode)
    }, [props.activeLanguageCode, props.viewableTranslations]);
    const hasTranslations = translations.length > 0;
    const hasNoTranslations = !hasTranslations
    const isMachineTranslation = !!props.translatedLanguage;
    const hasUndefinedLanguage = props.activeLanguageCode === UNDEFINED_LANG
    const hasConfirmedLanguage = !hasUndefinedLanguage;
    const isSingleUndefinedLanguage = hasNoTranslations && hasUndefinedLanguage;
    const renderedLanguageCode = props.translatedLanguage ?? props.activeLanguageCode;
    return {
        hasConfirmedLanguage,
        hasNoTranslations,
        hasTranslations,
        hasUndefinedLanguage,
        isMachineTranslation,
        isSingleUndefinedLanguage,
        renderedLanguageCode,
        translations,
    }
}

export function useShouldDisplayGlobeAndCode(props: {
    activeLanguageCode: string,
    translatedLanguage?: string,
    viewableTranslations: Translation[],
}) {
    const {
        hasTranslations,
        isSingleUndefinedLanguage,
        isMachineTranslation
    } = useLanguageProps(props);
    const shouldDisplayGlobeAndCode = hasTranslations || !isSingleUndefinedLanguage || isMachineTranslation;
    return shouldDisplayGlobeAndCode;
}

export type ToolbarLanguageState = {
    renderedLanguageCode: string;
    shouldDisplayGlobeAndCode: boolean;
    shouldDisplayLanguages: boolean;
    shouldDisplayMachineTranslateButton: boolean;
    shouldDisplaySeparator: boolean;
    translations: Translation[];
}

export function useToolbarLanguage(props: UseToolbarLanguageProps & {
    isMTFeatureActive: boolean;
    isRenderedCollapsed: boolean;
}): ToolbarLanguageState {

    const { isMTFeatureActive, isRenderedCollapsed } = props;

    const {
        hasConfirmedLanguage,
        hasTranslations,
        isSingleUndefinedLanguage,
        renderedLanguageCode,
        translations,
    } = useLanguageProps(props);

    const shouldDisplayGlobeAndCode = useShouldDisplayGlobeAndCode(props);

    const isCollapsed = props.isCollapsed;

    const shouldDisplayMachineTranslateButton = isMTFeatureActive && (
        isSingleUndefinedLanguage ||
        (!isCollapsed && (hasTranslations || hasConfirmedLanguage))
    )

    const shouldDisplaySeparator = (hasTranslations || hasConfirmedLanguage) && !isRenderedCollapsed && shouldDisplayMachineTranslateButton
    const shouldDisplayLanguages = !isRenderedCollapsed

    return {
        renderedLanguageCode,
        shouldDisplayGlobeAndCode,
        shouldDisplayLanguages,
        shouldDisplayMachineTranslateButton,
        shouldDisplaySeparator,
        translations,
    }
}

