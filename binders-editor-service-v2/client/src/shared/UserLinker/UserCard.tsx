import * as React from "react";
import { FC, useCallback, useRef, useState } from "react";
import { Tooltip, TooltipPosition, hideTooltip, showTooltip } from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import type { IUserCard } from "./UserLinkerListCards";
import cx from "classnames";

export type IUserLinkerCardProps = {
    fullWidth?: boolean;
    onUnlinkUser: (userId: string) => Promise<void>;
    userCard: IUserCard;
}

const UserCard: FC<IUserLinkerCardProps> = ({ fullWidth, onUnlinkUser, userCard }) => {
    const [isLoading, setIsLoading] = useState(false);
    const onUnlink = useCallback(async () => {
        setIsLoading(true);
        await onUnlinkUser(userCard.id);
        setIsLoading(false);
    }, [onUnlinkUser, userCard]);
    const tooltipRef = useRef<Tooltip>();

    return (
        <div
            className={cx(
                "userLinkerListCards-card",
                fullWidth && "userLinkerListCards-card__fullWidth",
            )}
            onMouseOver={(e) => userCard.tooltip && tooltipRef.current && showTooltip(e, tooltipRef.current, TooltipPosition.BOTTOM)}
            onMouseOut={(e) => userCard.tooltip && hideTooltip(e, tooltipRef.current)}
        >
            <div className={cx("userLinkerListCards-card-lbl", "userLinkerListCards-card-primLbl")}>
                {userCard.icon && (
                    <div className="userLinkerListCards-card-lbl-icon">
                        {userCard.icon}
                    </div>
                )}
                {userCard.primaryLabel}
            </div>
            {userCard.secondaryLabel && (
                <div className={cx("userLinkerListCards-card-lbl", "userLinkerListCards-card-secondLbl")}>
                    {userCard.secondaryLabel}
                </div>
            )}
            <div className="userLinkerListCards-card-alignEnd">
                {isLoading ?
                    CircularProgress() :
                    (
                        <div onClick={onUnlink} className="userLinkerListCards-card-unlinkBtn">
                            <Delete />
                        </div>
                    )}
            </div>
            {userCard.tooltip && <Tooltip ref={ref => { tooltipRef.current = ref }} message={userCard.tooltip} />}
        </div>
    )
}

export default UserCard;
