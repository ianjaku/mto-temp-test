import * as React from "react";
import { getAllLanguageCodes, toLanguageLabel } from "@binders/client/lib/languages/helper";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useMemo } = React;

interface ILanguageRestrictionInputProps {
    onSelectLanguage: (langCode: string) => void;
    featuresDialects?: boolean;
}

const LanguageRestrictionInput: React.FC<ILanguageRestrictionInputProps> = ({ onSelectLanguage, featuresDialects }) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { t }: { t: any } = useTranslation();

    const languageElements = useMemo(() => {
        return getAllLanguageCodes(featuresDialects).map(langCode => ({ id: langCode, label: toLanguageLabel(langCode) }))
    }, [featuresDialects]);

    return (
        <div className="roleInput-selection">
            <FilterableDropdown
                type={t(TK.General_Language)}
                elements={languageElements}
                onSelectElement={onSelectLanguage}
                maxHeight={120}
            />
        </div>
    )
}

export default LanguageRestrictionInput;
