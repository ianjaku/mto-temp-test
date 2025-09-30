import * as React from "react";
import Dropdown from "../../elements/dropdown";
import { IContentInfo } from "@binders/client/lib/clients/userservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { getLanguageNativeName } from "@binders/client/lib/languages/helper";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./multilingualpanel.styl";

const { useState, useCallback, useMemo } = React;

interface IProps {
    contentMap: { [languageCode: string]: IContentInfo };
}

const MultilingualPanel: React.FC<IProps> = ({ contentMap }) => {

    const { t } = useTranslation();

    const [activeLanguageCode, setActiveLanguageCode] = useState(
        contentMap["en"] ? "en" : [...Object.keys(contentMap)].shift(),
    )
    const contentInfo = useMemo(() => contentMap[activeLanguageCode], [activeLanguageCode, contentMap]);

    const renderHeader = useCallback(() => {
        return (
            <div className="multilingualPanel-header">
                <h1>{(contentInfo?.info?.titleOverride || t(TK.General_TermsTitle))}</h1>
                {Object.keys(contentMap || []).length > 1 && (
                    <Dropdown
                        type="activeLanguage"
                        elements={Object.keys(contentMap).map(languageCode => ({
                            id: languageCode,
                            label: getLanguageNativeName(languageCode),
                        }))}
                        selectedElementId={activeLanguageCode}
                        onSelectElement={(id: string) => setActiveLanguageCode(id)}
                    />
                )}
            </div>
        )
    }, [activeLanguageCode, contentInfo, contentMap, t]);

    const renderBody = useCallback(() => {
        return (
            <div className="multilingualPanel-body" dangerouslySetInnerHTML={{ __html: contentInfo?.content }} />
        )
    }, [contentInfo]);

    return (
        <div className="multilingualPanel">
            {renderHeader()}
            {renderBody()}
        </div>
    )
}

export default MultilingualPanel;