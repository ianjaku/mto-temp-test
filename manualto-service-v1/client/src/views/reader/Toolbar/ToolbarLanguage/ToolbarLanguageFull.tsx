import React, { useMemo } from "react";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import cx from "classnames";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import { useActiveViewable } from "../../../../stores/hooks/binder-hooks";
import { useAnimateVisibility } from "@binders/client/lib/react/helpers/hooks";
import { useOutsideClick } from "@binders/client/lib/react/helpers/useOutsideClick";

interface Props {
    activeLanguageCode: string;
    translatedLanguage?: string;
    translations: Translation[];
    switchLanguage: (translation: Translation) => void;
}

export const ToolbarLanguageFull: React.FC<Props> = (props) => {

    const activePublication = useActiveViewable(); // note: we can be sure this is a publication because the language toolbar isn't shown in preview mode

    const dropdownRef: React.LegacyRef<HTMLDivElement> = useOutsideClick(() => setIsDropdownVisible(false));
    const renderedLanguageCode = props.translatedLanguage ?? props.activeLanguageCode;
    const renderedLanguageLabel = useMemo(() => getLanguageInfo(renderedLanguageCode)?.nativeName, [renderedLanguageCode]);
    const dropdownOptions = useMemo(() => {
        const options = props.translations.map(translation => {
            const langInfo = getLanguageInfo(translation.languageCode);
            return {
                translation,
                languageCode: translation.languageCode,
                languageLabel: `${langInfo?.name} / ${langInfo?.nativeName}`
            };
        });
        if (props.translatedLanguage) {
            // if the rendered language is machine-translated, offer the option to switch to the active language
            const activeLangInfo = getLanguageInfo(props.activeLanguageCode);
            options.unshift({
                translation: {
                    languageCode: props.activeLanguageCode,
                    publicationId: activePublication.id,
                },
                languageCode: props.translatedLanguage,
                languageLabel: `${activeLangInfo?.name} / ${activeLangInfo?.nativeName}`,
            });
        }
        return options;
    }, [activePublication.id, props.activeLanguageCode, props.translatedLanguage, props.translations]);

    const {
        isVisible: isDropdownVisible,
        setVisibility: setIsDropdownVisible,
        shouldRender: shouldDropdownRender,
    } = useAnimateVisibility(false);

    return (
        <div className="toolbarLanguage-full">
            <div
                className={cx("toolbarLanguage-full-selectedLanguage", { "toolbarLanguage-full-selectedLanguage--ddOpen": isDropdownVisible })}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsDropdownVisible(!isDropdownVisible) }}
            >
                <label className="toolbarLanguage-full-selectedLanguage-lbl">
                    {`${renderedLanguageLabel}${props.translatedLanguage ? " *" : ""}`}
                </label>
                <Icon className="toolbarLanguage-full-selectedLanguage-icon" name="keyboard_arrow_down" />
            </div>
            {shouldDropdownRender && (
                <div
                    className={`toolbarLanguage-full-dropdown animate-visibility ${isDropdownVisible ? "visible" : "invisible"}`}
                    ref={dropdownRef}
                >
                    {dropdownOptions.map(option => (
                        <div
                            key={option.languageCode}
                            className="toolbarLanguage-full-dropdown-option"
                            onClick={() => {
                                props.switchLanguage(option.translation);
                                setIsDropdownVisible(false);
                            }}
                        >
                            <label>{option.languageLabel}</label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
