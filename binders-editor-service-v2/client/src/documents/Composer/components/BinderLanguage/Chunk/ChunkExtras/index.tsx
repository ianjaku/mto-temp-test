import * as React from "react";
import { FEATURE_AI_CONTENT_FORMATTING, FEATURE_APPROVAL_FLOW } from "@binders/client/lib/clients/accountservice/v1/contract";
import { IChecklistConfig, IChunkApproval } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IPermissionFlag, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { findApproval, getBinderLogEntry } from "../../../../helpers/approvalHelper";
import AccountStore from "../../../../../../accounts/store";
import ApprovalModule from "./ApprovalModule";
import ChunkContextMenu from "./ChunkContextMenu";
import { IChunkProps } from "./types";
import { IWebData } from "@binders/client/lib/webdata";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import "./chunkExtras.styl";

const { useMemo, useRef } = React;

type IChunkExtrasProps = IChunkProps & {
    checklistConfig?: IChecklistConfig;
    chunkApprovals?: IChunkApproval[];
    chunkIndex: number;
    isMobile?: boolean;
    permissionFlags: IPermissionFlag[];
    users: User[];
}

const ChunkExtras: React.FC<IChunkExtrasProps> = (props: IChunkExtrasProps) => {
    const {
        isEmpty,
        permissionFlags,
        users,
        binder,
        chunkApprovals,
        isMobile,
        languageCode,
        includeChecklist,
        chunkIndex,
        checklistConfig,
        chunkId,
        onChunkOperation,
    } = props;

    const accountFeatures: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());
    const featuresApprovalFlow = useMemo(() => accountFeatures.data?.includes(FEATURE_APPROVAL_FLOW), [accountFeatures]);
    const featuresAiContentFormatting = useMemo(() => accountFeatures.data?.includes(FEATURE_AI_CONTENT_FORMATTING), [accountFeatures]);

    const ref = useRef(null);
    const chunkPosition = useMemo(() => chunkIndex - 1, [chunkIndex]);
    const renderApprovalModule = () => featuresApprovalFlow && (
        <ApprovalModule
            binder={binder}
            chunkApprovals={chunkApprovals}
            chunkPosition={chunkPosition}
            isEmpty={isEmpty}
            languageCode={languageCode}
            permissionFlags={permissionFlags}
            users={users}
            isMobile={isMobile}
        />
    );

    const hasReviewPermission = useMemo(
        () => permissionFlags.some(
            pf => pf.permissionName === PermissionName.REVIEW &&
                (pf.languageCodes == null || pf.languageCodes.includes(languageCode))
        ),
        [permissionFlags, languageCode]
    );
    const showContextMenu = (featuresApprovalFlow && hasReviewPermission) || includeChecklist || (featuresAiContentFormatting && chunkPosition >= 0);

    const logEntry = useMemo(() => getBinderLogEntry(binder, chunkPosition), [binder, chunkPosition]);
    const approval = useMemo(() =>
        findApproval(chunkApprovals, logEntry, languageCode, chunkPosition === -1 && binder["id"]), [binder, chunkApprovals, chunkPosition, languageCode, logEntry]
    );
    const isChecklistActive = useMemo(() => checklistConfig && checklistConfig.isActive, [checklistConfig]);

    const renderContextMenu = () => showContextMenu && (
        <ChunkContextMenu
            approval={approval}
            binder={binder}
            chunkId={chunkId}
            chunkPosition={chunkPosition}
            featuresAiContentFormatting={featuresAiContentFormatting}
            featuresApprovalFlow={featuresApprovalFlow}
            hasReviewPermission={hasReviewPermission}
            includeChecklist={includeChecklist}
            isChecklistActive={isChecklistActive}
            isEmpty={isEmpty}
            languageCode={languageCode}
            onChunkOperation={onChunkOperation}
        />
    )

    return (
        <div className="chunk-extras" ref={ref}>
            {renderApprovalModule()}
            {renderContextMenu()}
        </div>
    )
}

export default ChunkExtras;
