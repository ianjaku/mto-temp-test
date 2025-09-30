import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";
import type { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import type { UseUserInputAutocompleteResult } from "./useUserInputAutocomplete";
import { UserInputType } from "./UserInputTypeSwitcher";
import { labelValueNotEqual } from "./helpers";

type UseUserInputProps = {
    autocomplete: UseUserInputAutocompleteResult;
    selectedItems: IAutocompleteItem[];
    setSelectedItems: (items: IAutocompleteItem[]) => void;
}

type UseUserInputOptions = {
    selectedUserInputType?: UserInputType;
    setSelectedUserInputType?: Dispatch<SetStateAction<UserInputType>>;
}

export type UseUserInputResult = {
    onAddNewChip: (item: IAutocompleteItem) => void;
    onDeleteChip: (item: IAutocompleteItem) => void;
    selectedUserInputType: UserInputType;
    setSelectedUserInputType: Dispatch<SetStateAction<UserInputType>>;
}

export function useUserInputIdFilter({ userIdsIgnoreList, userInputType }: {
    userIdsIgnoreList: string[];
    userInputType: UserInputType;
}): (itemId: string) => boolean {
    const userIdsIgnoreSet = useMemo(() => new Set(userIdsIgnoreList), [userIdsIgnoreList]);
    return useCallback(
        itemId => {
            switch (userInputType) {
                case UserInputType.User:
                case UserInputType.Group:
                    return !userIdsIgnoreSet.has(itemId);
                case UserInputType.GroupIntersection:
                    return true;
            }
        },
        [userInputType, userIdsIgnoreSet],
    );
}

export function useUserInput(
    { autocomplete, selectedItems, setSelectedItems }: UseUserInputProps,
    { selectedUserInputType, setSelectedUserInputType }: UseUserInputOptions,
): UseUserInputResult {
    const [managedSelectedInputType, setManagedSelectedInputType] = useState<UserInputType>(selectedUserInputType ?? UserInputType.User);

    const onAddNewChip = useCallback((item) => {
        autocomplete.setAutocompleteData(autocomplete.autocompleteData.filter(labelValueNotEqual(item)));
        setSelectedItems([...selectedItems, item]);
    }, [autocomplete, selectedItems, setSelectedItems]);

    const onDeleteChip = useCallback(({ rawLabel, id, value, label, isNew = false }: IAutocompleteItem) => {
        if (!isNew) {
            autocomplete.setAutocompleteData([...autocomplete.autocompleteData, { rawLabel, id, value, label }]);
        }
        setSelectedItems(selectedItems.filter(labelValueNotEqual({ rawLabel, id, value, label, isNew })));
    }, [autocomplete, selectedItems, setSelectedItems]);

    return {
        onAddNewChip,
        onDeleteChip,
        selectedUserInputType: selectedUserInputType ?? managedSelectedInputType,
        setSelectedUserInputType: setSelectedUserInputType ?? setManagedSelectedInputType,
    }
}

