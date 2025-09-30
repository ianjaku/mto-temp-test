import * as React from "react";
import { BrowseInfo, browseInfoFromRouteParams } from "./routes";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    FEATURE_CHECKLISTS,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import { RouteComponentProps, useHistory } from "react-router";
import { getEditableItems, loadItemsInCollection } from "../../documents/actions";
import {
    loadAdditionalInfoForCollections,
    loadBindersAdditionalInfo,
    loadBrowseContext,
    loadChecklistProgresses,
    loadCollectionInfo,
    setTestMode
} from "../actions";
import {
    useActiveAccount,
    useActiveAccountFeatures,
    useActiveAccountId
} from "../../accounts/hooks";
import { useActiveBrowsePathWebData, useCollectionInfo } from "../hooks";
import {
    useRibbonsBottomHeight,
    useRibbonsTopHeight
} from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import DeletedItemNotification from "../../shared/DeletedItemNotification";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import DocumentStore from "../../documents/store";
import Layout from "../../shared/Layout/Layout";
import { MyLibrary } from "./MyLibrary";
import { MyLibraryItemType } from "./MyLibraryItem";
import { MyLibraryTabInfo } from "../MyLibraryTabInfo/MyLibraryTabInfo";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { buildSingleCollectionParentItemsMap } from "../../trash/helpers";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { getQueryStringVariable } from "@binders/client/lib/util/uri";
import { makeItemsParentMap } from "../helper";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import "./myLibrary.styl";

export const MyLibraryPage: FC<RouteComponentProps<{ collectionId: string }>> = props => {
    const { location, match } = props;
    const { collectionId } = match.params;

    const modalPlaceholder = useRef<HTMLDivElement>();

    const [attentionTo, setAttentionTo] = useState("")
    const [itemsLoaded, setItemsLoaded] = useState(false);

    const account = useActiveAccount();
    const accountFeatures = useActiveAccountFeatures();
    const accountId = useActiveAccountId();
    const breadcrumbsPathsWd = useActiveBrowsePathWebData();
    const collectionInfo = useCollectionInfo();
    const permissions = useMyPermissionMapOrEmpty();
    const ribbonsBottomHeight = useRibbonsBottomHeight();
    const ribbonsTopHeight = useRibbonsTopHeight();

    const history = useHistory();

    const items: IWebData<MyLibraryItemType[]> = useFluxStoreAsAny(DocumentStore, (_, store) => store.getEditableItems());

    const isLoadingBreadcrumbs = breadcrumbsPathsWd.state !== WebDataState.SUCCESS;
    const isLoadingItems = items.state !== WebDataState.SUCCESS;
    const breadcrumbsPaths: DocumentCollection[] = breadcrumbsPathsWd.state === WebDataState.SUCCESS ?
        breadcrumbsPathsWd.data as DocumentCollection[] :
        undefined;

    const editableItemIds = useMemo(() => {
        const isReadOnlyMode = accountFeatures.includes(FEATURE_READONLY_EDITOR);
        const relevantPermissions = isReadOnlyMode ?
            [PermissionName.ADMIN, PermissionName.EDIT, PermissionName.VIEW] :
            [PermissionName.ADMIN, PermissionName.EDIT];
        return getItemIdsFromPermissionMap(permissions, relevantPermissions);
    }, [accountFeatures, permissions]);

    const rootCollectionId = account?.rootCollectionId;
    const hasAccessToRootCollection = useMemo(() => {
        const itemIds = getItemIdsFromPermissionMap(permissions, [PermissionName.VIEW]);
        return itemIds.includes(rootCollectionId);
    }, [permissions, rootCollectionId]);

    const browseInfo = useMemo(
        () => browseInfoFromRouteParams(match.params),
        [match.params]
    );

    const itemsDataOrEmpty = useMemo(
        () => items.state === WebDataState.SUCCESS ? items.data : [],
        [items]
    );

    const loadAdditionalInfo = useCallback((browseInfo: BrowseInfo) => {
        const documents = itemsDataOrEmpty.filter(item => item.kind === "document");
        const binderIds = documents.map(document => document.id);
        const collections = itemsDataOrEmpty.filter(item => item.kind !== "document");
        const itemsParentsMap = makeItemsParentMap(itemsDataOrEmpty);

        // @TODO Investigate the possibility to save multiple requests for additional info
        if (binderIds.length > 0) {
            loadBindersAdditionalInfo(documents, itemsParentsMap, accountId);
            if (accountFeatures.includes(FEATURE_CHECKLISTS)) {
                loadChecklistProgresses(binderIds);
            }
        }
        if (browseInfo.currentCollection) {
            const collection = { id: browseInfo.currentCollection, isRootCollection: false };
            loadCollectionInfo(collection.id, itemsParentsMap);
            return;
        }

        if (collections.length > 0) {
            const collectionIds = collections.map(c => c.id);
            loadAdditionalInfoForCollections(collectionIds, itemsParentsMap, accountId);
        }
    }, [accountFeatures, accountId, itemsDataOrEmpty]);

    useEffect(() => {
        if (!collectionId && hasAccessToRootCollection) {
            history.push(`/browse/${rootCollectionId}${location.search}`);
        }
    }, [collectionId, hasAccessToRootCollection, history, location, rootCollectionId]);

    useEffect(() => {
        if (collectionId) loadItemsInCollection(collectionId);
    }, [collectionId]);

    useEffect(() => {
        if (!collectionId) getEditableItems(editableItemIds);
    }, [collectionId, editableItemIds]);

    const isReadonlyEditor = accountFeatures.includes(FEATURE_READONLY_EDITOR);
    useEffect(() => {
        loadBrowseContext(
            browseInfo,
            true,
            permissions,
            isReadonlyEditor,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify({ browseInfo, isReadonlyEditor, permissions })]);

    useEffect(() => {
        const attentionTo = getQueryStringVariable("attentionTo", location.search);
        if (attentionTo) {
            setAttentionTo(attentionTo);
        }
        const isTest = !!getQueryStringVariable("isTest", location.search);
        if (isTest) {
            setTestMode();
        }
    }, [location]);

    useEffect(() => {
        if (itemsLoaded) {
            loadAdditionalInfo(browseInfo);
        }
    }, [browseInfo, itemsLoaded, loadAdditionalInfo]);

    useEffect(() => {
        if (items.state === WebDataState.SUCCESS && !itemsLoaded) setItemsLoaded(true)
    }, [items, itemsLoaded]);

    return (
        <div
            className="myLibrary"
            ref={modalPlaceholder}
            style={{
                marginTop: `${ribbonsTopHeight}px`,
                marginBottom: `${ribbonsBottomHeight}px`,
            }}
        >
            <MyLibraryTabInfo />
            <Layout
                breadcrumbsClassName="container"
                browseInfoFromRouteParams={browseInfoFromRouteParams}
                className="my-library-breadcrumbs"
                containerClassName="container"
                delayBreadcrumbsActivation={true}
                history={props.history}
                innerContainerClassName="container-inner"
                location={location}
                match={match}
                modalPlaceholder={modalPlaceholder.current}
            >
                {collectionInfo?.collection?.deletionTime ?
                    <DeletedItemNotification
                        item={collectionInfo.collection}
                        parentItemsMap={breadcrumbsPaths ?
                            buildSingleCollectionParentItemsMap(
                                collectionInfo.collection.id,
                                breadcrumbsPaths,
                            ) :
                            {}
                        }
                    /> :
                    <div>
                        <MyLibrary
                            {...props}
                            attentionTo={attentionTo}
                            isLoadingBreadcrumbs={isLoadingBreadcrumbs}
                            isLoadingItems={isLoadingItems}
                            items={itemsDataOrEmpty}
                            modalPlaceholder={modalPlaceholder.current}
                            setAttentionTo={setAttentionTo}
                            setItemsLoaded={setItemsLoaded}
                        />
                    </div>
                }
            </Layout>
        </div>
    );
}

