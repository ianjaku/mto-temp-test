import * as React from "react";
import * as ReactDOM from "react-dom";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import useConditionallyDetectLanguage, { DetectionStatus } from "./useConditionallyDetectLanguage";
import Binder from "@binders/client/lib/binders/custom/class";
import Button from "@binders/ui-kit/lib/elements/button";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import { FEATURE_GHENTIAN_DIALECT } from "@binders/client/lib/clients/accountservice/v1/contract";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import Icon from "@binders/ui-kit/lib/elements/icons";
import LanguageCodeCircle from "../../LanguageCodeCircle";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { getLanguageElements } from "../../../../../browsing/tsHelpers";
import { getLanguageName } from "@binders/client/lib/languages/helper";
import { useActiveAccountFeatures } from "../../../../../accounts/hooks";
import useDocumentClickTrigger from "../../../../../shared/ClickHandler/useDocumentClickTrigger";
import { useTranslation } from "@binders/client/lib/react/i18n";
const { useRef, useMemo, useState, useCallback } = React;

interface IProps {
    languageCode: string;
    onSelectLanguageCode: (languageCode: string) => void;
    isMaster?: boolean;
    binder: Binder;
    mostUsedLanguages: string[];
    featuresDialects: boolean;
    translatorLanguageCodes: string[];
    languageMenuAnchor: Element;
    topNudge?: number;
    iconName?: string;
    iconClassname?: string;
    changeLanguageNoticeTK: string;
}

const LanguageCodeSelector: React.FC<IProps> = ({
    languageCode,
    isMaster,
    binder,
    mostUsedLanguages,
    featuresDialects,
    translatorLanguageCodes,
    languageMenuAnchor,
    topNudge,
    onSelectLanguageCode,
    iconName,
    iconClassname,
    changeLanguageNoticeTK,
}) => {

    const [menuRequestedTrigger, setMenuRequestedTrigger] = useState(0);
    const [isSelectingOtherLanguage, setIsSelectingOtherLanguage] = useState(false);
    const [detectionStatus, detectedLanguageCode] = useConditionallyDetectLanguage(
        menuRequestedTrigger,
        binder,
        languageCode
    );

    const onClick = useCallback(() => setMenuRequestedTrigger(v => v + 1), []);
    const { t } = useTranslation();
    const tooltipRef = useRef(null);

    const closeMenu = useCallback(() => {
        setMenuRequestedTrigger(v => v - 1);
        setIsSelectingOtherLanguage(false);
    }, []);

    useDocumentClickTrigger(
        ["languagecode-circle-text", "contextMenu-item", "add-language-dropdown", "relabel-language-menu"],
        closeMenu,
    )

    const [languageCodeCandidate, setLanguageCodeCandidate] = useState<string>();

    const handleSelectLanguageCode = useCallback((code: string) => {
        const mismatch =
            detectedLanguageCode &&
            detectedLanguageCode !== code;
        if (languageCode === UNDEFINED_LANG && !mismatch) {
            onSelectLanguageCode(code);
        } else {
            setLanguageCodeCandidate(code);
        }
        closeMenu();
    }, [closeMenu, detectedLanguageCode, languageCode, onSelectLanguageCode]);

    const features = useActiveAccountFeatures();

    const { elements: languageDropdownElements, prioritizedCount } = useMemo(() => {
        const visibleLanguages = binder && binder.getVisibleLanguages();
        const visibleLanguageCodes = visibleLanguages.map(l => l.iso639_1);
        const visibleLanguagesSet = new Set<string>(visibleLanguageCodes ?? []);
        return getLanguageElements({
            languageCodesToDisable: visibleLanguages.map(l => l.iso639_1),
            languageCodesToDisableSuffix: ` (${t(TK.Edit_LangAlreadyAdded)})`,
            languageCodesToPrioritize: mostUsedLanguages.filter(l => visibleLanguagesSet.has(l)),
            includeDialects: featuresDialects,
            includeGhentianDialect: features?.includes(FEATURE_GHENTIAN_DIALECT),
            translatorLanguageCodes
        });
    }, [binder, featuresDialects, mostUsedLanguages, translatorLanguageCodes, t, features]);

    const detectMenuVisible = useMemo(() =>
        (detectionStatus === DetectionStatus.detectedNewLang) &&
        !isSelectingOtherLanguage, [detectionStatus, isSelectingOtherLanguage]);
    const languageDropdownVisible = useMemo(() =>
        isSelectingOtherLanguage ||
        detectionStatus === DetectionStatus.detectedOther ||
        detectionStatus === DetectionStatus.detectionFail, [detectionStatus, isSelectingOtherLanguage]);

    const maybeRenderDetectMenu = useCallback(() => {
        if (!detectMenuVisible) {
            return false;
        }
        return (
            <ContextMenu
                anchorRef={languageMenuAnchor}
                open={true}
                className="relabel-language-menu-popOverRoot"
                onClose={closeMenu}
                popOverStyle={{ top: topNudge || 0 }}
            >
                <MenuItem
                    onClick={() => handleSelectLanguageCode(detectedLanguageCode)}
                    title={
                        languageCode === UNDEFINED_LANG ?
                            t(TK.Edit_LangSetDetected, { language: getLanguageName(detectedLanguageCode) }) :
                            t(TK.DocManagement_ChangeLanguageTo, { language: getLanguageName(detectedLanguageCode) })
                    }
                    persistent={true}
                    key={"lcmCDL"}
                />
                <MenuItem
                    onClick={() => setIsSelectingOtherLanguage(true)}
                    title={t(TK.Edit_LangChoosePrimary)}
                    persistent={true}
                    key={"lcmCOL"}
                />
            </ContextMenu>
        );
    }, [closeMenu, detectMenuVisible, detectedLanguageCode, handleSelectLanguageCode, languageCode, languageMenuAnchor, t, topNudge]);

    const maybeRenderLanguageDropdown = useCallback(() => {
        if (!languageDropdownVisible) {
            return null;
        }
        return (
            <FilterableDropdown
                key="add-languages-dropdown"
                type={t(TK.General_Languages)}
                className="add-languages-dropdown"
                elements={languageDropdownElements}
                horizontalRulePositions={prioritizedCount ? [prioritizedCount] : []}
                onSelectElement={handleSelectLanguageCode}
                maxRows={7}
                defaultOpened={true}
                keepOpen={true}
                style={{ top: topNudge || 0 }}
                width={244}
            />
        )
    }, [handleSelectLanguageCode, languageDropdownElements, languageDropdownVisible, prioritizedCount, t, topNudge]);

    const maybeRenderLanguageMenu = useCallback(() => {
        if (!languageMenuAnchor) {
            return null;
        }
        return ReactDOM.createPortal((
            <div className="relabel-language-menu">
                {maybeRenderDetectMenu()}
                {maybeRenderLanguageDropdown()}
            </div>
        ), languageMenuAnchor)
    }, [languageMenuAnchor, maybeRenderDetectMenu, maybeRenderLanguageDropdown]);

    const maybeRenderConfirmationModal = useCallback(() => {
        if (!languageCodeCandidate) {
            return null;
        }

        const mismatch =
            detectedLanguageCode &&
            detectedLanguageCode !== languageCodeCandidate;
        const candidateIsCurrent = languageCodeCandidate === languageCode;
        const detectedIsCurrent = detectedLanguageCode === languageCode;

        return (
            <Modal
                title={t(TK.DocManagement_ChangeLanguage)}
                onHide={() => setLanguageCodeCandidate(undefined)}
                buttons={[
                    <Button key="cancel" text={t(TK.General_Cancel)} secondary={true} onClick={() => {
                        setLanguageCodeCandidate(undefined);
                    }} />,
                    <Button
                        key="relabelToCandidate"
                        text={mismatch && !candidateIsCurrent ?
                            t(TK.DocManagement_RelabelLanguageTo, {
                                langCode: getLanguageName(languageCodeCandidate)
                            }) :
                            t(TK.General_Ok)}
                        onClick={() => {
                            onSelectLanguageCode(languageCodeCandidate);
                        }}
                    />,
                    ...(mismatch && !detectedIsCurrent ?
                        [
                            <Button key="relabelToDetected" text={t(TK.DocManagement_RelabelLanguageTo, {
                                langCode: getLanguageName(detectedLanguageCode)
                            })} onClick={() => {
                                onSelectLanguageCode(detectedLanguageCode);
                            }} />
                        ] :
                        []),
                ]}
            >
                <div>
                    <p>
                        {t(changeLanguageNoticeTK, {
                            from: getLanguageName(languageCode),
                            to: getLanguageName(languageCodeCandidate),
                        })}
                    </p>
                    {mismatch ?
                        (
                            <p>
                                {t(TK.DocManagement_RelabelLanguageMismatchWarning, {
                                    langCode: getLanguageName(detectedLanguageCode)
                                })}
                            </p>
                        ) :
                        null}
                    {t(TK.General_ConfirmProceed)}
                </div>
            </Modal>
        )
    }, [changeLanguageNoticeTK, detectedLanguageCode, languageCode, languageCodeCandidate, onSelectLanguageCode, t]);

    const onMouseEnterWarning = useCallback((e) => {
        if (detectMenuVisible || languageDropdownVisible) {
            return;
        }
        showTooltip(e, tooltipRef.current, TooltipPosition.LEFT);
    }, [detectMenuVisible, languageDropdownVisible]);
    const onMouseLeaveWarning = useCallback((e) => {
        hideTooltip(e, tooltipRef.current);
    }, []);

    const renderIcon = useCallback(() => {
        if (iconName) {
            return (
                <label onClick={onClick} className={iconClassname}>
                    <Icon name={iconName} />
                </label>
            );
        }
        return detectionStatus === DetectionStatus.detecting ?
            circularProgress() :
            (
                <LanguageCodeCircle
                    languageCode={languageCode}
                    isMaster={isMaster}
                    onClick={onClick}
                />
            );
    }, [detectionStatus, iconClassname, iconName, isMaster, languageCode, onClick]);

    return (
        <div className="languageCodeSelector">
            <div
                onMouseEnter={onMouseEnterWarning}
                onMouseLeave={onMouseLeaveWarning}
            >
                {renderIcon()}
            </div>
            <Tooltip ref={tooltipRef} message={t(TK.DocManagement_ChangeLanguage)} />
            {maybeRenderLanguageMenu()}
            {maybeRenderConfirmationModal()}
        </div>
    )
}

export default LanguageCodeSelector;