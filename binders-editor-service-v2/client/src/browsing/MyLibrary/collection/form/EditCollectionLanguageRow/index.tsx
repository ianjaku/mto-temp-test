import * as React from "react";
import {
    FEATURE_DIALECTS,
    FEATURE_GHENTIAN_DIALECT
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { useActiveAccountFeatures, useActiveAccountId } from "../../../../../accounts/hooks";
import { APITranslate } from "../../../../../machinetranslation/api";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import DeleteButton from "@binders/ui-kit/lib/elements/button/DeleteButton";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import FloatingMenu from "@binders/ui-kit/lib/elements/floatingmenu";
import Input from "@binders/ui-kit/lib/elements/input";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { checkLanguageAvailability } from "../../../../../machinetranslation/helpers";
import { getLanguageElements } from "../../../../tsHelpers";
import { getLanguageInfo } from "@binders/client/lib/languages/helper";
import useCalcFloatingMenuPosition from "@binders/ui-kit/lib/elements/floatingmenu/useCalcFloatingMenuPosition";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";

export interface LanguageRow {
    languageCode: string;
    name: string;
    languageLabel: string
    isUndefinedLanguage: boolean;
}

interface LanguageForTranslation {
    code: string;
    name: string;
}
interface Props {
    languageRow: LanguageRow;
    translatorLanguages: Array<string | number>;
    collection: DocumentCollection;
    onSelectLanguage: (languageCode: string) => void;
    onChangeName: (name: string) => void;
    onRetainTempName: () => void;
    onBlurName: () => void;
    onRemoveCollectionTitle: () => void;
    isLoading: boolean;
    undeletable?: boolean;
    languagesForTranslation: LanguageForTranslation[],
    supportedLanguagesMap: { [engineType: string]: string[] };
}

const EditCollectionLanguageRow: React.FC<Props> = ({
    languageRow,
    translatorLanguages,
    collection,
    onSelectLanguage,
    onChangeName,
    onRetainTempName,
    onBlurName,
    isLoading,
    undeletable,
    onRemoveCollectionTitle,
    languagesForTranslation,
    supportedLanguagesMap,
}) => {
    const accountId: string = useActiveAccountId();
    const { languageCode, name, languageLabel, isUndefinedLanguage } = languageRow;
    const { t } = useTranslation();

    const [machineTranslationLangItems, mtIsUnavailable] = useMemo(() => {
        const items = languagesForTranslation
            .filter(l => l.code !== languageCode && checkLanguageAvailability(supportedLanguagesMap, l.code, languageCode))
            .map(language => {
                const { name, nativeName } = getLanguageInfo(language.code);
                const languageLabel = name === nativeName ? name : `${name} (${nativeName})`;
                return ({
                    text: t(TK.Edit_TranslateFrom, { language: languageLabel }),
                    onClick: async () => {
                        const translation = await APITranslate(
                            accountId,
                            language.name,
                            language.code,
                            languageCode,
                            false,
                        );
                        onChangeName(translation);
                    },
                });
            });
        if (!(items.length)) {
            return [
                [{
                    text: t(TK.Edit_MachineTranslationNotAvailable),
                    disabled: true,
                }],
                true
            ];
        }
        return [items, false];
    }, [accountId, languageCode, languagesForTranslation, onChangeName, supportedLanguagesMap, t]);

    const isTranslatorLanguage = translatorLanguages.length > 0 && translatorLanguages.includes(languageCode);
    const isTranslatorView = translatorLanguages.length > 0;

    const accountFeatures = useActiveAccountFeatures();

    const inputRef = React.useRef(null);

    const { left: inputLeft, top: inputTop } = useCalcFloatingMenuPosition(inputRef);

    const languageElements = useMemo(() => {
        if (!collection) {
            return [];
        }
        const { elements } = getLanguageElements({
            languageCodesToDisable: collection.titles.map(({ languageCode }) => languageCode),
            languageCodesToDisableSuffix: ` (${t(TK.Edit_LangAlreadyAdded)})`,
            includeDialects: accountFeatures.includes(FEATURE_DIALECTS),
            includeGhentianDialect: accountFeatures.includes(FEATURE_GHENTIAN_DIALECT),
        });
        let languageElements = elements;
        if (translatorLanguages.length > 0) {
            languageElements = languageElements.filter(l => translatorLanguages.includes(l.id));
        }
        return languageElements;
    }, [accountFeatures, collection, t, translatorLanguages]);

    const [inputFocused, setInputFocused] = React.useState(false);

    const onFocus = () => {
        setInputFocused(true);
        onRetainTempName();
    };
    const onBlur = () => {
        setInputFocused(false);
        onBlurName();
    };

    return (
        <tr>
            <td>
                {isUndefinedLanguage ?
                    (
                        <div className="collectionForm-control">
                            <FilterableDropdown
                                type={t(TK.General_Language)}
                                elements={languageElements}
                                maxRows={5}
                                className="collectionForm-control"
                                selectedElementId={languageCode}
                                onSelectElement={onSelectLanguage}
                            />
                        </div>
                    ) :
                    (
                        <div className="collectionForm-languageLabel">{languageLabel}</div>
                    )
                }
            </td>
            <td>
                <div className="collectionForm-control" ref={inputRef}>
                    <Input
                        type="text"
                        name="name"
                        className="collectionForm-control"
                        value={name}
                        placeholder={t(TK.DocManagement_ColName)}
                        disabled={isTranslatorView && !isTranslatorLanguage}
                        onChange={onChangeName}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        changeOnEnter={true}
                        autoComplete={"off"}
                    />
                    {languageCode && !name?.trim() && inputFocused ?
                        (
                            <FloatingMenu
                                left={inputLeft}
                                top={inputTop + 52}
                                arrowLeft={10}
                                arrowPosition="top"
                                items={machineTranslationLangItems}
                                name="col-mt"
                                unrestrictedWidth={mtIsUnavailable}
                            />
                        ) :
                        null
                    }
                </div>
            </td>
            <td>
                {isLoading ?
                    CircularProgress() :
                    (
                        <DeleteButton
                            isDisabled={undeletable || languageRow.isUndefinedLanguage || (isTranslatorView && !isTranslatorLanguage)}
                            onClick={onRemoveCollectionTitle}
                        />
                    )}
            </td>
        </tr>
    )
}

export default EditCollectionLanguageRow