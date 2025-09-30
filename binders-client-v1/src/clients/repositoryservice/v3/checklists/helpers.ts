import { IChecklist, IChecklistPerformedHistory } from "../contract";
import { isAfter } from "date-fns";

export const getMostRecentHistoryItem = (
    checklist: IChecklist
): IChecklistPerformedHistory => {
    if (checklist.performedHistory.length === 0) return null;
    return checklist.performedHistory.reduce((a, b) => {
        if (isAfter(new Date(a.lastPerformedDate), new Date(b.lastPerformedDate))) {
            return a;
        } else {
            return b;
        }
    });
}
