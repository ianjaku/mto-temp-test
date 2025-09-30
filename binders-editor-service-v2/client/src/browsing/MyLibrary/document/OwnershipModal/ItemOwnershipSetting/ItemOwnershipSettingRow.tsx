import * as React from "react";
import {
    InheritedSettingsItem,
    Owner,
    isUserOwner
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { MouseEvent, useRef } from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { CollectionLink } from "../../../../../shared/InheritedSettingsNavigator/CollectionLink";
import DeleteIcon from "@binders/ui-kit/lib/elements/icons/Delete";
import GroupIcon from "@binders/ui-kit/lib/elements/icons/Group";
import { PersonIcon } from "@binders/ui-kit/lib/elements/icons/Person/Person";
import cx from "classnames";
import { isUsergroupId } from "@binders/client/lib/clients/userservice/v1/helpers";
import "./ItemOwnershipSettingRow.styl";

export const ItemOwnershipSettingRow: React.FC<{
    disabled?: boolean;
    owner: Owner;
    onDelete: (ownerId: string) => void;
    parentsWithOwner: InheritedSettingsItem[];
    goToItem?: (item: InheritedSettingsItem) => void;
}> = (props) => {
    const isUsergroup = isUsergroupId(props.owner.id);
    const [rowHovered, setRowHovered] = React.useState(false);

    const tooltipRef = useRef(null);
    return (
        <div className="itemOwnershipSetting-overview-row"
            onMouseEnter={() => setRowHovered(true)}
            onMouseLeave={() => setRowHovered(false)}
        >
            <div className="itemOwnershipSetting-overview-row-head">
                <div
                    className={ cx(
                        "itemOwnershipSetting-overview-row-head-property",
                        { "itemOwnershipSetting-overview-row-head-property--disabled": props.disabled ?? false }
                    ) }
                    onMouseEnter={(e: MouseEvent<HTMLElement>) => {
                        if (!isUsergroup) {
                            showTooltip(e, tooltipRef.current, TooltipPosition.BOTTOM);
                        }
                    }}
                    onMouseLeave={(e: MouseEvent<HTMLElement>) => hideTooltip(e, tooltipRef.current)}
                >
                    <span className="itemOwnershipSetting-overview-row-head-property-icon">
                        {isUsergroupId(props.owner.id) ? <GroupIcon /> : <PersonIcon />}
                    </span>
                    {props.owner.name}
                </div>
                <div className="inheritedSettingsNavigator-radiobuttonWrapper">
                    {props.parentsWithOwner.map((parent, i) =>
                        <CollectionLink
                            key={`par-itm-${i}`}
                            collectionTitle={parent.title}
                            onClick={() => props.goToItem(parent)}
                            access={parent.access}
                        />
                    ) }
                </div>
            </div>
            <div className="itemOwnershipSetting-overview-row-tail">
                {rowHovered && !props.disabled && (
                    <span
                        className="itemOwnershipSetting-overview-row-tail-delete"
                        onClick={() => props.onDelete(props.owner.id) }>
                        {DeleteIcon()}
                    </span>
                )}
            </div>
            <Tooltip
                ref={tooltipRef}
                message={isUserOwner(props.owner) ? props.owner.login : ""}
            />
        </div>
    );
}
