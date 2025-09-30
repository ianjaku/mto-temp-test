import * as React from "react";
import { PermissionMap, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import { FlashMessages } from "../../../logging/FlashMessages";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Warning from "@binders/ui-kit/lib/elements/icons/Warning";
import WiredTreeNavigator from "../..//WiredTreeNavigator";
import colors from "@binders/ui-kit/lib/variables";
import { moveItemBetweenCollections } from "../../../documents/actions";
import { permissionsFoundInPath } from "../../../authorization/helper";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./CreateInstanceModal.styl";

type ClassInstanceModalProps = {
    accountId: string;
    item;
    parentItems;
    onHide: () => void;
    t: (key: string) => string;
    history;
    permissionMap: { permissions: PermissionMap[] };
};

type ClassInstanceModalState = {
    destinationCollectionId: string;
    destinationCollectionParentPath: string[];
    parentItems: Array<{ id: string, name: string }>;
    errorMessage?: string;
}

class CreateInstanceModal extends React.Component<ClassInstanceModalProps, ClassInstanceModalState> {

    constructor(props: ClassInstanceModalProps) {
        super(props);
        this.state = this.buildStateFromProps(props);
        this.onSelect = this.onSelect.bind(this);
        this.onCreateInstance = this.onCreateInstance.bind(this);
    }

    buildStateFromProps(props: ClassInstanceModalProps) {
        return {
            destinationCollectionId: undefined,
            destinationCollectionParentPath: [],
            parentItems: props.parentItems,
        }
    }

    async onCreateInstance() {
        const { history, item, parentItems, onHide, t, accountId } = this.props;
        const sourceCollection = parentItems[parentItems.length - 1];
        const { destinationCollectionId, destinationCollectionParentPath } = this.state;
        try {
            const removeAfterMove = false;
            await moveItemBetweenCollections(
                item.id,
                item.kind,
                sourceCollection.id,
                destinationCollectionId,
                removeAfterMove,
                accountId,
            );
            onHide();
            const parentPath = destinationCollectionParentPath.reduce((path, col) => `${path}/${col}`, "");
            history.push(`/browse${parentPath}/${destinationCollectionId}`);
        } catch (error) {
            if(error.errorDetails && error.errorDetails.name === "CircularPathError") {
                this.setState({
                    errorMessage: t(TK.DocManagement_CircularPathError),
                });
            } else if (error?.errorDetails?.name === "ItemInstanceAlreadyInCollectionError") {
                this.setState({
                    errorMessage: t(TK.DocManagement_ItemInstanceAlreadyInColError),
                });
            } else {
                // eslint-disable-next-line
                console.error(error);
                FlashMessages.error(t(TK.DocManagement_InstanceCreateFail));
            }
        }
    }

    onSelect(destinationCollectionId, _destinationDomainCollectionId, destinationCollectionParentPath) {
        this.setState({
            destinationCollectionId,
            destinationCollectionParentPath,
            errorMessage: undefined
        });
    }

    disableItemCheck(item, parentIdsPath) {
        const collection = item;
        const publishPermissions = this.props.permissionMap.permissions.filter(p => p.permission === PermissionName.PUBLISH);
        const ids = [collection.id, ...parentIdsPath];
        const publishPermissionsOnItem = permissionsFoundInPath(ids, publishPermissions);
        return !publishPermissionsOnItem;
    }

    render() {
        const { item, onHide, parentItems, t } = this.props;
        const { destinationCollectionId, errorMessage } = this.state;
        const sourceCollection = parentItems[parentItems.length - 1];
        const canMove = (
            destinationCollectionId !== undefined &&
            sourceCollection !== undefined &&
            sourceCollection.id !== destinationCollectionId &&
            item.id !== destinationCollectionId
        );
        const modalButtons = [
            <Button key="cancel" text={t(TK.General_Cancel)} secondary onClick={onHide} />,
            <Button key="create" text={t(TK.DocManagement_CreateHere)} onClick={this.onCreateInstance} isEnabled={canMove} />,
        ];
        return (
            <Modal
                title={t(TK.DocManagement_InstanceLoc)}
                buttons={modalButtons}
                classNames="move-item-modal"
                onHide={onHide}
                onEscapeKey = {onHide}
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
                    disableItemCheck={this.disableItemCheck.bind(this)}
                    itemFilter={i => i.id !== item.id}
                />
            </Modal>
        );
    }
}

export default withTranslation()(CreateInstanceModal);