import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    EditorItemSearchResult,
    EditorSearchHit,
    IChecklistProgress
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_CHECKLISTS,
    FEATURE_READONLY_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import LibraryItem, { ItemType } from "@binders/ui-kit/lib/elements/libraryItem/row";
import {
    PermissionMap,
    PermissionName
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    SEARCH_QUERY_LANGUAGE_OPTION_REGEX,
    extractTitleForLanguage,
    getBinderMasterLanguage,
    idOfSearchHit
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { StoreItemLock, useItemLocks } from "../../editlocking/store";
import { buildAncestorsPromise, buildParentItems, getDirectParentWithPaths } from "../tsActions";
import {
    buildMatchCountString,
    byMostMatches,
} from "@binders/client/lib/util/elastic";
import {
    cleanFoundAncestors,
    cleanFoundItems,
    getEditableItems,
    searchForItems
} from "../actions";
import { getIsPublicInfo, loadChecklistProgresses } from "../../browsing/actions";
import AccountStore from "../../accounts/store";
import Breadcrumbs from "@binders/ui-kit/lib/elements/breadcrumbs";
import { BreadcrumbsItemContextMenu } from "../../browsing/helper";
import { Container } from "flux/utils";
import { DocumentIsPublicInfo } from "../../stores/browse-store";
import DocumentStore from "../store";
import FallbackComponent from "../../application/FallbackComponent";
import { FitBehaviour } from "@binders/ui-kit/lib/elements/thumbnail";
import { RouteComponentProps } from "react-router";
import ScopeTitle from "@binders/ui-kit/lib/compounds/scopedSearch/ScopeTitle";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { WebData } from "@binders/client/lib/webdata";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import { WebDataState } from "@binders/client/lib/webdata";
import { accountUsers } from "../../users/actions";
import autobind from "class-autobind";
import { createCommonHitMap } from "@binders/client/lib/ancestors";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { intersection } from "ramda";
import { isThisItemHidden } from "../../shared/helper";
import { useChecklistProgresses } from "../../browsing/hooks";
import { useDocumentsPublicInfo } from "../../browsing/hooks";
import { useMyDetails } from "../../users/hooks";
import { useMyPermissionMapOrEmpty } from "../../authorization/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./search.styl";

const buildPath = (ancestor, itemId, isCollection) => {
    const prefix = isCollection ? "/browse" : "/documents";
    let infix;
    if (!ancestor) {
        infix = "";
    } else {
        const parentPaths = ancestor.parentPaths.map(item => item.id);
        infix = `/${parentPaths.join("/")}`;
    }
    const suffix = infix.endsWith("/") ? itemId : `/${itemId}`;
    return `${prefix}${infix}${suffix}`;
}


const buildOnClick = (history, documentId, isCollection, context, index: number): () => "pending" | undefined => {
    return () => {
        if (!context.state.hitsInfo || !context.state.hitsInfo[documentId]) {
            return "pending";
        }
        const { isThisItemDisabledForMe, ancestor } = context.state.hitsInfo[documentId];
        if (!isThisItemDisabledForMe || isCollection) {
            const path = buildPath(ancestor, documentId, isCollection);
            history.push(path);
            captureFrontendEvent(EditorEvent.SearchResultClicked, { resultIndex: index });
        }
        return undefined;
    }
}

interface SearchResultsProps extends RouteComponentProps<{ searchTerm?: string; scopeCollectionId?: string }> {
    lockedItems: ReadonlyMap<string, StoreItemLock>;
    currentUser?: UserDetails;
    permissions: PermissionMap[];
    t: TFunction;
    isPublicInfo?: DocumentIsPublicInfo;
    checklistProgresses?: IChecklistProgress[];
}

export interface IWebComponentAppState {
    data: {
        searchResult: WebData<EditorItemSearchResult>;
    };
}

class SearchResults extends WebDataComponent<IWebComponentAppState, SearchResultsProps> {

    private calculateIsReadonlyInvoked;
    private foundItemsAncestorsPromise;
    private modalPlaceholder;

    static getStores() {
        return [DocumentStore, AccountStore];
    }

    static calculateState(_prevState) {

        return {
            data: WebData.compose({
                searchResult: DocumentStore.getFoundItems(),
            }),
            showInfo: false,
            accountId: AccountStore.getActiveAccountId(),
            hitsInfo: _prevState ? _prevState.hitsInfo : undefined,
            foundItemsAncestors: DocumentStore.getFoundItemsAncestors(),
            isPublicInfo: _prevState ? _prevState.isPublicInfo : {},
            checklistProgresses: _prevState ? _prevState.checklistProgresses : {},
            commonParentItemMap: _prevState ? _prevState.commonParentItemMap : {},
        };
    }

    constructor(props) {
        super(props);
        autobind(this, SearchResults.prototype);
    }

    componentDidMount() {
        const { match: { params: { searchTerm, scopeCollectionId } } } = this.props;
        const { accountId } = this.state;
        const features = AccountStore.getAccountFeatures();
        accountUsers(this.state.accountId);

        getEditableItems(
            getItemIdsFromPermissionMap(
                this.props.permissions,
                features.result.includes(FEATURE_READONLY_EDITOR) ?
                    [PermissionName.VIEW, PermissionName.ADMIN, PermissionName.EDIT] :
                    [PermissionName.ADMIN, PermissionName.EDIT]
            )
        );
        this.setState({
            showInfo: true,
            modalPlaceholder: this.modalPlaceholder,
            scopeCollectionId,
        });
        if (searchTerm && accountId) {
            searchForItems(searchTerm, accountId, scopeCollectionId);
            return;
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const { match: { params: { searchTerm: prevSearchTerm, scopeCollectionId: prevScopeCollectionId } } } = prevProps;
        const { match: { params: { searchTerm, scopeCollectionId } }, permissions } = this.props;
        let stateUpdates = {};
        const searchTermChanged = !!searchTerm && (searchTerm !== prevSearchTerm);
        const scopeCollectionIdChanged = (scopeCollectionId !== prevScopeCollectionId);
        const { foundItemsAncestors: prevFoundItemsAncestors, data: prevData } = prevState;
        const { accountId, hitsInfo, foundItemsAncestors, data } = this.state;
        const activeAccount = AccountStore.getActiveAccount();
        const foundItemsAncestorsChanged = !prevFoundItemsAncestors && foundItemsAncestors;
        const accountFeatures = AccountStore.getAccountFeatures();

        const hits: Array<EditorSearchHit> | undefined = data.state === WebDataState.SUCCESS && data.data.searchResult.hits;
        const prevHits: Array<EditorSearchHit> | undefined = prevData.state === WebDataState.SUCCESS && prevData.data.searchResult.hits;
        const hitsChanged = (hits || []).map(h => idOfSearchHit(h)).join() !== (prevHits || []).map(h => idOfSearchHit(h)).join();

        if (hits && hitsChanged) {
            const allKeys = hits.map(x => this.interpretSearchHit(x)).map(({ key }) => key);
            this.foundItemsAncestorsPromise = buildAncestorsPromise(allKeys);
            const filteredHits = this.filterSearchHitsParentCollections(hits, accountFeatures);
            stateUpdates = {
                ...stateUpdates,
                commonParentItemMap: createCommonHitMap(filteredHits, this.takeItem, this.renderItem.bind(this)),
            }
        }

        if (data.state === WebDataState.SUCCESS && foundItemsAncestorsChanged && !hitsInfo && data.data.searchResult) {
            this.calculateIsReadonly(data.data, accountId, permissions, activeAccount, accountFeatures);
        }
        if (data.state === WebDataState.SUCCESS && prevData.state !== WebDataState.SUCCESS) {
            this.loadPublicInfo(data, accountId);
            const binderIds = data.data.searchResult.hits.filter(hit => !!hit.binderSummary).map(hit => hit.binderSummary.id);
            if (binderIds.length && accountFeatures.result.includes(FEATURE_CHECKLISTS)) {
                loadChecklistProgresses(binderIds);
            }
        }
        if (searchTermChanged) {
            stateUpdates = {
                ...stateUpdates,
                hitsInfo: undefined,
            };
            cleanFoundAncestors();
            this.calculateIsReadonlyInvoked = false;
            searchForItems(searchTerm, accountId, scopeCollectionId);
        }
        if (scopeCollectionIdChanged) {
            stateUpdates = {
                ...stateUpdates,
                scopeCollectionId,
            };
        }
        if (Object.keys(stateUpdates).length) {
            this.setState(stateUpdates);
        }
    }

    componentWillUnmount() {
        cleanFoundItems();
        cleanFoundAncestors();
        this.calculateIsReadonlyInvoked = false;
    }

    async loadPublicInfo(data, accountId) {
        if (!data || data.state !== WebDataState.SUCCESS || !data.data.searchResult) {
            return;
        }
        if (data.data.searchResult.hits) {
            const items = [];
            for (const hit of data.data.searchResult.hits) {
                items.push({
                    id: hit.id,
                    parentItemsIds: this.collectionSummariesToParentItems(hit.parentCollectionSummaries),
                });
            }

            await getIsPublicInfo(items, accountId);
            const isPublicInfo = this.props.isPublicInfo || {};
            this.setState({ isPublicInfo });
        }
    }

    collectionSummariesToParentItems(collectionSummaries) {
        const parentItemsIds = new Set();
        collectionSummaries.forEach(summaries => {
            summaries.forEach(s => {
                parentItemsIds.add(s.id);
            });
        });
        return Array.from(parentItemsIds);
    }


    //* HELPER FUNCTIONS *//

    interpretSearchHit(hit) {
        const { match: { params } } = this.props;
        const searchTerm = params.searchTerm.toLowerCase();
        const isCollection = !!hit.collection;
        const item = isCollection ? hit.collection : hit.binderSummary;

        let title = extractTitle(item);
        let additionalInfo: string;

        // for document - if there is a hit in title - render it, if not - render additional info with hits in chunks
        if (!isCollection) {
            let isHitInTitle = false;
            const foundTitle = hit.fieldHits.filter(({ field }) => (field === "languages.storyTitle"))
            if (foundTitle.length > 0) {
                isHitInTitle = true;
                title = [...foundTitle[0].contexts].sort(byMostMatches)[0];
            }
            if (!isHitInTitle) {
                const searchTerms = searchTerm.replace(SEARCH_QUERY_LANGUAGE_OPTION_REGEX, "").replace(/"/g, "").trim().split(" ");
                const chunkHits = hit.fieldHits.filter(({ field }) => (field === "modules.text.chunked.chunks"));
                additionalInfo = chunkHits[0] ? buildMatchCountString(chunkHits[0].contexts, searchTerms) : undefined;

                const masterLanguage = getBinderMasterLanguage(item);
                const anyMasterLanguageHits = chunkHits.some(hit => hit.languageCode === masterLanguage.iso639_1);
                if (!anyMasterLanguageHits && chunkHits.length > 0) {
                    // Find language with the most matches
                    const languageHits = {};
                    for (const chunkHit of chunkHits) {
                        languageHits[chunkHit.languageCode] = (languageHits[chunkHit.languageCode] || 0) + 1;
                    }
                    const highestLanguageCode = Object.keys(languageHits).reduce((highest, current) => {
                        if (languageHits[highest] > languageHits[current]) {
                            return current;
                        }
                        return highest;
                    });
                    title = extractTitleForLanguage(item, highestLanguageCode);
                }
            }
        } else {
            if (hit.fieldHits != null && hit.fieldHits.length > 0) {
                title = [...hit.fieldHits[0].contexts].sort(byMostMatches)[0];
            }
        }
        return {
            isCollection,
            title,
            additionalInfo,
            thumbnail: item.thumbnail,
            key: item.id,
        };
    }

    //* HELPER RENDERS *//

    renderResults() {
        return !this.state.showInfo ?
            this.renderWebData(this.state.data) :
            <div className="search-info">{this.props.t(TK.DocManagement_SearchQuery)}</div>;

    }

    getResizeBehaviour(resizeBehaviour = "crop") {
        return resizeBehaviour.toLowerCase() === "fit" ? FitBehaviour.FIT : FitBehaviour.CROP;
    }

    getLockedBy(itemId: string) {
        const { currentUser, lockedItems } = this.props;
        const lockedBy = lockedItems.has(itemId) && lockedItems.get(itemId);
        if (!lockedBy) {
            return undefined;
        }
        const itsMe = lockedBy.user.id === currentUser?.user.id;
        return !itsMe && lockedBy.user;
    }

    takeItem(hit) {
        return hit.collection ?
            {
                ...hit.collection,
                kind: "collection",
            } :
            {
                ...hit.binderSummary,
                kind: "document",
            };
    }

    getIsPublicInfo(item) {
        const { isPublicInfo } = this.state;
        return isPublicInfo ? isPublicInfo[item.id] : {};
    }

    renderItem(hit, index: number) {
        const { history } = this.props;
        const { modalPlaceholder, hitsInfo, checklistProgresses } = this.state;
        const { title, additionalInfo, isCollection, key } = this.interpretSearchHit(hit);

        const item = this.takeItem(hit);
        const lockedBy = this.getLockedBy(item.id);
        // in data.parents we store the ancestor data for element with id === key
        // function which is called when open the context menu
        // if it is item with no thumbnail - return ancestors from the data object ( we already fetched it)
        // if not - pass the function which will get the ancestors via API
        const getParentItems = () => buildParentItems(key, this.foundItemsAncestorsPromise);
        const isThisItemDisabledForMe = (hitsInfo && hitsInfo[key]) ? hitsInfo[key].isThisItemDisabledForMe : false;
        const isPublicInfo = this.getIsPublicInfo(item);
        const checklistProgress = item.kind === "document" && checklistProgresses[item.id];

        return (
            <LibraryItem
                key={key}
                htmlTitle={{ __html: title }}
                additionalInfo={additionalInfo}
                thumbnail={item.thumbnail}
                className={isThisItemDisabledForMe ? "library-row-isReadonly" : ""}
                isHidden={item.isHidden}
                isPublicInfo={isPublicInfo}
                type={isCollection ? ItemType.COLLECTION : ItemType.DOCUMENT}
                onClick={buildOnClick(history, key, isCollection, this, index)}
                lockedBy={lockedBy}
                contextMenu={<BreadcrumbsItemContextMenu
                    item={item}
                    getParentItems={getParentItems}
                    isForActive={false}
                    history={history}
                    modalPlaceholder={modalPlaceholder}
                    hideRootCollection={false}
                />}
                views={item.views}
                checklistProgress={checklistProgress}
            />
        );
    }

    async calculateIsReadonly(data, accountId, permissions, activeAccount, accountFeatures) {
        const { ancestors, ancestorsItems } = this.state.foundItemsAncestors;
        if (!this.calculateIsReadonlyInvoked) {
            const hitsInfo = data.searchResult.hits.reduce((acc, hit) => {
                const obj = acc;
                const { key } = this.interpretSearchHit(hit);
                const ancestor = getDirectParentWithPaths(key, ancestors, ancestorsItems, accountId)
                const ancestorsIds = ancestor && ancestor.parentPaths ? ancestor.parentPaths.map(item => item?.id) : [];
                const canEdit = intersection(getItemIdsFromPermissionMap(
                    permissions, [PermissionName.ADMIN, PermissionName.EDIT]), [...ancestorsIds, key]).length >= 1;
                const canView = intersection(getItemIdsFromPermissionMap(
                    permissions, [PermissionName.VIEW]), [...ancestorsIds, key]).length >= 1;
                const isThisItemDisabledForMe = isThisItemHidden(accountFeatures.result, activeAccount.canIEdit, canEdit, canView);

                obj[key] = { isThisItemDisabledForMe, ancestor };
                return obj;
            }, {});
            this.setState({
                hitsInfo
            });
            this.calculateIsReadonlyInvoked = true;
        }
    }

    renderHits(data) {
        const { commonParentItemMap, scopeCollectionId } = this.state;
        const hasData = data?.searchResult?.totalHitCount > 0;
        if (!hasData) {
            return;
        }
        const { searchResult: { hits, totalHitCount, isTruncatedInScope, isTruncatedOutsideScope } } = data;

        /*
            (stale comment)
            You may wonder why the hell this function is so complicated?
            Wonder no more! Here is the answer:
            Some items have their thumbnail set, some inherit it from nearest ancestor (with thumbnail set)
            To get the correct thumbnails in search result we have to download the ancestors data.
            In fact - we have to collect ancestor data for all the items, but those with thumbnails
            need them only in context menu actions.
            We download the ancestor data for items that lack the thumbnail, we get the ancestors only when you click
            context menu for all other ones. Easy peasy!
        */

        let ifInsideCollectionTitleAlreadyRendered = false;
        let ifOutsideCollectionTitleAlreadyRendered = false;

        // count all items in scope collection and subcolections
        const itemsInCollectionCount = Object.keys(commonParentItemMap).reduce((prev, id) => {
            if (id.includes(scopeCollectionId)) {
                return prev + commonParentItemMap[id].length;
            }
            return prev;
        }, 0);

        let hasOutsideResults;
        let hasInsideResults;
        if (scopeCollectionId) {
            hasOutsideResults = Object.keys(commonParentItemMap).some(id => !id.includes(scopeCollectionId));
            hasInsideResults = Object.keys(commonParentItemMap).some(id => id.includes(scopeCollectionId));
        }

        const results = Object.keys(commonParentItemMap).map(id => {
            const isScopeModule = id.includes(scopeCollectionId);

            const collectionTitles = commonParentItemMap[id][0].parentCollectionSummaries.map(
                (collectionSummaries, j) => {
                    const breadcrumbItems = [];
                    const linkParts = ["browse"];
                    for (let i = 0; i < collectionSummaries.length; i++) {
                        linkParts.push(collectionSummaries[i].id);
                        breadcrumbItems.push({
                            name: collectionSummaries[i].title,
                            link: `/${linkParts.join("/")}`,
                            renderAsLast: false,
                        });
                    }
                    return (
                        <Breadcrumbs
                            key={`breadcrumb-${id}-${j}`}
                            keySuffix={`${j}`}
                            items={breadcrumbItems}
                            itemContextMenu={<span />} // it's needed for keeping dots (...) on left for longer breadcrumbs
                        />
                    );
                }
            );

            const moduleItems = commonParentItemMap[id];
            const result = (
                <React.Fragment key={`pcm-${id}`}>
                    {
                        scopeCollectionId ?
                            <>
                                {isScopeModule && !ifInsideCollectionTitleAlreadyRendered ? (<ScopeTitle isTruncated={isTruncatedInScope} hitCount={itemsInCollectionCount} inScope={true} />) : null}
                                {!isScopeModule && !ifOutsideCollectionTitleAlreadyRendered && (<ScopeTitle isTruncated={isTruncatedOutsideScope} hitCount={totalHitCount - itemsInCollectionCount} inScope={false} />)}
                            </> :
                            <>
                                {!ifOutsideCollectionTitleAlreadyRendered ? (<ScopeTitle isTruncated={isTruncatedInScope} hitCount={hits.length} inScope={true} />) : null}
                            </>
                    }
                    <div className="search-results-parentCollectionModule">
                        <div className="search-results-parentCollectionModule-title">
                            {collectionTitles}
                        </div>
                        {moduleItems.map(({ renderItem }) => renderItem)}
                    </div>
                </React.Fragment>
            );
            ifInsideCollectionTitleAlreadyRendered = isScopeModule;
            ifOutsideCollectionTitleAlreadyRendered = !isScopeModule;
            return result;
        });

        const maybeEmptyInScopeBlock = hasOutsideResults && !hasInsideResults ?
            <ScopeTitle isTruncated={isTruncatedInScope} hitCount={0} inScope={true} /> :
            null;
        const maybeEmptyOutScopeBlock = !hasOutsideResults && hasInsideResults ?
            <ScopeTitle isTruncated={isTruncatedOutsideScope} hitCount={0} inScope={false} /> :
            null;

        return (
            <>
                {maybeEmptyInScopeBlock}
                {results}
                {maybeEmptyOutScopeBlock}
            </>
        )
    }

    filterSearchHitsParentCollections(searchHits, accountFeatures) {
        const { permissions } = this.props;
        const hitsWithFilteredParents = [];
        if (!permissions) {
            for (let i = 0; i < searchHits.length; i++) {
                const searchHit = searchHits[i];
                const item = this.takeItem(searchHit);
                const updatedHit = {
                    ...searchHit,
                    [item.kind === "document" ? "binderSummary" : item.kind]: {
                        ...item,
                        parentCollectionSummaries: []
                    },
                }
                hitsWithFilteredParents.push(updatedHit);
            }
            return hitsWithFilteredParents;
        }
        const requiredPermission =
            accountFeatures.result.includes(FEATURE_READONLY_EDITOR) ? PermissionName.VIEW : PermissionName.EDIT;

        const viewableItemIds = getItemIdsFromPermissionMap(permissions, [requiredPermission]);
        for (const searchHit of searchHits) {
            const item = this.takeItem(searchHit);
            const filteredParentCollectionSummaries = [];
            for (const parentCollectionSummaryPath of item.parentCollectionSummaries ?? []) {
                const filteredParentCollectionSummary = [...parentCollectionSummaryPath];
                for (let i = 0; i < parentCollectionSummaryPath.length; i++) {
                    if (viewableItemIds.includes(parentCollectionSummaryPath[i].id)) {
                        filteredParentCollectionSummaries.push(filteredParentCollectionSummary);
                        break;
                    }
                    filteredParentCollectionSummaries.shift();
                }
            }
            const updatedItem = {
                ...item,
                parentCollectionSummaries: filteredParentCollectionSummaries
            };
            const updatedSearchHit = {
                ...searchHit,
                [item.kind === "document" ? "binderSummary" : item.kind]: {
                    ...updatedItem
                }
            };
            hitsWithFilteredParents.push(updatedSearchHit);
        }
        return hitsWithFilteredParents;
    }


    renderSuccess(data) {
        if (data.searchResult) {
            const { searchResult: { totalHitCount } } = data;
            const { t } = this.props;
            return (
                <div className="container search-results">
                    {totalHitCount === 0 && (
                        <div className="container-inner search-results-summary scopeTitle  scopeTitle-zero">
                            <label>{t(TK.DocManagement_SearchResultZeroInfo, { query: this.props.match.params.searchTerm })}</label>
                        </div>
                    )}
                    <div className="container-inner search-results-items">
                        {this.renderHits(data)}
                    </div>
                </div>
            );
        }
    }

    renderFailure(error) {
        if (
            error.errorDetails?.name === "UnsupportedLanguageError" &&
            error.errorDetails?.languageCodes?.length > 0
        ) {
            return (
                <FallbackComponent
                    hideComputerSaysNo={true}
                    exception={
                        this.props.t(
                            TK.Edit_TranslateFailUnsupportedLanguage,
                            { unsupportedLanguage: error.errorDetails.languageCodes[0], count: 1 }
                        )
                    }
                />
            );
        }
        return (
            <FallbackComponent
                exception={this.props.t(TK.DocManagement_SearchResultsFail)}
            />
        );
    }

    render() {
        return (
            <div ref={(modalPlaceholder) => this.modalPlaceholder = modalPlaceholder}>
                {this.renderResults()}
            </div>
        );
    }
}


const container = Container.create(fixES5FluxContainer(SearchResults), { withProps: true });
const containerWithHooks = withHooks(container, () => ({
    lockedItems: useItemLocks(),
    currentUser: useMyDetails(),
    isPublicInfo: useDocumentsPublicInfo(),
    checklistProgresses: useChecklistProgresses(),
    permissions: useMyPermissionMapOrEmpty(),
}));
export default withTranslation()(containerWithHooks);
