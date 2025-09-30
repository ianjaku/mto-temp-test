import * as React from "react";
import CloudIcon from "../../elements/icons/Cloud";
import CreateCollectionIcon from "../../elements/icons/CreateCollection";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ScopeTitle.styl";

const { useMemo } = React;

interface IProps {
    isTruncated: boolean;
    hitCount: number;
    inScope: boolean;
}

const ScopeTitle: React.FC<IProps> = ({ isTruncated, hitCount, inScope }) => {
    const { t } = useTranslation();

    const [icon, regularLbl, truncatedLbl] = useMemo(() => inScope ?
        [<CreateCollectionIcon />, TK.DocManagement_SearchResultsInfoInScope, TK.DocManagement_SearchResultsInfoAtLeastInScope] :
        [<CloudIcon />, TK.DocManagement_SearchResultsInfoOutScope, TK.DocManagement_SearchResultsInfoAtLeastOutScope],
    [inScope]);
    const lbl = isTruncated ? truncatedLbl : regularLbl;
    return (
        <div className="scopeTitle scopeTitle-post">
            {icon}
            <span>
                {t(lbl, { count: hitCount })}
            </span>
        </div>
    )
}

export default ScopeTitle;
