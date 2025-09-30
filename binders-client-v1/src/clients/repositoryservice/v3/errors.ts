import { IChecklist } from "./contract";

/**
 * Thrown when "togglePerformed" gets called with "performed" being the same value as
 * the current checklist performed value.
 */
export class ChecklistAlreadyInThatStateError extends Error {
    public static NAME = "ChecklistAlreadyInThatStateError";

    constructor(
        public readonly checklist: IChecklist,
    ) {
        super(`"performed" attribute on checklist with id ${checklist.id} was already ${checklist.performed}`);
        this.name = ChecklistAlreadyInThatStateError.NAME;
    }
}

export const isChecklistAlreadyInStateError = (
    error: Error
): error is ChecklistAlreadyInThatStateError => {
    return error.name === ChecklistAlreadyInThatStateError.NAME;
}

export class NothingToUnpublish extends Error {
    static readonly NAME = "NothingToUnpublish";
    static readonly MESSAGE_START = "No active publication for given binder id";
    constructor(public readonly binderId: string,public readonly languageCode: string) {
        super();
        this.message = `${NothingToUnpublish.MESSAGE_START}: ${binderId}, ${languageCode}`;
        this.name = NothingToUnpublish.NAME;
    }
}
