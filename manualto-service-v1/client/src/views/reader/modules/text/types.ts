import { ContentChunkKind, IBinderLog, IChecklist } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ActiveDocument } from "../../../../stores/zustand/binder-store";

export enum ScrollDirection {
    Down,
    Up,
}

export type ContentChunkProps = {
    accountId: string;
    binderId: string;
    binderLog: IBinderLog | null;
    checklist?: IChecklist;
    checklistByChunkId: Record<string, IChecklist>;
    checklistProgressBlock: boolean;
    checklists: IChecklist[];
    checklistsReset: boolean;
    chunk: string[];
    chunks: string[][];
    chunksImages: string[][];
    chunksKinds: ContentChunkKind[];
    chunkId?: string;
    chunkIdByIndex: Record<string, string>;
    chunkIndex: number;
    closest: number;
    htmlTransformer?: (s: string) => string;
    imageViewportDims: { width: number, height: number };
    isActive: boolean;
    isBlocking?: boolean;
    isLastChunk?: boolean;
    kind?: ContentChunkKind;
    language: string;
    minPadding: number;
    onMouseDown: React.MouseEventHandler<HTMLDivElement>;
    onTextSelection?: (e: React.MouseEvent<Element, MouseEvent>) => void;
    onTogglePerformed?: (checklistId: string, performed: boolean) => void;
    translatedLanguage?: string;
    translatedTitle?: string;
    userId: string;
    viewable: ActiveDocument;
    mediaModuleTailslotRef?: HTMLDivElement;
}

