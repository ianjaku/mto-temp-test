import { useMemo, useState } from "react";
import { APIMultiGetUsersAndGroups } from "../../../../users/api";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { SimpleTarget } from "@binders/client/lib/clients/notificationservice/v1/contract";
import {
    targetACItemFromTargetCombined
} from  "../recipients-settings/recipient-setting/recipientSetting";
import { targetACItemToSimpleTarget } from "../../common/helpers";
import { useActiveAccountId } from "../../../../accounts/hooks";


export const useTargetACItems = (): {
    ACData: {
        selectedItems: IAutocompleteItem[];
        setSelectedItems: (items: IAutocompleteItem[]) => void;
    }
    selectedTargets: SimpleTarget[];
    loadTargets: (targets: SimpleTarget[]) => Promise<void>;
} => {
    const accountId = useActiveAccountId();

    const [selectedItems, setSelectedItems] = useState<IAutocompleteItem[]>([]);

    const selectedTargets = useMemo(() => {
        return selectedItems.map(targetACItemToSimpleTarget);
    }, [selectedItems]);
    
    return {
        ACData: {
            setSelectedItems,
            selectedItems,
        },
        selectedTargets,
        async loadTargets(targets: SimpleTarget[]) {
            const ids = targets.map(t => t.targetId);
            const usersAndGroups = await APIMultiGetUsersAndGroups(accountId, ids);

            setSelectedItems(
                targets.map(target => (
                    targetACItemFromTargetCombined(target, usersAndGroups)
                ))
            );
        }
    }
}
