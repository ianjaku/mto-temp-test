import React, { Fragment, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { ToolbarTooltip } from "../ToolbarTooltip";
import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import cx from "classnames";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import { useActiveViewable } from "../../../../stores/hooks/binder-hooks";
import { useResizeObserver } from "@binders/client/lib/react/hooks/useResizeObserver";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "../../../../vars.json";

interface Props {
    activeLanguageCode: string;
    translatedLanguage?: string;
    translations: Translation[];
    switchLanguage: (translation: Translation) => void;
    shouldDisplayGlobeAndCode: boolean;
}

type TranslationToRender = Translation & { label: string, isLanguageCode: boolean };

export const ToolbarLanguageMinimal: React.FC<Props> = (props) => {

    const activeViewable = useActiveViewable();

    const selectedLanguageRef = useRef(null);
    const highlightRef = useRef(null);
    const languageCodesRef = useRef(null);
    const { t } = useTranslation();

    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

    const renderedLanguageCode = props.translatedLanguage ?? props.activeLanguageCode;
    const renderedLanguageLabel = useMemo(() => getLanguageInfo(renderedLanguageCode)?.nativeName, [renderedLanguageCode]);

    const [selectedLanguageWidth, setSelectedLanguageWidth] = React.useState(0);
    const [languageCodeWidths, setLanguageCodeWidths] = React.useState<Record<number, number>>({});
    const [hoveredLanguageIndex, setHoveredLanguageIndex] = React.useState<number | null>(null);

    const setHoveredLanguage = (e: MouseEvent<HTMLElement>, languageCode: string, i: number) => {
        setHoveredLanguageIndex(i);
        setVisibleTooltip(i === null ? null : languageCode);
    }

    const highlightLeftOffset = !props.shouldDisplayGlobeAndCode ? 0 : vars.toolbarIconSize + (2 * vars.iconGap);

    const highlightWidth = useMemo(() => {
        if (hoveredLanguageIndex === null) {
            return selectedLanguageWidth;
        }
        return languageCodeWidths[hoveredLanguageIndex];
    }, [hoveredLanguageIndex, languageCodeWidths, selectedLanguageWidth]);

    const highlightLeft = useMemo(() => {
        if (hoveredLanguageIndex === null) {
            return highlightLeftOffset;
        }
        return selectedLanguageWidth + Object.values(languageCodeWidths).reduce(
            (acc, width, i) => i < hoveredLanguageIndex ? acc + width : acc,
            highlightLeftOffset
        );
    }, [hoveredLanguageIndex, languageCodeWidths, selectedLanguageWidth, highlightLeftOffset]);
    const highlightBackgroundColor = useMemo(() => hoveredLanguageIndex != null ? "#e0e0e0" : "#dcdbd9", [hoveredLanguageIndex]);

    useResizeObserver(
        selectedLanguageRef,
        (newDimensions) => {
            setSelectedLanguageWidth(newDimensions.widthPx + (vars.iconGap * 2));
        }
    );

    useResizeObserver(
        languageCodesRef,
        () => {
            const languageCodeWidths = {};
            languageCodesRef.current.querySelectorAll(".toolbarLanguage-minimal-languageCodes-button").forEach((label, i) => {
                languageCodeWidths[i] = label.getBoundingClientRect().width;
            });
            setLanguageCodeWidths(languageCodeWidths);
        }
    );

    useEffect(() => {
        activateTransition();
    }, []);

    const [previousSelectedLangCode, setPreviousSelectedLangCode] = React.useState<string | null>(null);

    const translationsToRender = useMemo<TranslationToRender[]>(() => {
        const translations = props.translations
            .map(translation => {
                const info = getLanguageInfo(translation.languageCode);
                return {
                    ...translation,
                    label: `${info.name} / ${info.nativeName}`,
                    isLanguageCode: true,
                }
            })
            .sort((a, b) => {
                if (a.languageCode === previousSelectedLangCode) {
                    return 1;
                } else if (b.languageCode === previousSelectedLangCode) {
                    return -1;
                }
                return 0;
            });
        if (props.translatedLanguage) {
            // if the rendered language is machine-translated, offer the option to switch to the active language
            const activeLangInfo = getLanguageInfo(props.activeLanguageCode);
            const forceLabelToOriginal = props.activeLanguageCode === UNDEFINED_LANG;
            translations.unshift({
                languageCode: forceLabelToOriginal ? t(TK.Reader_MachineTranslation_Original) : props.activeLanguageCode,
                publicationId: activeViewable.id,
                label: forceLabelToOriginal ? t(TK.Reader_MachineTranslation_Original_Tooltip) : `${activeLangInfo?.name} / ${activeLangInfo?.nativeName}`,
                isLanguageCode: !forceLabelToOriginal,
            });
        }
        return translations;
    }, [props.translations, props.translatedLanguage, props.activeLanguageCode, previousSelectedLangCode, t, activeViewable.id]);

    const activateTransition = () => {
        if (!highlightRef.current) return;
        highlightRef.current.style.transition = "none";
        setTimeout(() => {
            if (!highlightRef.current) return;
            highlightRef.current.style.transition = "left .2s ease-in-out, width .2s ease-in-out, background-color .2s ease-in-out";
        }, 200);
    }

    const clickLanguage = (translation: Translation) => {
        activateTransition(); // disable and reactivate transition to avoid animation during rerendering
        if (!props.translatedLanguage) {
            setPreviousSelectedLangCode(props.activeLanguageCode);
        }
        props.switchLanguage(translation);
    }

    const shouldDisplayHighlight = translationsToRender.length > 0;
    const shouldDisplayLanguageLabel = renderedLanguageCode !== UNDEFINED_LANG;

    return (
        <div className="toolbarLanguage-minimal">
            {shouldDisplayHighlight && (
                <div
                    className="toolbarLanguage-minimal-highlight"
                    style={{ width: highlightWidth, left: highlightLeft, backgroundColor: highlightBackgroundColor }}
                    ref={highlightRef}
                ></div>
            )}
            <label
                className={cx("toolbarLanguage-minimal-selectedLanguage", { "toolbarLanguage-minimal-selectedLanguage--hidden": !shouldDisplayLanguageLabel })}
                ref={selectedLanguageRef}
            > {/* note: --hidden class instead of conditional rendering is used here to make ref work */}
                {`${renderedLanguageLabel}${props.translatedLanguage ? " *" : ""}`}
            </label>
            <div className="toolbarLanguage-minimal-languageCodes" ref={languageCodesRef}>
                {translationsToRender.map((translation, i) => (
                    <Fragment key={`lang${translation.languageCode}`}>
                        <label
                            className={cx(
                                "toolbarLanguage-minimal-languageCodes-button",
                                {
                                    "toolbarLanguage-minimal-languageCodes-button--containsLanguageCode": translation.isLanguageCode,
                                }
                            )}
                            onMouseEnter={(e) => setHoveredLanguage(e, translation.languageCode, i)}
                            onMouseLeave={(e) => setHoveredLanguage(e, translation.languageCode, null)}
                            onClick={() => clickLanguage(translation)}
                        >
                            {translation.languageCode}
                        </label>
                        {visibleTooltip === translation.languageCode && (
                            <ToolbarTooltip
                                message={translation.label}
                                rightAnchor
                            />
                        )}
                    </Fragment>
                ))}
            </div>
        </div>
    )
}
