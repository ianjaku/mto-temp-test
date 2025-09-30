import * as React from "react";
import type { Dispatch, FC, SetStateAction } from "react";
import { DragDropContext, Droppable, OnDragEndResponder } from "react-beautiful-dnd";
import LibraryItem, { ItemType } from "@binders/ui-kit/lib/elements/libraryItem/row";
import { PermissionMap, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RouteComponentProps, useHistory, useRouteMatch } from "react-router";
import { useActiveAccountId, useActiveAccountSettings } from "../../accounts/hooks";
import { useActiveBrowsePathOrDefault, useActiveCollection, useCollectionIdFromRoute, useCollectionRouteParams } from "../hooks";
import { APISaveNewBinder } from "../../documents/api";
import AddNewDocument from "./document/AddNewDocument";
import DocumentStore from "../../documents/store";
import type { EditorItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { FlashMessages } from "../../logging/FlashMessages";
import type { MyLibraryItemType } from "./MyLibraryItem";
import { MyLibraryList } from "./MyLibraryList";
import NewCollectionForm from "./collection/form/index";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { browseInfoFromRouteParams } from "./routes";
import { extractTitleForBreadcrumb } from "../helper";
import { filterPermissionsWithRestrictions } from "../../authorization/tsHelpers";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { moveItemInCollection } from "../../documents/actions";
import { pickFirstParentItem } from "../../documents/helper";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const MyLibrary: FC<RouteComponentProps & {
    attentionTo: string;
    items: MyLibraryItemType[];
    modalPlaceholder: HTMLElement;
    setAttentionTo: Dispatch<SetStateAction<string>>;
    setItemsLoaded: Dispatch<SetStateAction<boolean>>;
    isLoadingBreadcrumbs: boolean;
    isLoadingItems: boolean;
}> = props => {
    const activeCollection = useActiveCollection();
    const editableDocumentsPreviews = useFluxStoreAsAny(DocumentStore, (_, store) => store.getEditableDocumentsPreviews());
    const { t } = useTranslation();

    const onDragEnd: OnDragEndResponder = ({ draggableId, destination }) => {
        if (!destination) {
            return;
        }
        if (destination.droppableId === "myLibrary-droppable") {
            const itemToMove = props.items.find(item => item.id === draggableId);
            if (itemToMove === undefined) {
                return FlashMessages.error(t(TK.DocManagement_ItemMoveFail));
            }
            return moveItemInCollection(
                activeCollection,
                draggableId,
                itemToMove.kind,
                destination.index
            );
        }
    }

    if (props.isLoadingItems || props.isLoadingBreadcrumbs) {
        return editableDocumentsPreviews.length > 1 ?
            <>{editableDocumentsPreviews.map((item, i) => (
                <LibraryItem
                    key={`pending-itm-${i}`}
                    isPending={true}
                    wantsAttention={false}
                    type={item.kind === "collection" ? ItemType.COLLECTION : ItemType.DOCUMENT}
                />
            ))}</> :
            (
                <div className="myLibrary-items">
                    <LibraryItem isPending={true} showLoader={true} />
                </div>
            );
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="myLibrary-droppable">
                {(provided) => (
                    <div className="myLibrary-items" ref={provided.innerRef} {...provided.droppableProps}>
                        {props.items.length > 0 ?
                            <MyLibraryList
                                {...props}
                                isLandingBrowsePage={false}
                                isPending={false}
                            /> :
                            <NoEditableContent />
                        }
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}

export const AddNewCollectionModal: FC<{
    items: MyLibraryItemType[];
    isVisible: boolean;
    onClose: () => void;
}> = (props) => {
    const accountId = useActiveAccountId();
    const accountSettings = useActiveAccountSettings();
    const breadcrumbsData = useActiveBrowsePathOrDefault(undefined);
    const history = useHistory();
    const isAddCollectionModalShown = props.isVisible;
    const defaultLanguageSettings = accountSettings.languages && accountSettings.languages.defaultCode;
    const collectionId = useCollectionIdFromRoute();
    const parentCollectionId = getParentCollectionId(collectionId, props.items);
    const routeParams = useCollectionRouteParams();
    const permissions = useMyPermissionMapOrEmpty();
    const properParentsForTreeNavigator = useProperParentsForTreeNavigator({
        items: props.items,
        permissions,
        breadcrumbsData,
    });
    if (!routeParams.currentCollection) {
        routeParams.currentCollection = parentCollectionId;
    }
    return isAddCollectionModalShown && (
        <NewCollectionForm
            open={isAddCollectionModalShown}
            parentItems={properParentsForTreeNavigator}
            accountId={accountId}
            parentCollectionId={parentCollectionId}
            routingParams={routeParams}
            history={history}
            onClose={props.onClose}
            defaultLanguageSettings={defaultLanguageSettings}
        />
    )
}

export const AddNewDocumentModal: FC<{
    items: MyLibraryItemType[];
    isVisible: boolean;
    onClose: () => void;
}> = (props) => {
    const accountSettings = useActiveAccountSettings();
    const accountId = useActiveAccountId();
    const isAddCollectionModalShown = props.isVisible;
    const defaultLanguageSettings = accountSettings.languages && accountSettings.languages.defaultCode;
    const breadcrumbsData = useActiveBrowsePathOrDefault(undefined);
    const { t } = useTranslation();
    const routeMatch = useRouteMatch<{ collectionId?: string }>();
    const history = useHistory();
    const permissions = useMyPermissionMapOrEmpty();

    const collectionId = routeMatch.params.collectionId;
    const parentCollectionId = getParentCollectionId(collectionId, props.items);

    const routeParams = browseInfoFromRouteParams(routeMatch.params);
    const properParentsForTreeNavigator = useProperParentsForTreeNavigator({
        items: props.items,
        permissions,
        breadcrumbsData,
    });
    if (!routeParams.currentCollection) {
        routeParams.currentCollection = parentCollectionId;
    }

    const onAddNewDocument = async (selectedCollectionId: string, selectedCollectionParentPath: string[], selectedLanguage: string) => {
        const binder = await APISaveNewBinder("", selectedCollectionId, selectedLanguage, accountId);
        props.onClose();
        const fullPathItems = [
            ...selectedCollectionParentPath,
            selectedCollectionId
        ];
        const path = fullPathItems.reduce((prev, id) => `${prev}/${id}`, "");
        FlashMessages.success(t(TK.Edit_DocCreateSuccess));
        history.push(`/documents${path}/${binder.id}`);
    }

    return isAddCollectionModalShown && (
        <AddNewDocument
            onClose={async () => {/**/ }}
            onModalHide={props.onClose}
            parentItems={properParentsForTreeNavigator}
            defaultLanguageSettings={defaultLanguageSettings}
            onAddNewDocument={onAddNewDocument}
        />
    )
}

const NoEditableContent: FC = () => {
    const { t } = useTranslation();
    const activeCollection = useActiveCollection();
    return (
        <div className="info">
            <div className="info-text">
                {activeCollection ?
                    <p>
                        {t(TK.DocManagement_ColEmptyInfo)}<br />
                        {t(TK.DocManagement_ColEmptyCta)}
                    </p> :
                    <p>{t(TK.DocManagement_ColNoEditableContent)}</p>
                }
            </div>
        </div>
    );
}

function useProperParentsForTreeNavigator(props: {
    items: MyLibraryItemType[];
    permissions: PermissionMap[];
    breadcrumbsData: EditorItem[];
}) {
    const { permissions, breadcrumbsData } = props;
    const parentItems = breadcrumbsData ?? [];
    const routeMatch = useRouteMatch();
    const restrictionlessPermissions = filterPermissionsWithRestrictions(permissions);
    const itemIds = getItemIdsFromPermissionMap(restrictionlessPermissions, [PermissionName.ADMIN, PermissionName.EDIT]);
    for (const parentItem of [...parentItems]) {
        if (itemIds.includes(parentItem.id)) {
            break;
        }
        parentItems.shift();
    }
    if (routeMatch.path.startsWith("/documents")) {
        parentItems.pop();
    }
    return ((parentItems || []).length === 0) ?
        pickFirstParentItem(props.items) :
        (parentItems || []).map(item => (
            { id: item.id, name: extractTitleForBreadcrumb(item) }
        ));
}

function getParentCollectionId(collectionId: string, items: MyLibraryItemType[]) {
    if (collectionId) { // we're in a collection
        return collectionId;
    }
    // we're at the root, look for root collection / first available collection
    let parentCollection = items?.find(item => {
        if (!item || item.kind !== "collection") {
            return false;
        }
        return item.isRootCollection;
    });
    if (!parentCollection && items) {
        parentCollection = items.find(item => item.kind === "collection");
    }
    return parentCollection?.id;
}
