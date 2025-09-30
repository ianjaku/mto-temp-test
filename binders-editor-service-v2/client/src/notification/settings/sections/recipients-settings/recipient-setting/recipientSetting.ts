import { APIAddNotificationTarget, APIDeleteNotificationTarget } from "../../../../api";
import {
    NotificationKind,
    NotificationTarget,
    NotifierKind,
    SimpleTarget
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    User,
    Usergroup,
    UsergroupDetails
} from  "@binders/client/lib/clients/userservice/v1/contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { RecipientSettingProps } from "./RecipientSetting";
import { isUsergroup } from "@binders/client/lib/clients/userservice/v1/helpers";
import { useHistory } from "react-router";
import { useModalState } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";

export interface RecipientSettingState {
    eventKind: NotificationKind;
    setEventKind: (eventKind: NotificationKind) => void;
    selectedTargetACItems: IAutocompleteItem[];
    setSelectedTargetACItems: (selectedTargetACItems: IAutocompleteItem[]) => void;
    loading: boolean;
    setLoading: (loading: boolean) => void;
}

export const useRecipientSettingState = (
    props: RecipientSettingProps
): RecipientSettingState => {
    const [eventKind, setEventKind] = useState<NotificationKind>(props.target?.notificationKind);
    const [selectedTargetACItems, setSelectedTargetACItems] = useState<IAutocompleteItem[]>([]);
    const [loading, setLoading] = useState(false);

    return {
        eventKind,
        setEventKind,
        selectedTargetACItems,
        setSelectedTargetACItems,
        loading,
        setLoading
    }
}

export const useIsDuplicate = (
    state: RecipientSettingState,
    props: RecipientSettingProps
): boolean => {
    return useMemo(() => {
        if (state.selectedTargetACItems.length === 0) return false;
        if (
            props.target != null &&
            props.target.notificationKind === state.eventKind &&
            props.target.targetId === state.selectedTargetACItems[0].id
        ) return false;
        return props.otherTargets.find(otherTarget => {
            return otherTarget.targetId === state.selectedTargetACItems[0].id &&
                        otherTarget.notificationKind === state.eventKind &&
                        otherTarget.itemId === props.targetItemId;
        }) != null;
    }, [
        state.eventKind, state.selectedTargetACItems, props.target,
        props.otherTargets, props.targetItemId
    ]);
}

export const useSelectedItemDefault = (
    { setSelectedTargetACItems }: RecipientSettingState,
    { target, users, groups }: RecipientSettingProps
): void => {
    useEffect(() => {
        if (target == null || users == null || groups == null) return;
        const targetACItem = targetACItemFromTarget(
            target,
            users,
            groups
        );
        if (targetACItem != null) {
            setSelectedTargetACItems([targetACItem]);
        }
    }, [target, users, groups, setSelectedTargetACItems]);
}

export const useCreateTargetWithCurrentSettings = (
    { selectedTargetACItems, eventKind }: RecipientSettingState,
    { accountId, targetItemId }: RecipientSettingProps,
    isDuplicate: boolean
): () => Promise<void> => {
    return useCallback(async () => {
        if (isDuplicate) return;
        const selectedTarget = selectedTargetACItems[0];
        const notifierKind = selectedTarget.id.startsWith("uid-") ?
            NotifierKind.USER_EMAIL :
            NotifierKind.GROUP_EMAIL;

        await APIAddNotificationTarget({
            accountId: accountId,
            notifierKind,
            notificationKind: eventKind,
            itemId: targetItemId,
            targetId: selectedTarget.id,
        });
    }, [isDuplicate, selectedTargetACItems, eventKind, accountId, targetItemId]);
};

export const useUpdateOnChange = (
    { selectedTargetACItems, eventKind, setLoading }: RecipientSettingState,
    { target, refetchTargets }: RecipientSettingProps,
    createTargetWithCurrentSettings: () => Promise<void>
): void => {
    useEffect(() => {
        if (target == null) return;
        if (selectedTargetACItems.length === 0) return;
        if (eventKind === target.notificationKind &&
                selectedTargetACItems[0].id === target.targetId
        ) return;

        const updateNotificationTarget = async () => {
            setLoading(true);
            await createTargetWithCurrentSettings();
            await APIDeleteNotificationTarget(target);
            refetchTargets();
            setLoading(false);
        }
        updateNotificationTarget();
                
    }, [
        target, selectedTargetACItems, eventKind, setLoading,
        createTargetWithCurrentSettings, refetchTargets
    ]);
}

export const useCreateOnComplete = (
    {
        eventKind,
        selectedTargetACItems,
        setLoading,
        setEventKind,
        setSelectedTargetACItems
    }: RecipientSettingState,
    { target, refetchTargets }: RecipientSettingProps,
    isDuplicate: boolean,
    createTargetWithCurrentSettings: () => Promise<void>
): void => {
    useEffect(() => {
        if (isDuplicate) return;
        if (target == null && eventKind != null && selectedTargetACItems.length > 0) {
            const createNotificationTarget = async () => {
                setLoading(true);
                await createTargetWithCurrentSettings();
                refetchTargets();
                setLoading(false);
                setEventKind(undefined);
                setSelectedTargetACItems([]);
            }
            createNotificationTarget();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, eventKind, selectedTargetACItems, isDuplicate]);
}

export const useGoToParent = (
    { fromParent, target, ancestors }: RecipientSettingProps
): () => void => {
    const currentModal = useModalState();
    const history = useHistory();

    const linkToParent = useMemo(() => {
        if (!fromParent) return "";

        const targetAncestors = [target.itemId];
        let currentItemId = target.itemId;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const parents = ancestors[currentItemId];
            if (parents == null || parents.length === 0) break;
            targetAncestors.push(parents[0]);
            currentItemId = parents[0];
        }
        return `/browse/${targetAncestors.reverse().join("/")}?show=notification-settings`;
    }, [fromParent, target, ancestors]);

    return async () => {
        currentModal.hideModal(currentModal.activeModalId);
        history.push(linkToParent)
    }
}

export const useDeleteTarget = (
    { setSelectedTargetACItems, setLoading }: RecipientSettingState,
    { refetchTargets, target }: RecipientSettingProps,
    isDuplicate: boolean
) => {
    return async (): Promise<void> => {
        if (isDuplicate) {
            setSelectedTargetACItems([]);
            return;
        }
        
        setLoading(true);
        await APIDeleteNotificationTarget(target);
        refetchTargets();
    }
}

export const useWrapperClasses = (
    { eventKind, selectedTargetACItems }: RecipientSettingState,
    { target, fromParent }: RecipientSettingProps,
    isDuplicate: boolean
): string => {
    return useMemo(() => {
        const classes = ["recipient-setting-wrapper"];
        if (fromParent) classes.push("recipient-setting-wrapper--disabled")
        if (
            target == null &&
            eventKind == null &&
            selectedTargetACItems.length === 0
        ) classes.push("recipient-setting-wrapper--empty")
        if (isDuplicate) classes.push("recipient-setting-wrapper--duplicate")
        return classes.join(" ");
    }, [fromParent, target, eventKind, selectedTargetACItems, isDuplicate]);
}

export function targetACItemFromTargetCombined(
    target: NotificationTarget | SimpleTarget,
    usersAndGroups: (User | Usergroup)[]
): IAutocompleteItem {
    const match = usersAndGroups.find(u => u.id === target.targetId);
    if (match == null) return null;
    if (isUsergroup(match)) {
        return {
            id: match.id,
            rawLabel: match.name,
            value: match.name,
            label: match.name,
        }
    }
    return {
        id: match.id,
        rawLabel: match.displayName,
        value: match.login,
        label: match.displayName,
    }
}

export function targetACItemFromTarget(
    target: NotificationTarget | SimpleTarget,
    users: User[],
    groups: UsergroupDetails[],
): IAutocompleteItem {
    let item: IAutocompleteItem;
    if (target.notifierKind === NotifierKind.USER_EMAIL) {
        const user = users.find(u => u.id === target.targetId);
        item = user && {
            label: user.displayName,
            rawLabel: user.displayName,
            value: user.login,
            id: user.id,
        };
    } else if (target.notifierKind === NotifierKind.GROUP_EMAIL) {
        const group = groups.find(g => g.group.id === target.targetId);
        item = group && {
            label: group.group.name,
            rawLabel: group.group.name,
            value: group.group.name,
            id: group.group.id,
        };
    }
    return item || undefined;
}
