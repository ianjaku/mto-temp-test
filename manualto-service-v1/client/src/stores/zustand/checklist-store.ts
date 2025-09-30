import { IChecklist, IChecklistProgress } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { createStore, useStore } from "zustand";

export type ChecklistStoreActions = {
    loadChecklists: (checklists: IChecklist[]) => void;
    loadChecklistsProgress: (checklistsProgress: IChecklistProgress[]) => void;
    patchChecklists: (checklist: IChecklist) => void;
};

export type ChecklistStoreState = {
    checklists: IChecklist[];
    checklistsProgressByBinderId: Map<string, IChecklistProgress>;
};

type ChecklistStore = ChecklistStoreState & { actions: ChecklistStoreActions; };

const checklistStore = createStore<ChecklistStore>(set => ({
    checklists: [],
    checklistsProgressByBinderId: new Map(),
    actions: {
        loadChecklists(checklists) {
            set(prev => ({ ...prev, checklists }))
        },
        loadChecklistsProgress(checklistsProgress) {
            set(prev => ({
                ...prev,
                checklistsProgressByBinderId: checklistsProgress.reduce(
                    (reduced, item) => reduced.set(item.binderId, item),
                    new Map(prev.checklistsProgressByBinderId),
                ),
            }));
        },
        patchChecklists(checklist) {
            set(prev => ({
                ...prev,
                checklists: patchChecklists(prev.checklists, checklist),
                checklistsProgressByBinderId: resetChecklistsProgress(prev.checklistsProgressByBinderId, checklist.binderId),
            }));
        },
    },
}));

function patchChecklists(checklists: IChecklist[], checklist: IChecklist) {
    return [
        ...checklists.filter(c => c.id !== checklist.id),
        checklist
    ]
}

function resetChecklistsProgress(allChecklistsProgress: Map<string, IChecklistProgress>, binderId: string) {
    allChecklistsProgress.delete(binderId);
    return allChecklistsProgress;
}

/**
 * @deprecated use hook functions instead
 */
export function getChecklistStoreActions(): ChecklistStoreActions {
    return checklistStore.getState().actions;
}

/** @deprecated Use {@link useChecklistStoreState} with a selector to **prevent unnecessary rerenders** and **don't select multiple props** */
export function useChecklistStoreState(): ChecklistStoreState;
export function useChecklistStoreState<T>(selector: (state: ChecklistStore) => T): T;
export function useChecklistStoreState<T>(selector?: (state: ChecklistStore) => T) {
    return useStore(checklistStore, selector);
}

export function useChecklistStoreActions(): ChecklistStoreActions {
    const actions = useChecklistStoreState(state => state.actions);
    return actions;
}

