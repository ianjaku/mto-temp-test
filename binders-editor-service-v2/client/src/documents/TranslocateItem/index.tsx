import * as React from "react";
import {
    DocumentCollection,
    EditorItem
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    PermissionMap,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { duplicateBinder, duplicateCollection } from "../actions/publishing";
import { getItemIdsFromPermissionMap, permissionsFoundInPath } from "../../authorization/helper";
import { loadItemsInCollection, moveItemBetweenCollections } from "../actions";
import AccountStore from "../../accounts/store"
import Button from "@binders/ui-kit/lib/elements/button"
import { FlashMessages } from "../../logging/FlashMessages"
import { History } from "history"
import { ITreeNavigatorItem } from "@binders/ui-kit/lib/elements/treenavigator"
import Modal from "@binders/ui-kit/lib/elements/modal"
import { TFunction } from "@binders/client/lib/i18n"
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations"
import Warning from "@binders/ui-kit/lib/elements/icons/Warning"
import { WebData } from "@binders/client/lib/webdata"
import WiredTreeNavigator from "../../browsing/WiredTreeNavigator"
import colors from "@binders/ui-kit/lib/variables"
import { intersection } from "ramda"
import { isThisItemHidden } from "../../shared/helper"
import { withTranslation } from "@binders/client/lib/react/i18n"
import "./TranslocateItem.styl";

export class TranslocateOperation {
    static MOVE_ITEM = "MOVE_ITEM";
    static DUPLICATE_ITEM = "DUPLICATE_ITEM";
}

export interface IAccountInfo {
    fromAccountId: string;
    toAccountId: string;
}

interface ITreeNavigatorItemWitDomainCollection extends ITreeNavigatorItem { domainCollectionId: string }

interface ITranslocateItemProps {
    accountInfo: IAccountInfo;
    parentItems: ITreeNavigatorItemWitDomainCollection[];
    operation: TranslocateOperation;
    t: TFunction;
    item: EditorItem;
    history: History;
    onHide: () => void;
    livesInLibraryItem?: boolean;
    /** `undefined` when the user does not have access to the parent collection */
    sourceCollection: DocumentCollection | undefined;
    permissionMap: { permissions: PermissionMap[] };
    breadcrumbsData: WebData<EditorItem[]>;
    itemHasPublications?: boolean;
}

interface ITranslocateItemState {
    fromAccountId: string;
    toAccountId: string;
    parentItems: ITreeNavigatorItemWitDomainCollection[];
    destinationCollectionParentPath: string[];
    operation: TranslocateOperation;
    destinationCollectionId?: string;
    destinationDomainCollectionId?: string;
    showLoader?: boolean;
    errorMessage?: string;
}

class TranslocateItem extends React.Component<ITranslocateItemProps, ITranslocateItemState> {

    constructor(props: ITranslocateItemProps) {
        super(props);
        this.state = this.buildStateFromProps(props) as ITranslocateItemState;
        this.getSourceCollection = this.getSourceCollection.bind(this);
        this.getTitle = this.getTitle.bind(this);
        this.onSelect = this.onSelect.bind(this);
        this.onTranslocateItem = this.onTranslocateItem.bind(this);
        this.disableItemCheckForMoveModal = this.disableItemCheckForMoveModal.bind(this);
        this.disableItemCheck = this.disableItemCheck.bind(this);
    }

    componentDidMount() {
        const { fromAccountId, toAccountId } = this.props.accountInfo;
        this.setState({
            fromAccountId,
            toAccountId
        });
    }

    componentDidUpdate(prevProps: ITranslocateItemProps) {
        const { fromAccountId, toAccountId } = this.props.accountInfo;
        const { toAccountId: prevAccountId } = prevProps.accountInfo;
        if (toAccountId !== prevAccountId) {
            this.setState({
                fromAccountId,
                toAccountId,
            });
        }
    }

    buildStateFromProps(props: ITranslocateItemProps): Partial<ITranslocateItemState> {
        const { parentItems, operation } = props;
        const state: Partial<ITranslocateItemState> = {
            destinationCollectionParentPath: [],
            parentItems: parentItems,
            operation: operation || TranslocateOperation.MOVE_ITEM,
        }
        if (props.operation === TranslocateOperation.DUPLICATE_ITEM) {
            state.destinationCollectionId = this.getSourceCollection()?.id;
            state.destinationCollectionParentPath = parentItems.map(({ id }) => id);
            state.destinationDomainCollectionId = parentItems.length && parentItems[0].domainCollectionId;
        }
        return state;
    }

    isMoveOperation() {
        return this.props.operation === TranslocateOperation.MOVE_ITEM;
    }

    getTitle(): string {
        const { t, item: { kind } } = this.props;
        if (this.isMoveOperation()) {
            return kind === "collection" ?
                t(TK.DocManagement_ColMoveTo) :
                t(TK.DocManagement_DocMoveTo);
        } else {
            return kind === "collection" ?
                t(TK.DocManagement_ColDuplicateTo) :
                t(TK.DocManagement_DocDuplicateTo);
        }
    }

    getSourceCollection() {
        const { parentItems } = this.props;
        return parentItems.length && parentItems[parentItems.length - 1];
    }

    async onTranslocateItem() {
        const { accountInfo, history, item, onHide, operation, livesInLibraryItem, sourceCollection, t } = this.props;
        const { fromAccountId, toAccountId } = accountInfo;
        const isCollection = item.kind === "collection";
        const {
            destinationCollectionId,
            destinationDomainCollectionId,
            destinationCollectionParentPath,
        } = this.state;

        const onDuplicate = async () => {
            if (isCollection) {
                return await duplicateCollection(
                    item.id,
                    destinationCollectionId,
                    destinationDomainCollectionId,
                    fromAccountId,
                    toAccountId
                );
            }
            return await duplicateBinder(
                item.id,
                destinationCollectionId,
                accountInfo,
            );
        }
        try {
            this.setState({ showLoader: true });
            let newItem;
            if (operation === TranslocateOperation.DUPLICATE_ITEM) {
                newItem = await onDuplicate();
            } else {
                await moveItemBetweenCollections(
                    item.id,
                    item.kind as ("collection" | "document"),
                    sourceCollection?.id,
                    destinationCollectionId,
                    true,
                    toAccountId,
                );
            }
            onHide();
            const parentPath = [...(new Set([...destinationCollectionParentPath, destinationCollectionId]))].reduce(
                (path, col) => `${path}/${col}`,
                "",
            );
            if (fromAccountId === toAccountId) {
                if (destinationCollectionId === sourceCollection?.id) {
                    loadItemsInCollection(destinationCollectionId);
                    return;
                }
                history.push(`/browse${parentPath}`, { fakeValue: 123 });
                return;
            }
            if (destinationCollectionId === sourceCollection?.id && !!newItem && livesInLibraryItem) {
                window.location.reload();
                return;
            }
            FlashMessages.success(t(TK.DocManagement_DuplicateSuccess));
        } catch (error) {
            if (error.errorDetails && error.errorDetails.name === "CircularPathError") {
                let errorMessage: string;
                if (this.isMoveOperation()) {
                    if (isCollection) {
                        errorMessage = t(TK.DocManagement_ColMoveCircularPathError);
                    } else {
                        errorMessage = t(TK.DocManagement_DocMoveCircularPathError);
                    }
                } else {
                    if (isCollection) {
                        errorMessage = t(TK.DocManagement_ColDuplicateCircularPathError);
                    } else {
                        errorMessage = t(TK.DocManagement_DocDuplicateCircularPathError);
                    }
                }

                this.setState({
                    errorMessage
                });
            } else if (error?.errorDetails?.name === "ItemInstanceAlreadyInCollectionError") {
                this.setState({
                    errorMessage: t(TK.DocManagement_ItemInstanceAlreadyInColError),
                });
            } else {
                // eslint-disable-next-line
                console.error(error);
                FlashMessages.error(this.isMoveOperation() ? t(TK.DocManagement_ItemMoveFail) : t(TK.DocManagement_ItemDuplicateFail));
            }
        } finally {
            this.setState({ showLoader: false });
        }
    }

    onSelect(destinationCollectionId: string, destinationDomainCollectionId: string, destinationCollectionParentPath: string[]) {
        this.setState({
            destinationCollectionId,
            destinationDomainCollectionId,
            destinationCollectionParentPath,
            errorMessage: undefined
        });
    }

    disableItemCheck(item, parentIdsPath: string[]): boolean {
        const { operation, permissionMap: { permissions } } = this.props;
        if (operation === TranslocateOperation.MOVE_ITEM && this.disableItemCheckForMoveModal(item, parentIdsPath)) {
            return true;
        }
        const itemsWithEditAcls = getItemIdsFromPermissionMap(permissions, [PermissionName.ADMIN, PermissionName.EDIT]);
        const itemsWithViewAcls = getItemIdsFromPermissionMap(permissions, [PermissionName.VIEW]);
        const canIEdit = intersection(itemsWithEditAcls, [...(parentIdsPath || []), item.id]).length >= 1;
        const canIView = intersection(itemsWithViewAcls, [...(parentIdsPath || []), item.id]).length >= 1;
        const isReadOnlyMode = isThisItemHidden(
            AccountStore.getAccountFeatures().result,
            AccountStore.getActiveAccount().canIEdit,
            canIEdit,
            canIView
        );
        return isReadOnlyMode;
    }

    disableItemCheckForMoveModal(item, parentIdsPath: string[]): boolean {
        if (item.kind !== "collection" || !this.props.itemHasPublications) {
            return false;
        }
        const collection = item;
        const permissionMap = this.props.permissionMap.permissions;
        const publishPermissions = permissionMap.filter(p => p.permission === PermissionName.PUBLISH);
        const ids = [collection.id, ...parentIdsPath];
        const publishPermissionsOnItem = permissionsFoundInPath(ids, publishPermissions);
        return !publishPermissionsOnItem;
    }

    render() {
        const {
            item,
            onHide,
            operation,
            parentItems,
            sourceCollection,
            t,
        } = this.props;
        const { toAccountId } = this.state;
        const { destinationCollectionId, showLoader, errorMessage } = this.state;
        const canTranslocateToSameCollection = (
            operation === TranslocateOperation.DUPLICATE_ITEM ||
            sourceCollection?.id !== destinationCollectionId
        );
        const canTranslocate = (
            destinationCollectionId !== undefined &&
            canTranslocateToSameCollection &&
            item.id !== destinationCollectionId
        );
        const doneLbl = `${operation === TranslocateOperation.MOVE_ITEM ? t(TK.DocManagement_ItemMoveHere) : t(TK.DocManagement_ItemPlaceHere)}`;
        return (
            <Modal
                title={this.getTitle()}
                onEnterKey={this.onTranslocateItem}
                onEscapeKey={onHide}
                buttons={[
                    <Button
                        key="cancel"
                        text={`${t(TK.General_Cancel)}`}
                        onClick={onHide}
                        secondary
                    />,
                    <Button
                        key="done"
                        text={doneLbl}
                        onClick={this.onTranslocateItem}
                        isEnabled={canTranslocate}
                        inactiveWithLoader={showLoader}
                    />
                ]}
                classNames="move-item-modal"
                onHide={onHide}
            >
                {!!errorMessage && (
                    <div className="move-item-modal-errormessage">
                        {Warning({ fontSize: 12, color: colors.colorError })}
                        <p>
                            {errorMessage}
                        </p>
                    </div>
                )}
                <WiredTreeNavigator
                    parentItems={parentItems}
                    onSelect={this.onSelect}
                    allowRootSelection={true}
                    itemFilter={({ id }) => id !== item.id}
                    disableItemCheck={this.disableItemCheck}
                    targetAccountId={toAccountId}
                    collectionsOnly
                />
            </Modal>
        );
    }
}

export default withTranslation()(TranslocateItem);
