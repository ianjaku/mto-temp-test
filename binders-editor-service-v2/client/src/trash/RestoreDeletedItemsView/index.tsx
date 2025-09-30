import * as React from "react";
import {
    Binder,
    DocumentCollection,
    Item,
    SoftDeletedItemsFilter
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Breadcrumbs, { IBreadcrumbItem } from "@binders/ui-kit/lib/elements/breadcrumbs";
import {
    DateRangeFilter,
    TimeRangeSection,
    defaultDateRangeFilter,
    getDateRange
} from "./TimeRangeSection";
import LibraryItem, { ItemType } from "@binders/ui-kit/lib/elements/libraryItem/row";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import { TRASH_ROUTE, browseInfoFromRouteParams } from "../routes";
import { assoc, reverse } from "ramda";
import { fmtDateIso8601TZ, fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { useActiveAccountFeatures, useActiveAccountId } from "../../accounts/hooks";
import { APILoadCollection } from "../../documents/api";
import { BROWSE_ROUTE } from "../../browsing/MyLibrary/routes";
import Button from "@binders/ui-kit/lib/elements/button";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import ContextMenu from "./contextMenu";
import { DeletedBySection } from "./DeletedBySection";
import { FlashMessages } from "../../logging/FlashMessages";
import Layout from "../../shared/Layout/Layout";
import RestoreDeletedItemModal from "../RestoreDeletedItemModal";
import { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { loadDeletedItems } from "../actions";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { useTrashStore } from "../store";
import "./deletedItems.styl";

const toSoftDeletedFilter = (scopeCollectionId: string, dateRangeFilter: DateRangeFilter, deletedById: string): SoftDeletedItemsFilter => ({
    scopeCollectionId,
    dateRange: getDateRange(dateRangeFilter),
    deletedById: deletedById || undefined // Turn "" into undefined
});

const RestoreDeletedItemsView: React.FC<RouteComponentProps<{ scopeCollectionId: string }>> = ({ history, location, match }) => {
    const scopeCollectionId = match.params["scopeCollectionId"];
    const modalPlaceholder = React.useRef<HTMLDivElement>();
    const [loading, setLoading] = React.useState<boolean>(false);
    const [deletedById, setDeletedById] = React.useState<string | undefined>(undefined);
    const [dateRangeFilter, setDateRangeFilter] = React.useState<DateRangeFilter>(defaultDateRangeFilter);
    const [softDeletedItemsFilter, setSoftDeletedItemsFilter] = React.useState<SoftDeletedItemsFilter>(
        toSoftDeletedFilter(scopeCollectionId, defaultDateRangeFilter, undefined)
    );
    const [itemFacingRestore, setItemFacingRestore] = React.useState(undefined);
    const [scopeCollectionTitle, setScopeCollectionTitle] = React.useState<string | undefined>(undefined);
    const [loadingMoreItems, setLoadingMoreItem] = React.useState<boolean>(false);

    const { t } = useTranslation();
    const activeAccountId = useActiveAccountId();
    const accountFeatures = useActiveAccountFeatures();
    const permissions = useMyPermissionMapOrEmpty();
    const softDeletedItems = useTrashStore(store => store.softDeletedItems);
    const parentItemsMap = useTrashStore(store => store.parentItemsMap);
    const doMoreItemsExist = useTrashStore(store => store.doMoreItemsExist);
    const usersById = useTrashStore(store => store.usersById);

    const loadSoftDeletedItems = React.useCallback(async () => {
        setLoading(true);
        await loadDeletedItems(
            activeAccountId,
            accountFeatures,
            softDeletedItemsFilter,
            permissions,
        )
        setLoading(false);
    }, [accountFeatures, activeAccountId, permissions, softDeletedItemsFilter]);

    const getLoadMoreItemsFilter = React.useCallback(() => {
        const oldestItem = softDeletedItems.reduce((oldest, current) => {
            if (oldest.deletionTime > current.deletionTime) return current;
            return oldest;
        })
        const dateRange = assoc("until", oldestItem.deletionTime, softDeletedItemsFilter.dateRange ?? {});
        return assoc("dateRange", dateRange, softDeletedItemsFilter);
    }, [softDeletedItems, softDeletedItemsFilter]);

    const loadMoreSoftDeletedItems = React.useCallback(async () => {
        setLoadingMoreItem(true);
        await loadDeletedItems(
            activeAccountId,
            accountFeatures,
            getLoadMoreItemsFilter(),
            permissions,
            true
        );
        setLoadingMoreItem(false);
    }, [accountFeatures, activeAccountId, getLoadMoreItemsFilter, permissions]);

    const loadScopeCollectionTitle = React.useCallback(async () => {
        if (scopeCollectionId) {
            try {
                const collectionObject = await APILoadCollection(scopeCollectionId);
                setScopeCollectionTitle(extractTitle(collectionObject));
            } catch (ex) {
                FlashMessages.error(t(TK.Trash_ScopeCollectionFail));
            }
        }
    }, [scopeCollectionId, t]);

    React.useEffect(() => {
        loadSoftDeletedItems();
    }, [loadSoftDeletedItems])

    React.useEffect(() => {
        loadScopeCollectionTitle();
    }, [loadScopeCollectionTitle]);

    const renderDeletedItems = React.useCallback(() => {
        let lastUsedParentId = undefined;
        return softDeletedItems.map((item, i) => {
            const additionalInfo = getAdditionalInfo(item, t, usersById);
            const isCollection = item["kind"] === "collection";
            const directParent = parentItemsMap[item.id]?.ancestorsIds?.[0];
            const shouldRenderBreadcrumbs = directParent !== lastUsedParentId;
            lastUsedParentId = directParent;
            let breadcrumbItems: IBreadcrumbItem[] = [];
            if (parentItemsMap && parentItemsMap[item.id] && shouldRenderBreadcrumbs) {
                breadcrumbItems = reverse(parentItemsMap[item.id].ancestorsIds).reduce((prev, b) => {
                    const itemObject = parentItemsMap[item.id].ancestorsObjects.find(({ id }) => id === b);
                    if (itemObject) {
                        const [readonly, strikeThrough, tooltip] = itemObject?.deletionTime ?
                            [true, true, t(TK.Trash_CollectionDeletedTooltip)] :
                            [itemObject.readonly, false, undefined];
                        prev.push({
                            name: itemObject ? itemObject.titles[0]?.title : b,
                            link: `/browse${(parentItemsMap[b] ? `/${[...parentItemsMap[b].ancestorsIds].reverse().join("/")}` : "")}/${b}`,
                            renderAsLast: false,
                            readonly,
                            strikeThrough,
                            tooltip,
                        });
                    }
                    return prev;
                }, [{
                    name: t(TK.myLibrary),
                    link: BROWSE_ROUTE,
                }] as IBreadcrumbItem[]);
            }

            return ([
                ...(shouldRenderBreadcrumbs ?
                    [<Breadcrumbs
                        key={`breadcrumb-${item.id}`}
                        keySuffix={`${i}`}
                        items={breadcrumbItems}
                        itemContextMenu={<span />}
                    />] :
                    []),
                <LibraryItem
                    usePlaceholderThumbnail={true}
                    key={item.id}
                    // really sweet hack to show items count in a nice place
                    views={item.deletedGroupCollectionId &&
                        <span className="deletedItems-libraryItem-additionalInfo-itemCount">
                            <span className="countNumber">{item["deletedGroupCount"] || t(TK.General_NotApplicable)}</span>&nbsp;{t(TK.Trash_RecursivelyDeletedItemsCount)}
                        </span>
                    }
                    title={extractTitle(item)}
                    additionalInfo={additionalInfo?.desktop}
                    additionalInfoMobile={additionalInfo?.mobile}
                    thumbnail={item.thumbnail}
                    isHidden={item["isHidden"]}
                    isPublicInfo={undefined}
                    onClick={() => setItemFacingRestore(item)}
                    type={isCollection ? ItemType.COLLECTION : ItemType.DOCUMENT}
                    contextMenu={<ContextMenu
                        accountId={activeAccountId}
                        onRestoreItem={() => setItemFacingRestore(item)}
                        item={item}
                        modalPlaceholder={modalPlaceholder.current}
                        ancestors={parentItemsMap ? parentItemsMap[item.id] : {} as { ancestorsIds: Array<string>, ancestorsObjects: Array<Item> }}
                        permissions={permissions}
                        isCollection={isCollection}
                        history={history}
                    />}
                />
            ])
        })
    }, [activeAccountId, softDeletedItems, history, parentItemsMap, permissions, t, usersById]);

    return (
        <div ref={modalPlaceholder}>
            <Layout
                breadcrumbsClassName="container"
                browseInfoFromRouteParams={browseInfoFromRouteParams}
                className="deletedItems"
                containerClassName="container"
                hideBreadcrumbs={true}
                history={history}
                innerContainerClassName="container-inner"
                match={match}
                location={location}
                modalPlaceholder={modalPlaceholder.current}
                showMyLibraryLink={false}
            >
                <div className="deletedItems-filter-wrapper" >
                    <div className="deletedItems-wrapper">
                        <div className="deletedItems-heading">
                            <div className="deletedItems-heading-title">
                                {t(TK.Trash_RecycleBin)}
                                {scopeCollectionTitle && (
                                    <div className="deletedItems-info">
                                        <span>({t(TK.Trash_ScopeCollectionInfo)} {scopeCollectionTitle}.</span>&nbsp;
                                        <a className="deletedItems-linkButton" href={TRASH_ROUTE}>{t(TK.Trash_ShowAll)})</a>
                                    </div>
                                )}
                            </div>

                        </div>
                        <div className="deletedItems-filter">
                            <div className="deletedItems-filter-content">
                                <DeletedBySection
                                    deletedById={deletedById}
                                    setDeletedById={setDeletedById}
                                    deletedElementsUsers={Object.values(usersById)}
                                />
                                <hr className="deletedItems-filter-content-sectionSeparator" />
                                <TimeRangeSection
                                    filter={dateRangeFilter}
                                    updateFilter={setDateRangeFilter}
                                />
                                <Button
                                    onClick={() => setSoftDeletedItemsFilter(toSoftDeletedFilter(scopeCollectionId, dateRangeFilter, deletedById))}
                                    text={t(TK.Trash_Filter)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                {itemFacingRestore && <RestoreDeletedItemModal
                    onCancel={() => setItemFacingRestore(undefined)}
                    itemFacingRestore={itemFacingRestore}
                    activeAccountId={activeAccountId}
                    parentItemsMap={parentItemsMap}
                    permissions={permissions} />}
                {loading && <div className="deletedItems-loading">{CircularProgress("", {}, 24)}</div>}
                {/* eslint-disable-next-line no-nested-ternary */}
                {(!loading) ?
                    (
                        softDeletedItems && softDeletedItems.length > 0 ?
                            (
                                <div className="deletedItems-wrapper">
                                    {renderDeletedItems()}
                                </div>
                            ) :
                            <span className="deletedItems-infomessage">
                                {t(TK.Trash_NoResults)}
                            </span>
                    ) :
                    null}
                {!loading && doMoreItemsExist && <div className="deletedItems-loadmore">
                    <Button
                        inactiveWithLoader={loadingMoreItems}
                        text={"Load more"}
                        onClick={loadMoreSoftDeletedItems}
                    />
                </div>}
            </Layout>
        </div>
    );
}

function getAdditionalInfo(item: Binder | DocumentCollection, t: TFunction, usersMap: Record<string, { login: string }>) {
    const login = usersMap[item.deletedById]?.login;
    const deletionTime = item.deletionTime;
    return {
        desktop: `${t(TK.Trash_DateDeleted)} ${fmtDateIso8601TimeLocalizedTZ(deletionTime)} ${t(TK.General_By)} ${login}`,
        mobile: `${fmtDateIso8601TZ(deletionTime)} ${t(TK.General_By)} ${login}`
    };
}

export default RestoreDeletedItemsView;
