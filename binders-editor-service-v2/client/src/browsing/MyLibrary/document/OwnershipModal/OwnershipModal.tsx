import * as React from "react";
import {
    DetailedItemOwnership,
    EditorItem,
    InheritedOwnershipSettingsItem,
    InheritedSettingsItem
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Modal, { ModalWidth } from "@binders/ui-kit/lib/elements/modal";
import {
    useOwnershipForItem,
    useSetOwnershipForItemMutation
} from "./hooks";
import Button from "@binders/ui-kit/lib/elements/button";
import { ConfirmationDialogModal } from "./ConfirmationDialogModal";
import InheritedSettingsNavigator from "../../../../shared/InheritedSettingsNavigator/InheritedSettingsNavigator";
import { ItemOwnershipSetting } from "./ItemOwnershipSetting";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { inheritedSettingsItemFrom } from "../../../../shared/InheritedSettingsNavigator/helpers";
import { uniqBy } from "ramda";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./OwnershipModal.styl";

const { useCallback, useState, useEffect, useMemo } = React;

const OwnershipModal: React.FC<{
    onHide: () => void;
    item: EditorItem;
}> = ({ item, onHide }) => {
    const { t } = useTranslation();
    const [ currentItem, setCurrentItem ] = useState(inheritedSettingsItemFrom(item));
    const [ shouldConfirmChanges, setShouldConfirmChanges ] = useState(false);
    const [ itemHistory, setItemHistory ] = useState<InheritedSettingsItem[]>([]);
    const [ skipGoToPrevious, setSkipGoToPrevious ] = useState(false);
    const { data: dbItemOwnership, isLoading: itemOwnershipIsLoading } = useOwnershipForItem(currentItem?.id);
    const [ dirtyItemOwnership, setDirtyItemOwnership ] = useState<DetailedItemOwnership | null>(null);
    const itemOwnership = dirtyItemOwnership || dbItemOwnership;
    const aggregatedParentSettings = aggregateAllParentsOwnershipSettings(dbItemOwnership?.ancestorsWithOwnership);
    const { mutate: setOwnership } = useSetOwnershipForItemMutation();

    const hideOrGoToPrevious = useCallback(() => {
        if (itemHistory.length === 0 || skipGoToPrevious) {
            onHide();
        }
        const lastItem = itemHistory.pop();
        setCurrentItem(lastItem);
        setItemHistory([...itemHistory]);
    }, [itemHistory, onHide, skipGoToPrevious]);

    const goToItem = useCallback((item: InheritedSettingsItem) => {
        setCurrentItem(item);
        setItemHistory([...itemHistory, currentItem]);
    }, [currentItem, itemHistory]);

    const buildOnOverride = (isOverridden: boolean) => {
        return () => {
            const newType = isOverridden ? "overridden" : "inherited";
            if (itemOwnership.type === newType) {
                return;
            }
            if (newType === dbItemOwnership?.type) {
                // if the type is set to parent one again, reset the dirty state, discarding any changes
                setDirtyItemOwnership(null);
            } else {
                setDirtyItemOwnership({
                    ...itemOwnership,
                    type: newType,
                    owners: [],
                });
            }
        }
    };
    useEffect(() => setDirtyItemOwnership(undefined), [dbItemOwnership]);

    const configs = useMemo(() => {
        if (itemOwnershipIsLoading) {
            return undefined;
        }
        const parentOwnershipsById: Record<string, DetailedItemOwnership> = {};
        for (const { id, owners } of dbItemOwnership.ancestorsWithOwnership) {
            parentOwnershipsById[id] = { itemId: id, type: "inherited", owners };
        }
        return parentOwnershipsById;
    }, [itemOwnershipIsLoading, dbItemOwnership]);

    const save = useCallback(() => {
        if (dirtyItemOwnership) {
            const { type, owners = [] } = dirtyItemOwnership;
            const ids = owners.map(owner => owner.id);
            setOwnership({
                itemId: currentItem.id,
                ownership: { type, ids },
            });
        }
        hideOrGoToPrevious();
    }, [currentItem, dirtyItemOwnership, hideOrGoToPrevious, setOwnership]);

    const quickHide = useCallback(() => {
        if (dirtyItemOwnership) {
            setShouldConfirmChanges(true);
            setSkipGoToPrevious(true);
        } else {
            onHide();
        }
    }, [dirtyItemOwnership, onHide]);

    return (
        shouldConfirmChanges ?
            <ConfirmationDialogModal
                discardChanges={() => {
                    setShouldConfirmChanges(false);
                    setDirtyItemOwnership(null);
                    hideOrGoToPrevious();
                }}
                keepEditing={() => {
                    setShouldConfirmChanges(false);
                    setSkipGoToPrevious(false);
                }}
            /> :
            <Modal
                title={t(TK.DocOwners_ModalTitle, { item: currentItem.title })}
                buttons={[
                    <Button
                        text={t(itemHistory.length ? TK.General_Back : TK.General_Cancel)}
                        onClick={() => {
                            if (dirtyItemOwnership) {
                                setShouldConfirmChanges(true);
                            } else {
                                hideOrGoToPrevious();
                            }
                        }}
                        secondary
                    />,
                    <Button
                        text={t(TK.General_Save)}
                        onClick={save}
                        isEnabled={!!dirtyItemOwnership}
                    />
                ]}
                onHide={quickHide}
                onEscapeKey={quickHide}
                classNames="ownership-modal"
                withoutPadding={true}
                mobileViewOptions={{
                    stretchX: { doStretch: true },
                    stretchY: { doStretch: true, allowShrink: true, minTopGap: 0, maxTopGap: 150 },
                    flyFromBottom: true,
                }}
                modalWidth={ModalWidth.Wide}
            >
                <div>
                    {itemOwnershipIsLoading ?
                        <div>
                            {circularProgress()}
                        </div> :
                        <InheritedSettingsNavigator<DetailedItemOwnership>
                            computedParentSetting={aggregatedParentSettings}
                            configs={configs}
                            goToItem={goToItem}
                            hasParentWithConfig={!!itemOwnership?.ancestorsWithOwnership?.length}
                            item={currentItem}
                            itemSetting={itemOwnership}
                            parentItems={itemOwnership?.ancestorsWithOwnership}
                            setDirtySetting={setDirtyItemOwnership}
                            setOverrideParentSettings={buildOnOverride(true)}
                            setUseParentSettings={buildOnOverride(false)}
                            settingComponent={ItemOwnershipSetting}
                            shouldOverrideParent={itemOwnership?.type === "overridden"}
                            inheritSettingsMessage={t(TK.DocManagement_OwnershipSettings_Inherit)}
                            overrideSettingsMessage={t(TK.DocManagement_OwnershipSettings_Override)}
                        />
                    }
                </div>
            </Modal>
    );
}

const aggregateAllParentsOwnershipSettings = (parentSettings: InheritedOwnershipSettingsItem[] | undefined): DetailedItemOwnership | undefined => {
    if (!parentSettings?.length) {
        return undefined;
    } else {
        return {
            itemId: null,
            type: "inherited",
            owners: uniqBy(owner => owner.id, parentSettings.flatMap(p => p.owners)),
        }
    }
}

export default OwnershipModal;
