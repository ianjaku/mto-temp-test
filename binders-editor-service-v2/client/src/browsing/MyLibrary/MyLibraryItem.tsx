import * as React from "react";
import type { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Dispatch, FC, SetStateAction, useCallback, useMemo, useState } from "react";
import LibraryItem, { ItemType } from "@binders/ui-kit/lib/elements/libraryItem/row";
import { useActiveAccountFeatures, useIsSortingEnabled } from "../../accounts/hooks";
import {
    useActiveBrowsePathOrDefault,
    useActiveCollection,
    useBindersAdditionalInfo,
    useChecklistProgresses,
    useCollectionInfo,
    useDocumentsPublicInfo,
} from "../hooks";
import AccountStore from "../../accounts/store";
import { BreadcrumbsItemContextMenu } from "../helper";
import { BrowseShareButton } from "../../shared/sharing/BrowseShareButton";
import { Draggable } from "react-beautiful-dnd";
import { FEATURE_DISABLE_PUBLIC_ICON } from "@binders/client/lib/clients/accountservice/v1/contract";
import { KEY_EDITABLE_DOCUMENTS_PREVIEWS } from "../../documents/store";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import classNames from "classnames";
import { dispatch } from "@binders/client/lib/react/flux/dispatcher";
import { fmtDateTimeRelative } from "@binders/client/lib/util/date";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { intersection } from "ramda";
import { isThisItemHidden } from "../../shared/helper";
import { useItemLocks } from "../../editlocking/store";
import { useMyDetails } from "../../users/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

export type MyLibraryItemType = DocumentCollection | Binder & { kind: "document" }

export const MyLibraryItem: FC<RouteComponentProps & {
    attentionTo: string;
    index: number;
    isPending: boolean;
    item: MyLibraryItemType;
    modalPlaceholder: HTMLElement;
    setAttentionTo: Dispatch<SetStateAction<string>>;
    setItemsLoaded: Dispatch<SetStateAction<boolean>>;
    title: string;
}> = props => {
    const {
        history,
        index,
        item,
        modalPlaceholder,
        setAttentionTo,
        setItemsLoaded,
        title,
    } = props;

    const accountFeatures = useActiveAccountFeatures();
    const activeCollection = useActiveCollection();
    const bindersAdditionalInfo = useBindersAdditionalInfo();
    const breadcrumbsData = useActiveBrowsePathOrDefault(undefined);
    const checklistProgresses = useChecklistProgresses();
    const collectionInfo = useCollectionInfo();
    const currentUser = useMyDetails();
    const documentIsPublicInfo = useDocumentsPublicInfo();
    const isSortingEnabled = useIsSortingEnabled();
    const permissions = useMyPermissionMapOrEmpty();

    const lockedItems = useItemLocks();

    const { t } = useTranslation();
    const [isBrowseContextLoaded, setBrowseContextLoaded] = useState(false);

    const isCollection = item.kind === "collection";
    const isPublicIconDisabled = accountFeatures.includes(FEATURE_DISABLE_PUBLIC_ICON);
    const itemsWithEditAcls = getItemIdsFromPermissionMap(permissions, [PermissionName.ADMIN, PermissionName.EDIT]);
    const itemsWithViewAcls = getItemIdsFromPermissionMap(permissions, [PermissionName.VIEW]);
    const breadcrumbsDataOrEmptyArray = breadcrumbsData ?? [];
    const canIEdit = intersection(itemsWithEditAcls, [...breadcrumbsDataOrEmptyArray.map(({ id }) => id), item.id]).length >= 1;
    const canIView = intersection(itemsWithViewAcls, [...breadcrumbsDataOrEmptyArray.map(({ id }) => id), item.id]).length >= 1;
    const isReadOnlyMode = isThisItemHidden(accountFeatures, AccountStore.getActiveAccount().canIEdit, canIEdit, canIView);
    const type = isCollection ? ItemType.COLLECTION : ItemType.DOCUMENT;

    const onCollectionClick = useCallback(() => {
        const pathname = `${window.location.pathname}/${item.id}`;
        setItemsLoaded(false);
        setBrowseContextLoaded(false);
        setAttentionTo(undefined);
        dispatch({
            type: KEY_EDITABLE_DOCUMENTS_PREVIEWS,
            body: []
        });
        history.push(pathname);
    }, [history, item.id, setAttentionTo, setItemsLoaded])

    const shouldIgnoreDocumentClick = isReadOnlyMode ||
        !breadcrumbsData ||
        (breadcrumbsData.length <= 0 && activeCollection);

    const onDocumentClick = useCallback(() => {
        if (shouldIgnoreDocumentClick) {
            return undefined;
        }
        const pathname = `${window.location.pathname.replace("browse", "documents")}/${item.id}`;
        history.push(pathname);
    }, [history, item.id, shouldIgnoreDocumentClick]);

    const isEmpty = isCollection && item.elements.length === 0;
    const notPublished = !isCollection && !item.hasPublications;
    const rowClassName = classNames({
        "library-row-document-no-items": notPublished || isEmpty,
        "library-row-isReadonly": isReadOnlyMode,
        "isDocument": !isCollection
    });

    const lockedBy = useMemo(() => {
        const itemId = item.id
        if (!breadcrumbsData) {
            return undefined;
        }
        const fullActiveIdPath = [...breadcrumbsData.map(i => i.id), itemId];
        const relevantLockedItemId = fullActiveIdPath.find(id => lockedItems.has(id));
        const relevantLockedItem = relevantLockedItemId && lockedItems.get(relevantLockedItemId);
        if (!relevantLockedItem) {
            return undefined;
        }
        const { user, lockVisibleByInitiator } = relevantLockedItem;
        const itsMe = currentUser && (user.id === currentUser?.user?.id);
        const shouldRenderLock = !!user && (lockVisibleByInitiator || !itsMe);
        return shouldRenderLock ? user : undefined;
    }, [breadcrumbsData, currentUser, item.id, lockedItems]);

    const breadcrumbsDataFunc = breadcrumbsData ? async () => breadcrumbsData : undefined;

    const additionalInfo = useMemo(() => {
        const isDocument = item.kind === "document";
        const emptyInfo = "";
        if (isDocument && bindersAdditionalInfo) {
            const info = bindersAdditionalInfo[item.id];
            const lastEdit = info?.lastEdit && fmtDateTimeRelative(new Date(info?.lastEdit as string), { addSuffix: true });
            return !info?.lastEditBy || !lastEdit ? "" : t(TK.Edit_LastEdited, { when: lastEdit, who: info.lastEditBy });
        }
        if (!isDocument && collectionInfo?.childCollectionSummaries) {
            const info = collectionInfo.childCollectionSummaries[item.id];
            if (!info) {
                return emptyInfo;
            }

            const {
                collections,
                publishedDocuments,
                unpublishedDocuments,
            } = info;

            const infoParts = [
                collections > 0 ? t(TK.DocManagement_ColWithCount, { count: collections }) : undefined,
                publishedDocuments > 0 ? t(TK.DocManagement_PubDocWithCount, { count: publishedDocuments }) : undefined,
                unpublishedDocuments > 0 ? t(TK.DocManagement_UnpubDocWithCount, { count: unpublishedDocuments }) : undefined,
            ];
            return infoParts.filter(part => !!part).join(", ") || t(TK.General_Empty);
        }
        return emptyInfo;
    }, [bindersAdditionalInfo, collectionInfo?.childCollectionSummaries, item.id, item.kind, t])

    const isPublicInfo = useMemo(() => {
        return documentIsPublicInfo ? documentIsPublicInfo[item.id] : {};
    }, [documentIsPublicInfo, item.id]);

    const checklistProgress = item.kind === "document" && checklistProgresses[item.id];

    return (
        <Draggable
            key={`${item.id}-${index}`}
            draggableId={item.id}
            index={index}
            isDragDisabled={
                (breadcrumbsDataOrEmptyArray.length === 0) ||
                isSortingEnabled
            }
        >
            {(provided) => (<>
                <div
                    key={`library-item-${item.id}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{ ...provided.draggableProps.style }}
                >
                    <LibraryItem
                        key={item.id || index}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        views={(item as any).views}
                        title={title}
                        thumbnail={item.thumbnail}
                        className={rowClassName}
                        isContextMenuDataLoaded={isBrowseContextLoaded}
                        isPending={props.isPending}
                        type={type}
                        wantsAttention={item.id === props.attentionTo}
                        onClick={isCollection ? onCollectionClick : onDocumentClick}
                        lockedBy={lockedBy}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        isHidden={(item as any).isHidden}
                        additionalInfo={additionalInfo}
                        isPublicIconDisabled={isPublicIconDisabled}
                        isPublicInfo={isPublicInfo}
                        contextMenu={
                            <BreadcrumbsItemContextMenu
                                item={item as DocumentCollection}
                                getParentItems={breadcrumbsDataFunc}
                                isForActive={false}
                                history={history}
                                modalPlaceholder={modalPlaceholder}
                                hideRootCollection={false}
                            />
                        }
                        checklistProgress={checklistProgress}
                        shareButton={<BrowseShareButton item={item} />}
                    />
                </div>
                <div key={`library-placeholder-${item.id}`}>
                    {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (provided as any).placeholder
                    }
                </div>
            </>)}
        </Draggable>
    );
}

