import * as React from "react";
import {
    Binder,
    DocumentCollection,
    IChecklistProgress
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useCallback, useEffect, useState } from "react";
import { ActiveCollectionInfo } from "../../stores/zustand/binder-store";
import { Div100Vh } from "../../utils/div100vh";
import LanguageButton from "../components/CircleButton/LanguageButton";
import ReaderHeader from "../header/header";
import { RouteComponentProps } from "react-router-dom";
import SearchInput from "../search/input";
import Select from "react-select";
import StoryList from "./story-list";
import { StoryTile } from "../../binders/contract";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { isMobileDevice } from "../../util";
import { renderBreadcrumbsSet } from "./helpers";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const StoryBrowser = (props: {
    accountId: string;
    activeCollectionInfo: ActiveCollectionInfo;
    browsePath?: (string | DocumentCollection | Binder)[];
    checklistsProgress?: IChecklistProgress[];
    languageSettings: { value: string }[];
    languages?: string[];
    onChangeLanguagePreferences: (lang: { value: string }) => void;
    readableItems?: string[];
    router: RouteComponentProps,
    selectedLanguageCode: string;
    showProgress?: boolean;
    showTabInfo?: boolean;
    storyTiles?: StoryTile[];
    userId: string;
}) => {
    const {
        accountId,
        activeCollectionInfo,
        browsePath,
        checklistsProgress,
        languageSettings,
        languages,
        onChangeLanguagePreferences,
        router,
        selectedLanguageCode,
        showProgress,
        storyTiles,
        userId,
    } = props;
    const [mustScrollNavigation, setMustScrollNavigation] = useState(false);
    const { t } = useTranslation();

    const browserNavigationClasses = cx(
        "story-browser-navigation",
        { "story-browser-navigation--with-select": languageSettings.length > 0 },
    );
    const prioLanguages = [selectedLanguageCode, ...(languages || [])];
    const selectedLanguage = languageSettings.find(s => s.value === selectedLanguageCode);

    const checkIfMustScrollNavigation = useCallback(() => {
        const isLandscape = window.innerWidth >= window.innerHeight;
        const hasHeaderCutoff = window.innerHeight <= 500;
        setMustScrollNavigation(isLandscape && hasHeaderCutoff);
    }, []);

    useEffect(() => {
        window.addEventListener("resize", checkIfMustScrollNavigation);
        checkIfMustScrollNavigation();
        return () => {
            window.removeEventListener("resize", checkIfMustScrollNavigation);
        }
    }, [checkIfMustScrollNavigation]);

    const browserNavigation = (
        <div className={browserNavigationClasses}>
            {renderBreadcrumbsSet(browsePath, prioLanguages)}
            {languageSettings.length > 0 && (
                <div className="story-browser-languageSwitcher">
                    {languageSettings.length < (isMobileDevice() ? 3 : 5) ?
                        (
                            <div className="languageOptions" >
                                {languageSettings.length > 1 && languageSettings.map((languageCode) => (
                                    <LanguageButton
                                        isSelected={languageCode.value === selectedLanguageCode}
                                        key={languageCode.value}
                                        languageCode={languageCode.value}
                                        onSelect={onChangeLanguagePreferences}
                                    />
                                ))}
                            </div>
                        ) :
                        (
                            <Select
                                autoBlur
                                className="story-browser-languageSwitcher-select"
                                defaultValue={selectedLanguage}
                                isClearable={true}
                                onChange={onChangeLanguagePreferences}
                                options={languageSettings}
                                placeholder={t(TranslationKeys.DocManagement_ChangeLanguage)}
                                searchable
                                styles={isIE11 ? ie11Styles : inteligentBrowsersStyles}
                            />
                        )}
                </div>
            )}
        </div>
    );

    return (
        <Div100Vh asMinHeight={false} className="story-browser-layout" >
            <ReaderHeader
                accountId={accountId}
                logo={window.bindersBranding.logo}
                router={router}
                userId={userId}
            >
                <nav>
                    <SearchInput accountId={accountId} userId={userId} />
                </nav>
            </ReaderHeader>
            {mustScrollNavigation ? null : browserNavigation}
            <StoryList
                activeCollectionInfo={activeCollectionInfo}
                browserNavigation={mustScrollNavigation ? browserNavigation : null}
                checklistsProgress={checklistsProgress}
                noLanguageDropdown={languageSettings.length === 0}
                router={router}
                showProgress={showProgress}
                storyTiles={storyTiles}
            />
        </Div100Vh>
    );
}

const ie11Styles: Record<string, (styles: React.CSSProperties) => React.CSSProperties> = {
    control: styles => ({
        ...styles,
        border: "1px solid #AAA",
        "&:focus": { border: "1px solid #AAA", outline: "none" },
        "&:hover": { border: "1px solid #AAA", outline: "none" },
    }),
    menu: styles => ({ ...styles, fontSize: "small" }),
    placeholder: styles => ({
        ...styles,
        textAlign: "center",
        width: "100%",
    }),
    singleValue: styles => ({
        ...styles,
        textAlign: "center",
        width: "100%",
    }),
    valueContainer: styles => ({
        ...styles,
        display: "block",
        margin: "0px",
        textAlign: "center",
        padding: "0px",
    })
};

const inteligentBrowsersStyles: Record<string, (styles: React.CSSProperties) => React.CSSProperties> = {
    control: styles => ({
        ...styles,
        border: "1px solid #AAA",
        "&:focus": { border: "1px solid #AAA", outline: "none" },
        "&:hover": { border: "1px solid #AAA", outline: "none" },
        paddingLeft: "16px",
    }),
    menu: styles => ({ ...styles, fontSize: "small" }),
    valueContainer: styles => ({
        ...styles,
        display: "flex",
        margin: "0px",
        justifyContent: "center",
    })
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isIE11 = !!(window as any).MSInputMethodContext && !!(document as any).documentMode;

export default StoryBrowser;
