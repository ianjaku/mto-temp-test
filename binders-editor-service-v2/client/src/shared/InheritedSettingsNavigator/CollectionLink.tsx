import * as React from "react";
import Tooltip, {
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { ItemConfigAccessType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { useTranslation } from "react-i18next";
import "./CollectionLink.styl";

export const CollectionLink: React.FC<{
    collectionTitle: string | null,
    onClick: () => void,
    access?: ItemConfigAccessType,
}> = ({ collectionTitle, onClick, access = ItemConfigAccessType.EDITABLE }) => {
    const isCollectionEditable = access === ItemConfigAccessType.EDITABLE;
    const isCollectionForbidden = access === ItemConfigAccessType.FORBIDDEN;
    const { t } = useTranslation();
    const tooltipRef = React.useRef(null);
    return (
        <div
            className={cx(
                "collectionLink",
                { "collectionLink--disabledNav": !isCollectionEditable },
                { "collectionLink--disabledNav-blocked": !isCollectionEditable && !isCollectionForbidden },
            )}
            onClick={isCollectionEditable ? onClick : undefined}
            onMouseEnter={e => {
                if (isCollectionForbidden) {
                    showTooltip(e, tooltipRef.current);
                }
            }}
            onMouseLeave={e => {
                if (isCollectionForbidden) {
                    hideTooltip(e, tooltipRef.current);
                }
            }}
        >
            {isCollectionForbidden ? <Icon name={"folder_off"}></Icon> : <Icon name={"folder"}></Icon>}
            <label className="collectionLink-label">{collectionTitle ?? t(TK.General_RestrictedAccess)}</label>
            {isCollectionEditable ? <Icon name={"north_east"}></Icon> : null}
            <Tooltip
                ref={tooltipRef}
                message={isCollectionForbidden ? t(TK.DocManagement_ColVisibilityRestrictedAccess) : null}
            />
        </div>
    );
}