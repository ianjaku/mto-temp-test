import * as React from "react";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    CollectionElement,
    Item
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    IPermissionFlag,
    PermissionMap,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import { FlashMessages } from "../../logging/FlashMessages";
import { History } from "history";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import { calculatePermissionFlags } from "../../authorization/tsHelpers";
import { createPortal } from "react-dom";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { getItemLink } from "../../browsing/tsHelpers";
import { hardDeleteBinder } from "../actions";
import { withTranslation } from "@binders/client/lib/react/i18n";

interface IContextMenuProps {
    t?: (key: string, options?: unknown) => string;
    item: DocumentCollection | Binder;
    modalPlaceholder: Element;
    ancestors: { ancestorsIds: Array<string>, ancestorsObjects: Array<Item> }
    permissions: PermissionMap[],
    onRestoreItem: () => void;
    accountId: string;
    isCollection?: boolean;
    history: History;
}

interface IContextMenuState {
    isFacingRemoval: boolean,
    removalInProgress: boolean,
    permissionFlags: IPermissionFlag[],
}

export class ItemContextMenu extends React.Component<IContextMenuProps, IContextMenuState> {

    getParentItemsPromise = null;

    constructor(props: IContextMenuProps) {
        super(props);
        autobind(this);
        this.state = {
            isFacingRemoval: false,
            removalInProgress: false,
            permissionFlags: [],
        }
    }


    onClickDelete(): void {
        this.setState({
            isFacingRemoval: true
        });
    }

    onClickView(): void {
        const { ancestors, item } = this.props;
        const itemLink = getItemLink([...ancestors.ancestorsObjects].reverse(), item);
        const win = window.open(itemLink, "_blank");
        win.focus();
    }

    renderHardDeleteConfirmationModal(): React.ReactElement {
        const { isFacingRemoval, removalInProgress } = this.state;
        const { item, t } = this.props;
        const onDelete = this.onDeleteItem.bind(this);
        const cancelDelete = this.cancelDelete.bind(this);
        const buttons = [
            <Button key="yes" text={t(TK.General_Yes)} secondary onClick={onDelete} inactiveWithLoader={removalInProgress} />,
            <Button key="no" text={t(TK.General_No)} onClick={cancelDelete} />,
        ];
        return (isFacingRemoval) ?
            <Modal
                title={t(TK.General_Confirmation)}
                buttons={buttons}
                onHide={cancelDelete}
                onEnterKey={onDelete}
                onEscapeKey={cancelDelete}
            >
                <div>
                    {t(TK.Trash_HardDeleteConfirmation)}&nbsp;
                    <strong>{extractTitle(item)}? &nbsp;</strong>
                    {t(TK.Trash_NoPossibilityToRestore)}
                </div>
            </Modal> :
            null;
    }


    async onDeleteItem(): Promise<void> {
        const { item, t, accountId } = this.props;

        this.setState({
            removalInProgress: true,
        });
        try {
            await hardDeleteBinder(item.id, accountId);

            this.setState({
                isFacingRemoval: false,
                removalInProgress: false,
            });

            FlashMessages.success(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                t(TK.DocManagement_ItemDeleteSuccess, { itemKind: this.getItemTypeName(item as any) })
            );
        } catch (e) {
            // eslint-disable-next-line
            console.error(e);
            this.setState({
                isFacingRemoval: false,
                removalInProgress: false,
            });
            FlashMessages.error(t(TK.DocManagement_ItemDeleteFail));
        }
    }

    getItemTypeName(item: CollectionElement): string {
        const { t } = this.props;
        if (item.isInstance) {
            return t(TK.DocManagement_Instance);
        }
        return item.kind === "collection" ? t(TK.DocManagement_Collection) : t(TK.DocManagement_Document);
    }

    cancelDelete(): void {
        this.setState({
            isFacingRemoval: false,
        });
    }


    async onChangeOpened(open: boolean): Promise<void> {
        if (open && this.state.permissionFlags.length === 0) {
            const adhocPermissionFlags =
                await calculatePermissionFlags([this.props.ancestors.ancestorsObjects], this.props.permissions, [this.props.item.id])
            this.setState({
                permissionFlags: adhocPermissionFlags,
            });
        }
    }


    /*
        allowLanguageRestriction: allow the presence of a language restriction
        eg. to check if someone is an editor and not a translator (ie editor for language X), this must be false (= stricter check)
    */
    hasFlag(permissionName: PermissionName, allowLanguageRestriction = true): boolean {
        const { permissionFlags = [] } = this.state;
        const flag = permissionFlags.find(pf => pf.permissionName === permissionName);
        if (!flag) {
            return false;
        }
        if (allowLanguageRestriction) {
            return true;
        }
        return !(flag.languageCodes);
    }

    renderPending(): React.ReactElement {
        return <label />;
    }

    renderSuccess(): Array<React.ReactElement> {
        const { modalPlaceholder } = this.props;
        const contextMenu = this.renderContextMenu();
        const modals = (
            <div>
                {this.renderHardDeleteConfirmationModal()}
                {/* {this.renderRestoreConfirmationModal()} */}
            </div>
        );
        return [
            contextMenu,
            createPortal(modals, modalPlaceholder, "modals"),
        ];
    }

    renderContextMenu(): React.ReactElement {
        const {
            item,
            modalPlaceholder,
            t, 
            ancestors,
            onRestoreItem,
            isCollection
        } = this.props;
        let canAdmin;
        let canEdit;
        if (ancestors) {
            canAdmin = this.hasFlag(PermissionName.ADMIN);
            canEdit = this.hasFlag(PermissionName.EDIT, false);
        }
        const { isInstance, id, deletedGroupCollectionId } = item;
        const amIAdmin = canAdmin;
        const canIRestore = canEdit;
        return (
            <ContextMenu
                container={modalPlaceholder}
                key={`${id}-menu`}
                menuIconName={"more_vert"}
                menuIconStyle={{ fontSize: 18 }}
                doNotShowUntilResolved={Promise.resolve()}
                onChangeOpened={this.onChangeOpened.bind(this)}
            >
                {!isCollection && <MenuItem
                    iconName="visibility"
                    onClick={this.onClickView.bind(this)}
                    title={t(TK.Edit_View)}
                />}
                {amIAdmin && <MenuItem
                    iconName="delete_forever"
                    onClick={this.onClickDelete.bind(this)}
                    title={isInstance ? t(TK.DocManagement_InstanceDelete) : t(TK.General_Delete)}
                    disabled={isCollection === true}
                    tooltip={isCollection ? t(TK.Trash_HardDeleteCollection) : t(TK.Trash_NoPossibilityToRestore)}
                />}
                <MenuItem
                    iconName="restore"
                    onClick={onRestoreItem}
                    title={deletedGroupCollectionId ? t(TK.Trash_RestoreAll) : t(TK.Trash_RestoreTooltip)}
                    disabled={!canIRestore}
                    tooltip={t(TK.Trash_RestoreTooltip)}
                />
            </ContextMenu>
        );
    }

    render(): React.ReactElement[] {
        const { modalPlaceholder } = this.props;
        return modalPlaceholder ? this.renderSuccess() : null;
    }
}

export default withTranslation()(ItemContextMenu);
