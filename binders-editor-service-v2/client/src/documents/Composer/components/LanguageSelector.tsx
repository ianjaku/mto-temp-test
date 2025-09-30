import * as React from "react";
import Close from "@binders/ui-kit/lib/elements/icons/Close"
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { Language } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { getLanguageLabel } from "@binders/client/lib/languages/helper";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "../composer.styl";

export const LanguageSelector: React.FC<{
    className?: string;
    hasCloseButton: boolean;
    languageCode: string;
    languages: Language[];
    onClose: () => void;
    onSelectLanguageCode: (lang: unknown, cb?: unknown) => void;
    readonlyMode: boolean;
    selectedLanguageCode: string
}> = ({
    className,
    hasCloseButton,
    languageCode,
    languages,
    onClose,
    onSelectLanguageCode,
    readonlyMode,
    selectedLanguageCode,
}) => {

    const { t } = useTranslation();
    const languageElements = [
        toLanguageElement(languages.find(l => l.iso639_1 === selectedLanguageCode)),
        ...languages.filter(lang => lang.iso639_1 !== selectedLanguageCode).map(toLanguageElement)
    ];

    const isPrimaryLanguageNotSet = languages.filter(({ iso639_1 }) => iso639_1 === UNDEFINED_LANG).length > 0

    if (
        languageCode === UNDEFINED_LANG ||
        !languages.filter(({ iso639_1 }) => iso639_1 === languageCode).length
    ) {
        return null;
    }

    return (
        <div
            className={`language-selectors-selector ${className}`}
        >
            {(languages.length > 1 && !isPrimaryLanguageNotSet) ?
                <Dropdown
                    type={t(TK.General_Language)}
                    elements={languageElements}
                    selectedElementId={selectedLanguageCode}
                    maxRows={5}
                    className="language-selectors-selector-dropdown"
                    onSelectElement={lang => onSelectLanguageCode?.(lang)}
                    selectedLabelPrefix={readonlyMode ? "" : `${t(TK.General_Edit)} `}
                    hideSelectedElementInList={true}
                    showBorders={false}
                /> :
                (
                    <span className="language-selectors-selector-label">
                        {
                            languages.length > 0 && (
                                readonlyMode ?
                                    getLanguageLabel(languages[0].iso639_1, false) :
                                    t(TK.Edit_Language, { language: getLanguageLabel(languages[0].iso639_1, false) })
                            )
                        }
                    </span>
                )
            }
            {hasCloseButton && (
                <div onClick={onClose} className="language-selectors-selector-close">
                    {Close({ fontSize: 14, fontWeight: 800 })}
                </div>
            )}
        </div>
    );
}

function toLanguageElement(language: Language) {
    return {
        id: language.iso639_1,
        label: getLanguageLabel(language.iso639_1, true),
    }
}
