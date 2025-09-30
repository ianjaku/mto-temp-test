import { useCallback, useEffect, useMemo, useState } from "react";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { UserInputType } from "../user-input/UserInputTypeSwitcher";
import { UserLinkerProps } from "./userLinkerContext";
import { isUsergroupId } from "@binders/client/lib/clients/userservice/v1/helpers";
import { partition } from "ramda";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";

export function useUserLinker({
    allowUserCreation,
    initialUserInputType,
    onCreateUsers,
    onLinkUsers,
    onLinkUsergroupIntersection,
}: Pick<
    UserLinkerProps,
    | "allowUserCreation"
    | "onCreateUsers"
    | "onLinkUsergroupIntersection"
    | "onLinkUsers"
> & { initialUserInputType: UserInputType }) {
    const [selectedUserInputType, setSelectedUserInputType] = useState(initialUserInputType);
    const [selectedUsers, setSelectedUsers] = useState<IAutocompleteItem[]>([]);
    const [usergroupIntersection, setUsergroupIntersection] = useState<IAutocompleteItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const setSelectedItems = useCallback<typeof setSelectedUsers>(
        items =>
            selectedUserInputType === UserInputType.GroupIntersection ?
                setUsergroupIntersection(items) :
                setSelectedUsers(items),
        [selectedUserInputType],
    );

    const selectedItems = useMemo(
        () => selectedUserInputType === UserInputType.GroupIntersection ?
            usergroupIntersection :
            selectedUsers,
        [selectedUserInputType, selectedUsers, usergroupIntersection]
    );

    const previousUserInputType = usePrevious(selectedUserInputType);

    useEffect(() => {
        if (previousUserInputType !== selectedUserInputType && selectedUserInputType === UserInputType.GroupIntersection) {
            setSelectedItems([]);
        }
    }, [previousUserInputType, selectedUserInputType, setSelectedItems]);

    const saveAction = useCallback(async () => {
        const [newUserItems, existingItems] = partition(item => !isUsergroupId(item.id) && item.isNew, selectedUsers);
        const allIds = existingItems.map(item => item.id);
        setIsLoading(true);
        try {
            if (newUserItems.length && allowUserCreation && onCreateUsers) {
                const newUsers = await onCreateUsers(newUserItems.map(newItem => newItem.value));
                allIds.push(...newUsers.map(user => user.id));
            }
            if (allIds.length) {
                await onLinkUsers(allIds);
                setSelectedUsers([]);
            }
            if (usergroupIntersection.length) {
                await onLinkUsergroupIntersection(usergroupIntersection.map(i => i.id));
                setUsergroupIntersection([]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [allowUserCreation, onCreateUsers, onLinkUsergroupIntersection, onLinkUsers, selectedUsers, usergroupIntersection]);

    return {
        selectedUserInputType,
        selectedItems,
        setSelectedUserInputType,
        setSelectedItems,
        saveAction,
        isLoading,
    }
}
