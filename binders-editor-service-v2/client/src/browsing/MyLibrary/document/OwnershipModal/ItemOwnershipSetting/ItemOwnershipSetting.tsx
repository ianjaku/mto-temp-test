import * as React from "react";
import {
    DetailedItemOwnership,
    Owner
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { ItemOwnershipSettingRow } from "./ItemOwnershipSettingRow";
import {
    SettingComponentProps
} from "../../../../../shared/InheritedSettingsNavigator/InheritedSettingsNavigator";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UserInput from "../../../../../shared/user-input/UserInput";
import { indexBy } from "ramda";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ItemOwnershipSetting.styl";

const { useEffect, useMemo } = React;

export function ItemOwnershipSetting({
    setDirtySetting,
    setting,
    disabled,
    parentItems,
    configs,
    goToItem,
}: SettingComponentProps<DetailedItemOwnership>): React.ReactElement {
    const { t } = useTranslation();
    const [ owners, setOwners ] = React.useState<Owner[]>([]);
    const [ isDirty, setIsDirty ] = React.useState<boolean>(false);

    useEffect(() => {
        if (setting?.owners) {
            setOwners(setting.owners ?? []);
            setIsDirty(false);
        }
    }, [setting]);

    useEffect(() => {
        if (isDirty) {
            const dirtyOwnership: DetailedItemOwnership = {
                ...setting,
                type: "overridden",
                owners,
            }
            setDirtySetting(dirtyOwnership);
        }
    }, [isDirty, owners, setDirtySetting, setting]);

    const setSelectedUserItems = (newItems: IAutocompleteItem[]) => {
        setOwners(owners => [
            ...(owners ?? []),
            ...newItems.map(item => ({
                id: item.id,
                name: item.label,
            })),
        ]);
        setIsDirty(true);
    }

    const onDeleteOwner = (ownerId: string) => {
        setOwners(owners => owners.filter(o => o.id !== ownerId));
        setIsDirty(true);
    };

    const ownerIdsToItemIds = useMemo(() =>
        Object.values(configs)
            .flatMap(ownership => ownership.owners.map(owner => [ owner.id, ownership.itemId ] as const))
            .reduce((ownerIdsToItemIds, [ ownerId, itemId ]) => {
                const currentItemIds = ownerIdsToItemIds.get(ownerId) ?? [];
                currentItemIds.push(itemId);
                return ownerIdsToItemIds.set(ownerId, currentItemIds);
            }, new Map<string, string[]>()),
    [configs]);

    const inheritedSettingsItemsById = useMemo(() =>
        indexBy(parent => parent.id, parentItems),
    [parentItems]);

    return (
        <div className="itemOwnershipSetting">
            <div className="itemOwnershipSetting-overview">
                {owners.length > 0 ?
                    owners.map((owner, i) => {
                        const parentsWithOwner = (ownerIdsToItemIds.get(owner.id) ?? [])
                            .map(itemId => inheritedSettingsItemsById[itemId])
                            .filter(item => !!item);
                        return <ItemOwnershipSettingRow
                            owner={ owner }
                            parentsWithOwner={ parentsWithOwner }
                            disabled={ disabled }
                            key={ `own-row${ i }` }
                            onDelete={ onDeleteOwner }
                            goToItem={ goToItem }
                        />;
                    }):
                    <label>{t(TK.DocOwners_NoOwners)}</label>
                }
            </div>
            {!disabled &&
                <div className="itemOwnershipSetting-new">
                    <UserInput
                        selectedItems={[]}
                        setSelectedItems={setSelectedUserItems}
                        userIdsIgnoreList={owners.map(o => o.id)}
                    />
                </div>
            }
        </div>
    )
}
