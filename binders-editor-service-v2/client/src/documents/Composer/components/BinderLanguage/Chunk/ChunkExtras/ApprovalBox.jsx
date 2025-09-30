import * as React from "react";
import { findApproval, getBinderLogEntry } from "../../../../helpers/approvalHelper"
import Approved from "@binders/ui-kit/lib/elements/icons/Approved";
import { ApprovedStatus } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Rejected from "@binders/ui-kit/lib/elements/icons/Rejected";
import Unknown from "@binders/ui-kit/lib/elements/icons/Unknown";
import cx from "classnames";
import "./approvalBox.styl";

const { useMemo, useRef } = React;

const ApprovalBox = ({
    binder,
    chunkApprovals,
    chunkPosition,
    languageCode,
    onMouseEnter,
    onMouseLeave,
    isEnabled,
}) => {
    const logEntry = getBinderLogEntry(binder, chunkPosition);
    const approval = useMemo(() =>
        findApproval(chunkApprovals, logEntry, languageCode, chunkPosition === -1 && binder.id), [binder.id, chunkApprovals, chunkPosition, languageCode, logEntry]
    );
    const ref = useRef(null);

    return (
        <div
            className={`approval-box ${approval ? approval.approved : ""}`}
            onMouseEnter={onMouseEnter(approval)}
            onMouseLeave={onMouseLeave(undefined)}
            ref={ref}
        >
            <div className={cx("approval-status", { "approval-status--disabled": !isEnabled })} >
                {getSideButtonIcon(approval)}
            </div>
        </div>
    );
}

const getSideButtonIcon = (approval) => {
    if (!approval || approval.approved === ApprovedStatus.UNKNOWN) {
        return <Unknown />;
    }
    return approval.approved === ApprovedStatus.APPROVED ? <Approved /> : <Rejected />;
}

export default ApprovalBox;