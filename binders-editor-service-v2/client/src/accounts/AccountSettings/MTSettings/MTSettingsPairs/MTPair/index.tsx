import * as React from "react";
import {
    FEATURE_DIALECTS,
    FEATURE_GHENTIAN_DIALECT,
    defaultAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Button from "@binders/ui-kit/lib/elements/button";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Warning from "@binders/ui-kit/lib/elements/icons/Warning";
import cx from "classnames";
import { getLanguageElements } from "../../../../../browsing/tsHelpers";
import { getMTEngineName } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import useSaveWhenDirty from "./useSaveWhenDirty";
import { useTranslation } from "@binders/client/lib/react/i18n";
const { useCallback, useEffect, useMemo, useState, useRef } = React;

interface IProps {
    languageCodesSerialized?: string;
    engineType?: MTEngineType;
    isNewMode?: boolean;
    isNewInputCollapsed?: boolean;
    onUpdatePair: (
        languageCodesSerialized: string,
        engineType: MTEngineType | null,
        replacesLanguageCodesSerialized?: string
    ) => void;
    setIsNewInputCollapsed?: (collapsed: boolean) => void;
    supportedLanguagesMap?: { [engineType: string]: string[] };
    accountFeatures: string[];
}

const MTPair: React.FC<IProps> = ({
    languageCodesSerialized,
    engineType: savedEngineType,
    isNewMode,
    onUpdatePair,
    isNewInputCollapsed,
    setIsNewInputCollapsed,
    supportedLanguagesMap,
    accountFeatures,
}) => {

    const { t } = useTranslation();

    const [savedLanguageCodeFrom, savedLanguageCodeTo] = useMemo(() =>
        languageCodesSerialized ?
            languageCodesSerialized.split(":") :
            [undefined, undefined], [languageCodesSerialized]);

    const languageSupportMap = useMemo(() => {
        if (supportedLanguagesMap == null) return null;
        const result: { [languageCode: string]: string[] } = {};
        for (const [type, languages] of Object.entries(supportedLanguagesMap)) {
            for (const language of languages) {
                if (result[language] == null) {
                    result[language] = [type];
                } else {
                    result[language].push(type)
                }
            }
        }
        return result;
    }, [supportedLanguagesMap]);

    const allLanguages = useMemo(() => {
        const { elements } = getLanguageElements({
            includeDialects: accountFeatures.includes(FEATURE_DIALECTS),
            includeGhentianDialect: accountFeatures.includes(FEATURE_GHENTIAN_DIALECT),
        });
        return elements.filter(language => {
            if (languageSupportMap == null) return true;
            const simplifiedLanguage = `${language.id}`.split("-")[0];
            return languageSupportMap[simplifiedLanguage] != null
        });
    }, [accountFeatures, languageSupportMap]);

    const isLanguageSupported = useCallback((languageCode: string, engine?: MTEngineType) => {
        if (languageSupportMap == null) return true;
        if (languageCode === "any") return true;
        const simplifiedCode = languageCode.split("-")[0];
        const support = languageSupportMap[simplifiedCode];
        if (engine == null) return support != null;
        return support?.includes(engine.toString()) ?? false;
    }, [languageSupportMap])

    const allLanguagesInclAny = useMemo(() => {
        return [
            { id: "any", value: "any", label: t(TK.Account_PrefsMTPairsAnyLanguage) },
            ...allLanguages,
        ];
    }, [allLanguages, t]);

    const [languageCodeFrom, setLanguageCodeFrom] = useState<string>();
    const [languageCodeTo, setLanguageCodeTo] = useState<string>();
    const [engineType, setEngineType] = useState<MTEngineType>();
    const [isDirty, setIsDirty] = useState(false);
    const engineWarningTooltipRef = useRef(null);

    useEffect(() => {
        if (!languageCodeFrom) {
            setLanguageCodeFrom(savedLanguageCodeFrom)
        }
    }, [languageCodeFrom, savedLanguageCodeFrom]);

    useEffect(() => {
        if (!languageCodeTo) {
            setLanguageCodeTo(savedLanguageCodeTo)
        }
    }, [languageCodeTo, savedLanguageCodeTo]);

    useEffect(() => {
        if (engineType === undefined) {
            setEngineType(savedEngineType)
        }
    }, [engineType, savedEngineType]);

    const prevIsNewInputCollapsed = usePrevious(isNewInputCollapsed);

    useEffect(() => {
        if (prevIsNewInputCollapsed && !isNewInputCollapsed) {
            setLanguageCodeFrom(undefined);
            setLanguageCodeTo(undefined);
            setEngineType(undefined);
            setIsFromHighlighted(false);
            setIsToHighlighted(false);
            setIsEngineHighlighted(false);
        }
    }, [isNewInputCollapsed, prevIsNewInputCollapsed]);

    const onSave = useCallback(() => {
        const stateLanguageCodesSerialized = `${languageCodeFrom}:${languageCodeTo}`;
        // const prevLanguageCodesSerialized = `${prevLanguageCodeFrom}:${prevLanguageCodeTo}`;
        const replacesLanguageCodesSerialized = stateLanguageCodesSerialized === languageCodesSerialized ?
            undefined :
            languageCodesSerialized;
        onUpdatePair(
            stateLanguageCodesSerialized,
            engineType,
            replacesLanguageCodesSerialized,
        )
    }, [engineType, languageCodeFrom, languageCodeTo, languageCodesSerialized, onUpdatePair]);

    const validateForm = useCallback(() => {
        let valid = true;
        setIsFromHighlighted(false);
        setIsToHighlighted(false);
        setIsEngineHighlighted(false);
        if (!languageCodeFrom) {
            setIsFromHighlighted(true);
            valid = false;
        }
        if (!languageCodeTo) {
            setIsToHighlighted(true);
            valid = false;
        }
        if (languageCodeFrom === "any" && languageCodeTo === "any") {
            setIsFromHighlighted(true);
            setIsToHighlighted(true);
            valid = false;
        }
        if (engineType === undefined) {
            setIsEngineHighlighted(true);
            valid = false;
        }
        if (
            !isLanguageSupported(languageCodeFrom, engineType) ||
            !isLanguageSupported(languageCodeTo, engineType)
        ) {
            valid = false;
            setIsEngineHighlighted(true);
            const languageLbls = [
                ...(isLanguageSupported(languageCodeFrom, engineType) ? [] : [allLanguages.find(l => l.id === languageCodeFrom)?.label]),
                ...(isLanguageSupported(languageCodeTo, engineType) ? [] : [allLanguages.find(l => l.id === languageCodeTo)?.label]),
            ];
            setEngineWarning(t(TK.Account_PrefsMTPairsLangNotSupported, {
                language: languageLbls.join(", ")
            }));
        }
        return valid;
    }, [allLanguages, engineType, languageCodeFrom, languageCodeTo, t, isLanguageSupported]);

    useSaveWhenDirty(isDirty, validateForm, setIsDirty, onSave);

    const maybeSave = useCallback(() => {
        if (!isNewMode) {
            setIsDirty(true);
        }
    }, [isNewMode]);

    const onUpdateLanguageFrom = useCallback((v) => {
        setLanguageCodeFrom(v);
        setIsEngineHighlighted(false);
        maybeSave();
    }, [maybeSave]);
    const onUpdateLanguageTo = useCallback((v) => {
        setLanguageCodeTo(v);
        setIsEngineHighlighted(false);
        maybeSave();
    }, [maybeSave]);
    const onUpdateEngineType = useCallback((v) => {
        setEngineType(v);
        setIsEngineHighlighted(false);
        maybeSave();
    }, [maybeSave]);

    const [isFromHighlighted, setIsFromHighlighted] = useState(false);
    const [isToHighlighted, setIsToHighlighted] = useState(false);
    const [isEngineHighlighted, setIsEngineHighlighted] = useState(false);
    const [engineWarning, setEngineWarning] = useState<string>();

    const onAdd = useCallback(() => {
        if (!validateForm()) {
            return;
        }
        onUpdatePair(
            `${languageCodeFrom}:${languageCodeTo}`,
            engineType,
        )
    }, [engineType, languageCodeFrom, languageCodeTo, onUpdatePair, validateForm]);

    const maybeRenderAddBtn = useCallback(() => {
        if (!isNewMode) { return null; }
        return (
            <Button
                text={t(TK.General_Add)}
                CTA={true}
                onClick={onAdd}
            />
        )
    }, [isNewMode, t, onAdd]);

    const maybeRenderDeleteBtn = useCallback(() => {
        if (isNewMode) { return null; }
        return (
            <label
                className="mt-settings-pairs-pair-iconBtn"
                onClick={() => onUpdatePair(`${languageCodeFrom}:${languageCodeTo}`, null)}
            >
                {Delete()}
            </label>
        )
    }, [isNewMode, languageCodeFrom, languageCodeTo, onUpdatePair]);

    const renderControls = useCallback(() => {
        return (
            <>
                {maybeRenderAddBtn()}
                {maybeRenderDeleteBtn()}
            </>
        );
    }, [maybeRenderAddBtn, maybeRenderDeleteBtn]);

    const engineTypes = useMemo(() => {
        return defaultAccountSettings().mt.generalOrder;
    }, []);
    const engineElements = useMemo(() => {
        return engineTypes.map((type) => {
            const name = getMTEngineName(type)
            return { id: type, label: name, value: type }
        })
    }, [engineTypes]);

    const renderNewBtn = useCallback(() => {
        return (
            <div className="mt-settings-pairs-pair-btnWrapper"
                onClick={() => setIsNewInputCollapsed(false)}
            >
                <label>{t(TK.Account_PrefsMTPairsNew)}</label>
            </div>
        )
    }, [setIsNewInputCollapsed, t]);

    const onMouseEnterWarning = useCallback((e) => {
        showTooltip(e, engineWarningTooltipRef.current, TooltipPosition.BOTTOM);
    }, []);
    const onMouseLeaveWarning = useCallback((e) => {
        hideTooltip(e, engineWarningTooltipRef.current);
    }, []);

    const maybeRenderEngineWarning = useCallback(() => engineWarning ?
        (
            <label
                className="mt-settings-pairs-pair-warning"
                onMouseEnter={onMouseEnterWarning}
                onMouseLeave={onMouseLeaveWarning}
            >
                {Warning()}
            </label>
        ) :
        null, [engineWarning, onMouseEnterWarning, onMouseLeaveWarning]);

    const renderForm = useCallback(() => {
        const fromLanguageElements = (isNewMode || languageCodeTo !== "any" ? allLanguagesInclAny : allLanguages)
            .filter(l => l.id !== languageCodeTo);
        const toLanguageElements = (isNewMode || languageCodeFrom !== "any" ? allLanguagesInclAny : allLanguages)
            .filter(l => l.id !== languageCodeFrom);
        return (
            <div className="mt-settings-pairs-pair-form">
                <div className="mt-settings-pairs-pair-form-head">
                    <label>{t(TK.Account_PrefsMTPairsFrom)}</label>
                    <FilterableDropdown
                        key={`from${languageCodeFrom}`}
                        selectedElementId={languageCodeFrom ?? undefined}
                        maxRows={5}
                        type={t(TK.General_Language)}
                        onSelectElement={onUpdateLanguageFrom}
                        elements={fromLanguageElements}
                        unselectable={false}
                        className={cx({ "requiredDropdown": isFromHighlighted })}
                    />
                    <label>{t(TK.Account_PrefsMTPairsTo)}</label>
                    <FilterableDropdown
                        key={`to${languageCodeTo}`}
                        selectedElementId={languageCodeTo ?? undefined}
                        maxRows={5}
                        type={t(TK.General_Language)}
                        onSelectElement={onUpdateLanguageTo}
                        elements={toLanguageElements}
                        unselectable={false}
                        className={cx({ "requiredDropdown": isToHighlighted })}
                    />
                    <label>{t(TK.Account_PrefsMTPairsHandledBy)}:</label>
                    <FilterableDropdown
                        key={`eng${engineType}`}
                        selectedElementId={engineType ?? undefined}
                        maxRows={5}
                        type={"Translation engine"}
                        onSelectElement={onUpdateEngineType}
                        elements={engineElements}
                        className={cx({ "requiredDropdown": isEngineHighlighted })}
                    />
                    {maybeRenderEngineWarning()}
                </div>
                <div className="mt-settings-pairs-pair-form-tail">
                    {renderControls()}
                </div>
            </div>
        )
    }, [t, languageCodeFrom, onUpdateLanguageFrom, isNewMode, languageCodeTo, allLanguagesInclAny, allLanguages, isFromHighlighted, onUpdateLanguageTo, isToHighlighted, engineType, onUpdateEngineType, engineElements, isEngineHighlighted, maybeRenderEngineWarning, renderControls]);

    const renderBody = useCallback(() => {
        return isNewInputCollapsed ? renderNewBtn() : renderForm();
    }, [renderForm, renderNewBtn, isNewInputCollapsed]);

    return (
        <div className={cx("mt-settings-pairs-pair", {
            "mt-settings-pairs-pair--collapsed": isNewInputCollapsed,
            "mt-settings-pairs-pair--newMode": isNewMode
        })}>
            {renderBody()}
            <Tooltip ref={engineWarningTooltipRef} message={engineWarning} />
        </div>
    )
}

export default MTPair;