import {
    Binder,
    IChecklistAction,
    IChecklistConfig
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useCallback, useMemo } from "react";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { compareAsc } from "date-fns";
import { useItems } from "../../hooks";
import { useUsers } from "../../../users/query";

export const useUsersMapForActions = (
    actions: IChecklistAction[]
): {
    data: Record<string, User>;
    isFetching: boolean;
    getDisplayName: (userId: string) => string;
} => {
    const userIds = useMemo(() => {
        return (actions ?? []).map(action => action.performedByUserId).filter(id => id != null);
    }, [actions]);

    const {
        data: users,
        isFetching,
    } = useUsers(userIds);

    const usersMap = useMemo(() => {
        if (users == null) return {};
        const map = {};
        users.forEach(user => map[user.id] = user);
        return map;
    }, [users]);

    return {
        data: usersMap,
        isFetching,
        getDisplayName(userId: string): string {
            if (usersMap == null) return null;
            const user = usersMap[userId];
            return user?.displayName ?? user?.login ?? null;
        }
    };
}

export const useBindersMapForActions = (
    actions: IChecklistAction[]
): {
    data: Record<string, Binder>;
    isFetching: boolean;
} => {
    const binderIds = useMemo(() => {
        return (actions ?? []).map(action => action.binderId)
    }, [actions]);

    const {
        data: items,
        isFetching
    } = useItems(binderIds, {
        cdnnify: false,
        ancestorThumbnailsOptions: {
            inheritAncestorThumbnails: false,
        },
        skipPopulateVisuals: true,
        skipInstanceDetermination: true,
        resolvePublishedBy: false,
        includeTotalPublicDocumentsCount: false,
        isReadOnlyMode: true,
        includeVisualsStatus: false,
    });

    const bindersMap = useMemo(() => {
        if (items == null) return {};
        const map = {};
        items.forEach(item => map[item.id] = item);
        return map;
    }, [items]);

    return {
        data: bindersMap,
        isFetching
    }
}

/**
 * (An action = checking or unchecking a checkbox once in the reader)
 * 
 * Returns a function that, when given an action, returns the completion percentage 
 * of the binder after that action.
 * 
 * The progress is precalculated using the given actions & checklists
 * and the returned function is O(1)
 * 
 * It works by looking for resets in the action history.
 * We then group all actions between resets (and by binderId).
 * We then loop through these actions in chronological order to calculate their progress percentage.
 * The progress percentage is the binder's percentage of completion after the action is performed.
 */
export const useGetProgress = (
    actions: IChecklistAction[] | null,
    checklistConfigs: IChecklistConfig[] | null
): ((action: IChecklistAction) => string) => {
    // Actions have no unique id so we need to create one, this one has very little possible overlap
    const getKey = (action: IChecklistAction) => action.checklistId + "." + action.performedDate;

    const isLoading = useMemo(
        () => actions == null || checklistConfigs == null,
        [actions, checklistConfigs]
    );

    // When a binder is not fully completed, we need to know how many active checklists there are
    const checklistCountMap = useMemo(() => {
        if (isLoading) return {};
        const countMap: { [binderId: string]: number } = {};
        for (const config of checklistConfigs) {
            if (!config.isActive) continue;
            if (countMap[config.binderId] == null) {
                countMap[config.binderId] = 1;
            } else {
                countMap[config.binderId]++;
            }
        }
        return countMap;
    }, [checklistConfigs, isLoading]);

    // Group actions by binder, because the completion percentage is per binder
    const actionsByBinder = useMemo(() => {
        if (isLoading) return {};
        const actionsByBinder: Record<string, IChecklistAction[]> = {};
        for (const action of actions) {
            if (actionsByBinder[action.binderId] == null) {
                actionsByBinder[action.binderId] = [];
            }
            actionsByBinder[action.binderId].push(action);
        }
        return actionsByBinder;
    }, [actions, isLoading]);

    const progressMap = useMemo(() => {
        if (isLoading) return {};

        // The result, key = getKey(action), value = the completion percentage
        const progressMap: Record<string, string> = {};

        for (const actionsInBinder of Object.values(actionsByBinder)) {
            const sortedGroup = [...actionsInBinder].sort(
                (a, b) => compareAsc(new Date(a.performedDate), new Date(b.performedDate))
            );

            const actionGroups: IChecklistAction[][] = [];
            let actionGroupIndex = 0;
            let lastActionGroupIsComplete = false;

            // Split actions based on resets
            // Turns [checklist1Action, checklist2Action, RESET, RESET, checklist1Action, checklist2Action]
            // Into [[checklist1Action, checklist2Action], [checklist1Action, checklist2Action]]
            for (const action of sortedGroup) {
                if (action.performedByUserId == null) {
                    progressMap[getKey(action)] = "0%";
                    if (actionGroups[actionGroupIndex]?.length) {
                        actionGroupIndex++;
                    }
                    lastActionGroupIsComplete = true;
                    continue;
                }
                lastActionGroupIsComplete = false;
                if (actionGroups[actionGroupIndex] == null) {
                    actionGroups[actionGroupIndex] = [];
                }
                actionGroups[actionGroupIndex].push(action);
            }

            for (let actionGroupIndex = 0; actionGroupIndex < actionGroups.length; actionGroupIndex++) {
                const actionGroup = actionGroups[actionGroupIndex];
                let lastCompletionRate = 0;

                let totalChunksInSequence: number;
                if (
                    actionGroupIndex === actionGroups.length - 1 &&
                    !lastActionGroupIsComplete &&
                    actionGroup.length > 0
                ) {
                    // If the last group is not complete (the binder currently has some checklists checked)
                    // then we have to use checklistCountMap to get the total amount of checklists
                    totalChunksInSequence = checklistCountMap[actionGroup[0].binderId];
                } else {
                    // Count how many checklists there were at the time of completion
                    const totalChunksInSequenceSet = new Set<string>();
                    for (const action of actionGroup) {
                        totalChunksInSequenceSet.add(action.chunkId);
                    }
                    totalChunksInSequence = totalChunksInSequenceSet.size;
                }

                // If we open the same document on multiple tabs/devices, then steps can be performed in an odd manner
                const chunkStates: Record<string, boolean> = {};
                // It's possible to check and uncheck a binder, so we have to loop through them
                // to know the completion percentage at every step
                for (let actionIndex = 0; actionIndex < actionGroup.length; actionIndex++) {
                    const action = actionGroup[actionIndex];
                    if (action.performed && !chunkStates[action.chunkId]) {
                        lastCompletionRate++;
                        chunkStates[action.chunkId] = true;
                    } else if (!action.performed && chunkStates[action.chunkId]) {
                        lastCompletionRate--;
                        chunkStates[action.chunkId] = false;
                    }
                    progressMap[getKey(action)] = Math.round((lastCompletionRate / totalChunksInSequence) * 100) + "%";
                }
            }
        }

        return progressMap;
    }, [checklistCountMap, actionsByBinder, isLoading]);

    return useCallback((action: IChecklistAction) => {
        return progressMap[getKey(action)] ?? "?";
    }, [progressMap])
}
