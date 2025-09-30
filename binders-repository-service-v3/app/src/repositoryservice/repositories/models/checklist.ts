import { IChecklistPerformedHistory } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IChecklistPerformedHistoryDocument } from "../checklistsrepository";
import UUID from "@binders/client/lib/util/uuid";

export class ChecklistConfig {
    constructor(
        public readonly id: string,
        public readonly binderId: string,
        public readonly chunkId: string,
        public readonly isActive: boolean
    ) { }

    static create(binderId: string, chunkId: string, isActive: boolean): ChecklistConfig {
        return new ChecklistConfig(
            UUID.randomWithPrefix("chc-"),
            binderId,
            chunkId,
            isActive)
    }
}


export class Checklist {
    constructor(
        public readonly id: string,
        public readonly binderId: string,
        public readonly chunkId: string,
        public readonly performed: boolean,
        public readonly performedHistory: IChecklistPerformedHistory[]
    ) { }

    static create(binderId: string, chunkId: string): Checklist {
        return new Checklist(
            UUID.randomWithPrefix("che-"),
            binderId,
            chunkId,
            false,
            [])
    }

    static createFullModel(id: string, binderId: string, chunkId: string, performed: boolean, performedHistory: IChecklistPerformedHistoryDocument[]): Checklist {
        const history = performedHistory.map(
            (dao) => ({
                lastPerformedByUserId: dao.lastPerformedByUserId,
                lastPerformedDate: dao.lastPerformedDate,
                performed: dao.performed,
                step: dao.step,
                publicationId: dao.publicationId
            })
        );
        return new Checklist(
            id,
            binderId,
            chunkId,
            performed,
            history
        )
    }
}

