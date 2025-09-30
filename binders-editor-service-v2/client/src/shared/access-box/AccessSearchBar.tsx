import * as React from "react";
import ArrowBtn from "./ArrowBtn";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { useTranslation } from "@binders/client/lib/react/i18n";


interface Props {
    title: string;
    onSearchTermChange: (searchTerm: string) => void;
    onSearch: (e) => void;
    isExpanded: boolean;
    setIsExpanded: () => void;
}

const AccessSearchBar: React.FC<Props> = ({
    title,
    onSearchTermChange,
    onSearch,
    isExpanded,
    setIsExpanded,
}) => {
    const { t } = useTranslation();

    const collapsable = isMobileView();

    return (
        <div className="accessBox-searchBar">
            <div className="accessBox-searchBar-header" onClick={() => setIsExpanded()}>
                <p className="accessBox-searchBar-header-title">{title}</p>
                {collapsable && (
                    <ArrowBtn isExpand={isExpanded} />
                )}
            </div>
            <div className="accessBox-searchBar-body">
                <SearchInput
                    placeholder={`${t(TK.General_Search)}...`}
                    onChange={onSearchTermChange}
                    onKeyPress={onSearch}
                    className="accessBox-searchBar-body-input"
                />
            </div>
        </div>
    )
}

export default AccessSearchBar;