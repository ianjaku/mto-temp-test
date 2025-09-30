import * as React from "react";
import { AddNewCollectionModal, AddNewDocumentModal } from "./MyLibrary";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import { useActiveBrowsePathOrDefault, useActiveCollection } from "../hooks";
import { useHasFullPermissionAnywhere, useMyPermissionMap } from "../../authorization/hooks";
import { useMemo, useState } from "react";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import CreateCollectionIcon from "@binders/ui-kit/lib/elements/icons/CreateCollection";
import CreateDocumentIcon from "@binders/ui-kit/lib/elements/icons/CreateDocument";
import DocumentStore from "../../documents/store";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import { MANUAL_FROM_VIDEO_ROUTE } from "../../manualfromvideo/routes";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import { MyLibraryItemType } from "./MyLibraryItem";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UploadFileIcon from "@binders/ui-kit/lib/elements/icons/UploadFile";
import { checkHasFullPermissionInCurrentCollection } from "../../authorization/tsHelpers";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useHistory } from "react-router";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

const NewItemContextMenu: React.FC<{
    anchorRef: HTMLElement;
    fromPortal?: boolean;
    onShowAddNewDocumentModal: () => void;
    onAddNewCollection: () => void;
    onClose: () => void;
}> = props => {
    const { t } = useTranslation();
    const {
        anchorRef,
        fromPortal,
        onAddNewCollection,
        onClose,
        onShowAddNewDocumentModal,
    } = props;

    const history = useHistory();
    const featuresManualFromVideo = useLaunchDarklyFlagValue(LDFlags.MANUAL_FROM_VIDEO);
    const browsePath = useActiveBrowsePathOrDefault();

    return (
        <div className="myLibrary-addNew-contextMenu">
            <ContextMenu
                anchorOrigin={fromPortal ? { horizontal: "right", vertical: "top" } : undefined}
                anchorRef={anchorRef}
                onClose={onClose}
                defaultOpened={true}
            >
                {featuresManualFromVideo && browsePath?.length ?
                    <MenuItem
                        onClick={() => {
                            const pathCollectionIds = browsePath
                                .filter(item => item.kind === "collection")
                                .map(collection => collection.id);
                            history.push(`${MANUAL_FROM_VIDEO_ROUTE}/${pathCollectionIds.join("/")}`);
                        }}
                        title={t(TK.DocManagement_DocFromVideo)}
                        fontSize={"14px"}
                        icon={<UploadFileIcon />}
                        testId="add-new-document-from-video"
                    /> :
                    null
                }
                <MenuItem
                    onClick={onShowAddNewDocumentModal}
                    title={t(TK.DocManagement_Doc)}
                    fontSize={"14px"}
                    icon={<CreateDocumentIcon />}
                    testId="add-new-document-default"
                />
                <MenuItem
                    onClick={onAddNewCollection}
                    title={t(TK.DocManagement_Col)}
                    fontSize={"14px"}
                    icon={<CreateCollectionIcon />}
                />
            </ContextMenu>
        </div>
    );
}

type UseAddNewButton = {
    isAddCollectionModalShown: boolean;
    isContextMenuShown: boolean;
    isNewButtonEnabled: boolean;
    isMenuOpen: boolean;
    isNewDocumentModalShown: boolean;
    itemsDataOrEmpty: MyLibraryItemType[];
    onAddNewCollection: () => void;
    onContextMenuClose: () => void;
    onShowAddNewDocumentModal: () => void;
    setIsAddCollectionModalShown: (val: boolean) => void;
    setIsNewDocumentModalShown: (val: boolean) => void;
    setIsMenuOpen: (val: boolean) => void;
    toggleMenuOpen: () => void;
}

export function useAddNewButton(): UseAddNewButton {
    const [isAddCollectionModalShown, setIsAddCollectionModalShown] = useState(false);
    const [isContextMenuShown, setIsContextMenuShown] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNewDocumentModalShown, setIsNewDocumentModalShown] = useState(false);

    const activeCollection = useActiveCollection();
    const items: IWebData<MyLibraryItemType[]> = useFluxStoreAsAny(DocumentStore, (_, store) => store.getEditableItems());
    const permissions = useMyPermissionMap();

    const itemsDataOrEmpty = useMemo(
        () => items.state === WebDataState.SUCCESS ? items.data : [],
        [items]
    );

    const canEditAnythingInAccount = useHasFullPermissionAnywhere();
    const breadcrumbsPaths = useActiveBrowsePathOrDefault(undefined);
    const pathIsLoaded = breadcrumbsPaths?.length > 0;
    const isNewButtonEnabled = useMemo(() => {
        const onRoot = activeCollection === null;
        if (onRoot) {
            return canEditAnythingInAccount;
        }
        const canEditCurrentCollection = breadcrumbsPaths && permissions.data ?
            checkHasFullPermissionInCurrentCollection(permissions.data, breadcrumbsPaths, PermissionName.EDIT) :
            undefined;
        return pathIsLoaded && canEditCurrentCollection;
    }, [activeCollection, breadcrumbsPaths, canEditAnythingInAccount, pathIsLoaded, permissions]);

    const onShowAddNewDocumentModal = () => {
        setIsNewDocumentModalShown(true)
        onContextMenuClose();
    }
    const onAddNewCollection = () => {
        onContextMenuClose();
        setIsAddCollectionModalShown(true);
    }
    const onContextMenuClose = () => {
        setIsContextMenuShown(false);
        setIsMenuOpen(false);
    }

    return {
        isAddCollectionModalShown,
        isContextMenuShown,
        isNewButtonEnabled,
        isMenuOpen,
        isNewDocumentModalShown,
        itemsDataOrEmpty,
        onAddNewCollection,
        onContextMenuClose,
        onShowAddNewDocumentModal,
        setIsAddCollectionModalShown,
        setIsMenuOpen,
        setIsNewDocumentModalShown,
        toggleMenuOpen: () => setIsMenuOpen(prev => !prev),
    }
}

export const AddNewButtonModals = (props: UseAddNewButton & {
    anchorRef: HTMLElement;
}) => {
    const {
        isAddCollectionModalShown,
        isMenuOpen,
        isNewDocumentModalShown,
        itemsDataOrEmpty,
        onAddNewCollection,
        onContextMenuClose,
        onShowAddNewDocumentModal,
        setIsAddCollectionModalShown,
        setIsNewDocumentModalShown,
    } = props;
    return <>
        {isNewDocumentModalShown && <AddNewDocumentModal
            isVisible={isNewDocumentModalShown}
            items={itemsDataOrEmpty}
            onClose={() => setIsNewDocumentModalShown(false)}
        />}
        {isAddCollectionModalShown && <AddNewCollectionModal
            isVisible={isAddCollectionModalShown}
            items={itemsDataOrEmpty}
            onClose={() => setIsAddCollectionModalShown(false)}
        />}
        {isMenuOpen && <NewItemContextMenu
            anchorRef={props.anchorRef}
            onShowAddNewDocumentModal={onShowAddNewDocumentModal}
            onAddNewCollection={onAddNewCollection}
            onClose={onContextMenuClose}
        />}
    </>;
}
