import type { Expansion, Visibility } from "./types";
import { useCallback, useEffect, useState } from "react";

export type ToolbarState = {
    actionsExpansion: Expansion;
    closeButtonVisibility: Visibility;
    collapse: () => void;
    editButtonVisibility: Visibility;
    expandActionsButtonVisibility: Visibility;
    languageToolbarExpansion: Expansion;
    languageToolbarVisibility: Visibility;
    navigationExpansion: Expansion;
    setActionsExpansion: (e: Expansion) => void;
    setLanguageToolbarExpansion: (e: Expansion) => void;
}

export function useToolbar(props: {
    canEdit: boolean;
    isMobileView: boolean;
    isSingleUndefinedLanguage: boolean;
    translatedLanguage?: string;
}): ToolbarState {
    const { isMobileView } = props;
    const shouldActionsExpand = props.canEdit && isMobileView;
    const isMachineTranslated = !!props.translatedLanguage;
    const isMachineTranslatedDefaultLanguage = isMachineTranslated && props.isSingleUndefinedLanguage;

    const [actionsExpansion, setActionsExpansion] = useState<Expansion>(isMobileView ? "collapsed" : "expanded");
    const [languageToolbarExpansion, setLanguageToolbarExpansion] = useState<Expansion>("collapsed");

    useEffect(() => {
        if (isMachineTranslatedDefaultLanguage) {
            setLanguageToolbarExpansion("expanded");
        }
    }, [isMachineTranslatedDefaultLanguage]);

    const closeButtonVisibility: Visibility = isMobileView && (
        actionsExpansion === "expanded" ||
        languageToolbarExpansion === "expanded") ?
        "visible" :
        "hidden";

    const editButtonVisibility: Visibility = props.canEdit && (
        closeButtonVisibility === "hidden") ?
        "visible" :
        "hidden";

    const expandActionsButtonVisibility: Visibility = shouldActionsExpand &&
        actionsExpansion === "collapsed" &&
        languageToolbarExpansion === "collapsed" ?
        "visible" :
        "hidden";

    const navigationExpansion: Expansion = isMobileView &&
        closeButtonVisibility === "visible" ?
        "collapsed" :
        "expanded";

    const languageToolbarVisibility = isMobileView &&
        closeButtonVisibility === "visible" &&
        languageToolbarExpansion === "collapsed" ?
        "hidden" :
        "visible";

    const collapse = useCallback(() => {
        if (actionsExpansion === "expanded") {
            setActionsExpansion("collapsed");
        } else {
            setLanguageToolbarExpansion("collapsed");
        }
    }, [actionsExpansion]);

    return {
        actionsExpansion,
        closeButtonVisibility,
        collapse,
        editButtonVisibility,
        expandActionsButtonVisibility,
        languageToolbarExpansion,
        languageToolbarVisibility,
        navigationExpansion,
        setActionsExpansion,
        setLanguageToolbarExpansion,
    }
}
