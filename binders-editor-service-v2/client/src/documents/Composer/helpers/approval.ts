import {
    ApprovedStatus,
    IChunkApproval
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Binder from "@binders/client/lib/binders/custom/class";
import { IModuleSet } from "../components/BinderLanguage/types";
import ResetApprovalModal from "../components/modals/ResetApprovalModal";
import { approvalsWithStatus } from "./approvalHelper";
import { chunkIdFromIndex } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { isSemanticallyEmptyChunk } from "../../helper";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { updateChunkApprovals } from "../../actions";

export function mergeApprovals(
    chunkApprovals: IChunkApproval[],
    chunk1: IModuleSet,
    chunk2: IModuleSet,
    options: {
        shouldUseNewTextEditor: boolean,
    },
): IChunkApproval {
    const { text: text1, uuid: uuid1 } = chunk1;
    const { text: text2, uuid: uuid2 } = chunk2;
    const chunk1Empty = isSemanticallyEmptyChunk(text1, options);
    const chunk2Empty = isSemanticallyEmptyChunk(text2, options);
    let approval: IChunkApproval;
    if (chunk1Empty && !chunk2Empty) {
        approval = chunkApprovals.find(a => a.chunkId === uuid2);
    } else if (!chunk1Empty && chunk2Empty) {
        approval = chunkApprovals.find(a => a.chunkId === uuid1);
    }
    return approval;
}

export async function handleResetApproval(
    binder: Binder,
    proposedApprovalResetChunks: number[] = [],
    approvals: IChunkApproval[],
): Promise<void> {
    const visibleLanguageCodes = new Set<string>(binder.getVisibleLanguages().map(language => language.iso639_1));
    const approvedChunkIndices: number[] = [];
    const languageCodesUsed = new Set<string>();
    for (const proposedApprovalResetChunkIndex of proposedApprovalResetChunks) {
        const chunkId = chunkIdFromIndex(binder, proposedApprovalResetChunkIndex);
        if (!chunkId) {
            continue;
        }
        const approvedApprovals = approvalsWithStatus(approvals, chunkId, ApprovedStatus.APPROVED);
        if (approvedApprovals.length === 0) {
            continue;
        }
        approvedChunkIndices.push(proposedApprovalResetChunkIndex);
        approvedApprovals
            .map(chunkApproval => chunkApproval.chunkLanguageCode)
            .filter(languageCode => visibleLanguageCodes.has(languageCode))
            .forEach(languageCode => languageCodesUsed.add(languageCode));
    }

    if (!approvedChunkIndices.length) {
        return;
    }

    const shouldReset = await showModal(ResetApprovalModal, {
        isMulti: approvedChunkIndices.length > 1,
        affectedLanguageCodes: [...languageCodesUsed],
        chunkCount: approvedChunkIndices.length,
    });

    if (shouldReset) {
        await updateChunkApprovals(
            binder.id,
            {
                chunkIndices: approvedChunkIndices,
                approvalStatus: ApprovedStatus.APPROVED,
                chunkLanguageCodes: [...languageCodesUsed],
            },
            ApprovedStatus.UNKNOWN,
        );
    }
}
