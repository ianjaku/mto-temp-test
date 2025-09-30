import * as React from "react";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import MTPair from "./MTPair";
import { setMTSettingsLanguagePair } from "../../../actions";
import { useSupportedLanguagesMap } from "../../../../machinetranslation/useSupportedLanguagesMap";
const { useState, useCallback } = React;

interface IProps {
    accountId: string;
    pairs?: { [languageCodesSerialized: string]: MTEngineType };
    accountFeatures: string[];
}

const MTSettingsPairs: React.FC<IProps> = ({ pairs, accountId, accountFeatures }) => {

    const [isNewInputCollapsed, setIsNewInputCollapsed] = useState(true);

    const onUpdatePair = useCallback((languageCodesSerialized, engineType, replacesLanguageCodesSerialized) => {
        setMTSettingsLanguagePair(accountId, languageCodesSerialized, engineType, replacesLanguageCodesSerialized);
        setIsNewInputCollapsed(true);
    }, [accountId]);

    const supportedLanguagesMap = useSupportedLanguagesMap();

    const renderPairInput = React.useCallback(() => {
        return supportedLanguagesMap && (
            <MTPair
                isNewMode={true}
                isNewInputCollapsed={isNewInputCollapsed}
                setIsNewInputCollapsed={setIsNewInputCollapsed}
                onUpdatePair={onUpdatePair}
                supportedLanguagesMap={supportedLanguagesMap}
                accountFeatures={accountFeatures}
            />
        );
    }, [accountFeatures, isNewInputCollapsed, onUpdatePair, supportedLanguagesMap]);

    const renderPairs = React.useCallback(() => {
        return supportedLanguagesMap &&
            Object.keys(pairs).sort().map((languageCodesSerialized) => (
                <MTPair
                    key={`mtpair${languageCodesSerialized}${pairs[languageCodesSerialized]}`}
                    languageCodesSerialized={languageCodesSerialized}
                    engineType={pairs[languageCodesSerialized]}
                    onUpdatePair={onUpdatePair}
                    supportedLanguagesMap={supportedLanguagesMap}
                    accountFeatures={accountFeatures}
                />
            ))
    }, [accountFeatures, onUpdatePair, pairs, supportedLanguagesMap]);

    return (
        <div className="mt-settings-pairs">
            {renderPairs()}
            {renderPairInput()}
        </div>
    )
}

export default MTSettingsPairs;