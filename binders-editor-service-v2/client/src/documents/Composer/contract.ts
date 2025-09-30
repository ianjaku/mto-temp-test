import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import { IChunkApproval } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export interface IVisualPosition {
    chunkIndex: number;
    visualIndex: number;
}

export interface IPreviewVisual {
    id: string,
    filename: string,
    preview: boolean,
    url: string,
    fitBehaviour: FitBehaviour,
    bgColor: string,
    positions: IVisualPosition[],
    isUploading: boolean,
    percentUploaded: number,
}

export interface IChunkApprovalStatus {
    languageCode: string;
    approval: IChunkApproval;
}

export interface ComposerSession {
    sessionId: string;
    binderId: string;
    itemId: string;
    itemKind: string;
    userId: string;
    itemTitle?: string,
    isoCode?: string,
}
