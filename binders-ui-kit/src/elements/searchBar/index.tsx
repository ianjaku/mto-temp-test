import * as React from "react";
import { useCallback, useState } from "react";
import SearchInput from "../input/SearchInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useHistory } from "react-router";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./searchBar.styl";

type FlashMessageFn = (message: string, keepOpen?: boolean) => void;

const SearchBar = (props: {
    cleanESQuery?: (query: string) => string;
    initialValue?: string;
    flashmessages: {
        error: FlashMessageFn;
        info: FlashMessageFn;
        success: FlashMessageFn;
    };
    onSubmit?: (query: string) => void;
    scopeCollectionId?: string;
}) => {
    const { cleanESQuery, initialValue, flashmessages, scopeCollectionId, onSubmit } = props;
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue ?? "");
    const history = useHistory();

    const onKeyPress = useCallback((e) => {
        if (history) {
            if (e.key === "Enter") {
                const query = e.target.value;
                const escapedQuery = cleanESQuery ? cleanESQuery(query) : query;
                if (escapedQuery.length === 0) {
                    flashmessages.error(t(TK.DocManagement_SearchCantBeEmpty))
                    return;
                }
                if (onSubmit) {
                    onSubmit(query);
                }
                history.push(`/search/${scopeCollectionId ? `${scopeCollectionId}/` : ""}${escapedQuery}`);
            }
        }
    }, [cleanESQuery, flashmessages, history, onSubmit, scopeCollectionId, t])

    return (
        <header className="searchBar">
            <SearchInput
                value={value}
                onChange={val => setValue(val)}
                className="searchBar-input"
                onKeyPress={e => onKeyPress(e)}
                placeholder={t(TK.DocManagement_SearchDocsCols)}
            />
        </header>
    );
}

export default SearchBar;
