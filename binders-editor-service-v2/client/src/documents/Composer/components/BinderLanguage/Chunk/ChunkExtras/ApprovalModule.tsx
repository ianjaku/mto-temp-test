import * as React from "react";
import { IPermissionFlag, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Tooltip, { hideTooltip, showTooltip } from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import ApprovalBox from "./ApprovalBox";
import { ApprovedStatus } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Binder from "@binders/client/lib/binders/custom/class";
import { IChunkApproval } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { flagsContainPermissions } from "../../../../../../authorization/tsHelpers";
import { fmtDateTimeRelative } from "@binders/client/lib/util/date";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useMemo, useRef, useCallback, useState } = React;

export interface IApprovalModuleProps {
    binder: Binder;
    chunkApprovals: IChunkApproval[];
    chunkPosition: number;
    isEmpty?: boolean;
    languageCode: string;
    permissionFlags: IPermissionFlag[];
    users: User[];
    isMobile: boolean;
}

const ApprovalModule: React.FC<IApprovalModuleProps> = (props: IApprovalModuleProps) => {
    const {
        binder,
        chunkApprovals,
        chunkPosition,
        isEmpty,
        languageCode,
        permissionFlags,
        users,
        isMobile,
    } = props;
    const { t }: { t: TFunction } = useTranslation();
    const tooltipRef = useRef(null);
    const [hoveredApproval, setHoveredApproval] = useState();

    const updateHoveredApproval = useCallback((approval) => {
        return (e) => {
            e.persist(); // needed to access event asynchronously. See more at https://reactjs.org/docs/events.html#event-pooling
            setHoveredApproval(approval);
            if (approval) {
                showTooltip(e, tooltipRef.current);
            } else {
                hideTooltip(e, tooltipRef.current)
            }
        };
    }, [setHoveredApproval, tooltipRef]);

    const isReviewer = useMemo(() =>
        flagsContainPermissions(permissionFlags, [PermissionName.REVIEW, PermissionName.ADMIN]), [permissionFlags]);

    const getNoApprovalTooltipMessage = useCallback(() => {
        if (hoveredApproval) {
            const { approved, approvedByUser, approvedAt } = hoveredApproval;
            const toBeApproved = !hoveredApproval || approved === ApprovedStatus.UNKNOWN;
            const approver = !!hoveredApproval && users && users.find(u => u.id === approvedByUser);
            const approverName = approver && (approver.displayName || approver.login || approvedByUser);
            const approvedDate = approvedAt ?
                fmtDateTimeRelative(new Date(approvedAt), { addSuffix: true, includeSeconds: true }) :
                undefined;
            if (!isReviewer) {
                return t(TK.General_NoPermissions)
            }
            return toBeApproved ?
                t(TK.Edit_ChunkToApprove) :
                t(TK.Edit_ChunkApproved, {
                    approved,
                    approverName,
                    approvedDate,
                });

        }
    }, [hoveredApproval, isReviewer, users, t])

    const renderApprovalStatusTooltip = useCallback(() => {
        return (
            <Tooltip
                key="hovered-approval"
                ref={tooltipRef}
                message={getNoApprovalTooltipMessage()}
            />
        );
    }, [tooltipRef, getNoApprovalTooltipMessage]);

    return isEmpty ?
        null :
        (
            <React.Fragment>
                <ApprovalBox
                    binder={binder}
                    chunkApprovals={chunkApprovals}
                    chunkPosition={chunkPosition}
                    isEnabled={isReviewer}
                    languageCode={languageCode}
                    onMouseEnter={updateHoveredApproval}
                    onMouseLeave={updateHoveredApproval}
                />
                {!isMobile && renderApprovalStatusTooltip()}
            </React.Fragment>
        );
};

export default ApprovalModule;