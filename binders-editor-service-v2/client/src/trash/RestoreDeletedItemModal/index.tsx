import * as React from "react";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    PermissionMap,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { PostRestoreAction, restoreItem } from "../actions";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { APILoadItems } from "../../documents/api";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../logging/FlashMessages";
import { IParentItemsMap } from "../store";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import WiredTreeNavigator from "../../browsing/WiredTreeNavigator";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { permissionsFoundInPath } from "../../authorization/helper";

interface IRestoreDeletedItemModalProps {
    onCancel: () => void;
    t: TFunction;
    itemFacingRestore: DocumentCollection | Binder;
    activeAccountId: string,
    parentItemsMap: IParentItemsMap;
    permissions: PermissionMap[];
    postRestoreAction?: PostRestoreAction;
}

interface IRestoreDeletedItemModalState {
    selectedRestoreTargetCollectionId: string,
    selectedRestoreTargetCollectionObject: DocumentCollection,
    restoreInProgress: boolean,
    showRestoreConfirmation: boolean;
}


class RestoreDeletedItemModal extends React.Component<IRestoreDeletedItemModalProps, IRestoreDeletedItemModalState> {

    directParent = null;
    parentItemsPreparedForTreeNavigator: Array<{ name: string, id: string }> = [];
    constructor(props: IRestoreDeletedItemModalProps) {
        super(props)

        const { parentItemsMap, itemFacingRestore: item } = props;

        const itemId = item.id;
        const parentItemsPreparedForTreeNavigator = parentItemsMap[itemId] ?
            (
                parentItemsMap[itemId].ancestorsIds.reduce((prev, ancestorId) => {
                    const ancestorObject = parentItemsMap[itemId].ancestorsObjects.find(
                        (obj) => (obj.id === ancestorId) && (obj.deletionTime == null)
                    );
                    if (ancestorObject && !ancestorObject["doNotPassToTreeNavigator"]) {
                        return [{ id: ancestorId, name: extractTitle(ancestorObject) }, ...prev];
                    }
                    return prev;
                }, [])
            ) :
            [];

        const parentCollectionId = parentItemsMap[itemId]?.ancestorsIds[0];
        const parentCollectionObject = parentItemsMap[itemId].ancestorsObjects.find(
            (obj) => (obj.id === parentCollectionId) && (obj.deletionTime == null)
        );

        this.directParent = parentCollectionObject;
        this.parentItemsPreparedForTreeNavigator = this.directParent ? parentItemsPreparedForTreeNavigator : [];

        this.state = {
            selectedRestoreTargetCollectionId: this.directParent ? parentCollectionId : undefined,
            selectedRestoreTargetCollectionObject: undefined,
            restoreInProgress: false,
            showRestoreConfirmation: false,
        }
    }

    goToRestoreTreeNavigator() {
        this.setState({
            showRestoreConfirmation: false,
        })
    }

    async onRestoreItem() {
        const { itemFacingRestore, activeAccountId, postRestoreAction } = this.props;
        const { selectedRestoreTargetCollectionId } = this.state;
        this.setState({
            restoreInProgress: true,
        })
        await restoreItem(itemFacingRestore.id, activeAccountId, selectedRestoreTargetCollectionId, postRestoreAction);
        this.onFinishRestore();
    }

    onSelectRestoreTarget(collectionId: string) {
        this.setState({
            selectedRestoreTargetCollectionId: collectionId,
        })
    }


    onFinishRestore() {
        this.setState({
            selectedRestoreTargetCollectionId: undefined,
            selectedRestoreTargetCollectionObject: undefined,
            restoreInProgress: false,
        });
        this.parentItemsPreparedForTreeNavigator = undefined;
        this.directParent = null;
        this.props.onCancel();
    }


    async gotToRestoreConfirmation() {
        const { activeAccountId } = this.props;
        const { selectedRestoreTargetCollectionId } = this.state;
        const { t } = this.props;
        try {
            const [collectionObject] = await APILoadItems([selectedRestoreTargetCollectionId], activeAccountId, {});
            this.setState({
                showRestoreConfirmation: true,
                selectedRestoreTargetCollectionObject: collectionObject as DocumentCollection,
            });
        } catch (ex) {
            this.setState({
                showRestoreConfirmation: false,
            })
            FlashMessages.error(t(TK.Trash_ProblemRestoring));
        }
    }


    disableItemCheck(item, parentIdsPath: string[]): boolean {
        const { permissions } = this.props;
        if (item.kind !== "collection") {
            return true;
        }
        const collection = item;
        const editPermissions = permissions.filter(p => p.permission === PermissionName.EDIT);
        const ids = [collection.id, ...parentIdsPath];
        const editPermissionOnItem = permissionsFoundInPath(ids, editPermissions);
        return !editPermissionOnItem;
    }

    render() {
        const {
            showRestoreConfirmation,
            selectedRestoreTargetCollectionId,
            restoreInProgress,
            selectedRestoreTargetCollectionObject
        } = this.state;
        const { t, itemFacingRestore, activeAccountId } = this.props;

        const buttons = [
            <Button
                key="no"
                text={showRestoreConfirmation ? t(TK.General_Back) : t(TK.General_Cancel)}
                onClick={showRestoreConfirmation ? this.goToRestoreTreeNavigator.bind(this) : this.onFinishRestore.bind(this)}
            />,
            <Button
                key="yes"
                isEnabled={!!selectedRestoreTargetCollectionId}
                text={t(TK.General_Proceed)}
                secondary
                onClick={
                    showRestoreConfirmation ?
                        this.onRestoreItem.bind(this) :
                        this.gotToRestoreConfirmation.bind(this)
                }
                inactiveWithLoader={restoreInProgress}
            />,
        ];
        return (
            <Modal
                title={t(TK.Trash_RestoreItemTitle)}
                buttons={buttons}
                onHide={this.onFinishRestore.bind(this)}
                onEscapeKey={this.onFinishRestore.bind(this)}
                classNames="deletedItems-restoreModal"
            >
                {!showRestoreConfirmation && <div>
                    <p className="deletedItems-restoreModal-tip">
                        {t(TK.Trash_RestoreItem)}
                    </p>
                    <WiredTreeNavigator
                        parentItems={this.parentItemsPreparedForTreeNavigator}
                        onSelect={this.onSelectRestoreTarget.bind(this)}
                        allowRootSelection={true}
                        itemFilter={({ isSoftDeleted }) => !isSoftDeleted}
                        disableItemCheck={this.disableItemCheck.bind(this)}
                        targetAccountId={activeAccountId}
                    />
                </div>
                }
                {showRestoreConfirmation && <p>
                    {t(TK.Trash_RestoreConfirmation)}&nbsp;
                    <strong>{extractTitle(itemFacingRestore)}</strong>
                    <span> {t(TK.Trash_ToCollection)}: "{selectedRestoreTargetCollectionObject ? extractTitle(selectedRestoreTargetCollectionObject) : ""}"?</span>
                    <div>{itemFacingRestore.deletedGroupCollectionId && t(TK.Trash_RecursiveRestoreInfo)}</div>
                </p>}
            </Modal>
        )
    }
}

export default withTranslation()(RestoreDeletedItemModal);