import * as React from "react";
import {
    CollectionSearchHitClient,
    IFieldSearchHitsClient,
    PublicationSearchHitClient,
    ReaderItemSearchResultClient,
    StoryTile
} from "../../binders/contract";
import {
    DocumentCollection,
    PublicationSummary,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_CHECKLISTS,
    FEATURE_SEARCH_JUMP_TO_CHUNK
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { browseCollection, navigateToHome, switchToSummary } from "../../navigation";
import { buildMatchCountString, buildSearchTerms } from "@binders/client/lib/util/elastic";
import {
    clearSearchResults,
    loadAndActivateSearchResults,
    loadChecklistsProgress
} from "../../binders/binder-loader";
import { compose, dropWhile, filter, map } from "ramda";
import {
    extractItemsFromResourceGroups,
    getAllReadableItemsPermissions
} from "../../api/authorizationService";
import Breadcrumbs from "@binders/ui-kit/lib/elements/breadcrumbs";
import { IChecklistProgress } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Loader from "../components/loader";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import ReaderHeader from "../header/header";
import ScopeTitle from "@binders/ui-kit/lib/compounds/scopedSearch/ScopeTitle";
import SmallestFontSizeWrapper from "../components/SmallestFontSizeWrapper";
import StoryItem from "../browsing/story-item";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { createCommonHitMap } from "@binders/client/lib/ancestors";
import cx from "classnames";
import { parse } from "qs";
import { toFullPath } from "../../util";
import { useActiveAccountId } from "../../stores/hooks/account-hooks";
import { useBinderStoreState } from "../../stores/zustand/binder-store";
import { useChecklistStoreState } from "../../stores/zustand/checklist-store";
import { useCurrentUserId } from "../../stores/hooks/user-hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./search.styl";

interface ISearchResultProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    preferredLanguages: string[];
    features: string[];
    // eslint-disable-next-line @typescript-eslint/ban-types
    t: (key: string, options?: {}) => string;
}

type SearchResultPropsInternal = ISearchResultProps & {
    accountId: string;
    checklistsProgressByBinderId: Map<string, IChecklistProgress>;
    userId: string;
    searchResults?: ReaderItemSearchResultClient;
}

interface ISearchResultState {
    readableItemIds: string[];
    scopeCollectionId?: string;
}

function getPublicationHitTitleHtml(fieldHits: IFieldSearchHitsClient[], summary: PublicationSummary) {
    const titleHits = fieldHits.filter(hit => hit.field === "language.storyTitle");
    return (titleHits.length > 0) ?
        titleHits[0].contexts[0].html :
        summary.language.storyTitle;
}

function getCollectionHitTitleHtml(
    collection: DocumentCollection,
    searchTerms: string[],
    preferredLanguages: string[]
): { title: string; languageCode: string } {
    let titleInfo = collection.titles[0];
    if (preferredLanguages && preferredLanguages.length > 0) {
        for (const lang of preferredLanguages) {
            const candidateTitleInfo = collection.titles.find(t => t.languageCode === lang);
            if (candidateTitleInfo) {
                titleInfo = candidateTitleInfo;
                break;
            }
        }
    }
    const titleHtml = titleInfo.title
        .split(" ")
        .map((word) => {
            if (searchTerms.indexOf(word.toLowerCase()) > -1) {
                return `<span class='search-hit'>${word}</span>`;
            }
            return word;
        })
        .join(" ");
    return {
        title: titleHtml,
        languageCode: titleInfo.languageCode
    };
}

function storyTileFromCollection(collection: DocumentCollection, searchTerms: string[], preferredLanguages: string[]): StoryTile {
    const { title, languageCode } = getCollectionHitTitleHtml(collection, searchTerms, preferredLanguages);
    return {
        thumbnail: collection.thumbnail as Thumbnail,
        title,
        kind: "collection",
        key: `storyTile-col-${collection.id}`,
        original: undefined,
        icon: "far fa-folder-open",
        languageCode
    };
}

function storyTileFromSummary(summary: PublicationSummary, fieldHits: IFieldSearchHitsClient[]): StoryTile {
    const title = getPublicationHitTitleHtml(fieldHits, summary);
    return {
        thumbnail: summary.thumbnail as Thumbnail,
        title,
        kind: "document",
        key: `storyTile-pub-${summary.id}`,
        original: undefined,
        icon: undefined,
        languageCode: summary.language.iso639_1
    };
}

function binderIdsFromResults(results): string[] {
    if (!results || !results.hits) return [];
    return results.hits.reduce((out, result) => {
        return !result || !result.publicationSummary ?
            out :
            [
                ...out,
                result.publicationSummary.binderId,
            ]
    }, []);
}

class SearchResult extends React.Component<SearchResultPropsInternal, ISearchResultState> {

    constructor(props: SearchResultPropsInternal) {
        super(props);
        this.state = {
            readableItemIds: [],
            scopeCollectionId: this.props.router?.match?.params?.scopeCollectionId,
        };
    }

    private getQueryFromUrl() {
        const { router } = this.props;
        const { location } = router;
        const { q: query } = parse(location.search.substr(1));
        return decodeURIComponent(query);
    }

    async componentDidMount() {
        const { accountId, preferredLanguages, router } = this.props;
        const { history, match: { params: { scopeCollectionId } } } = router;
        const query = this.getQueryFromUrl();
        if (!query) {
            navigateToHome(history);
            return;
        }
        const readableItemsPermissions = await getAllReadableItemsPermissions([accountId], true);
        const readableItemIds = extractItemsFromResourceGroups(readableItemsPermissions);
        this.setState({
            readableItemIds,
            scopeCollectionId,
        });
        loadAndActivateSearchResults(query, preferredLanguages, scopeCollectionId);
    }

    componentDidUpdate(prevProps, _prevState) {
        const { router: { match: { params: { scopeCollectionId: prevScopeCollectionId } } } } = prevProps;
        const { router: { match: { params: { scopeCollectionId } } } } = this.props;
        const query = this.getQueryFromUrl();
        const { searchResults: results } = this.props;
        const { searchResults: prevResults } = prevProps;

        let stateUpdates = {};

        const scopeCollectionIdChanged = (scopeCollectionId !== prevScopeCollectionId);
        if (results && results.query && query !== results.query) {
            clearSearchResults();
        }

        if (results && !prevResults) {
            const binderIds = binderIdsFromResults(results);
            loadChecklistsProgress(binderIds);
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
        clearSearchResults();
    }

    takeItem(hit) {
        return hit.publicationSummary || hit.collection;
    }

    calculateProgress(binderId: string) {
        const { searchResults: results } = this.props;
        const { checklistsProgressByBinderId } = this.props;
        const checklistProgresses = binderIdsFromResults(results)
            .filter(binderId => checklistsProgressByBinderId.has(binderId))
            .map(binderId => checklistsProgressByBinderId.get(binderId));

        const progress = binderId && (checklistProgresses || []).find(p => p.binderId === binderId);

        return {
            progress: !progress ? undefined : (progress.performed / progress.total),
            lastUpdated: progress && progress.lastUpdated
        }
    }

    private filterReadableBreadcrumbs(parentCollections) {
        const result = [];
        const { readableItemIds } = this.state;
        if (!readableItemIds) {
            return result;
        }

        const isNotReadableItem = ({ id }) => !readableItemIds.includes(id);
        const dropUnaccessible = compose(filter<{ id: string }[]>((resultArray) => resultArray.length > 0), map(dropWhile(isNotReadableItem)));

        return dropUnaccessible(parentCollections);
    }

    buildBreadcrubmLink(collections, index) {
        const parts = [ManualToRoutes.BROWSE];
        for (let i = 0; i <= index; i++) {
            parts.push(collections[i].id);
        }
        return toFullPath(parts.join("/"));
    }

    renderResults() {
        const { searchResults: results } = this.props;
        const { scopeCollectionId } = this.state;
        if (results?.totalHitCount === 0) {
            return (<div className="scopeTitle  scopeTitle-zero">
                {this.props.t(TranslationKeys.DocManagement_SearchResultZeroInfo, { query: results.query })}
            </div>)
        }
        const commonParentHitsMap = createCommonHitMap(
            results.hits,
            this.takeItem.bind(this),
            this.renderHit.bind(this)
        );
        let ifInsideCollectionTitleAlreadyRendered = false;
        let ifOutsideCollectionTitleAlreadyRendered = false;

        // count all items in scope collection and subcolections
        const itemsInCollectionCount = Object.keys(commonParentHitsMap).reduce((prev, id) => {
            if (id.includes(scopeCollectionId)) {
                return prev + commonParentHitsMap[id].length;
            }
            return prev;
        }, 0);

        let hasOutsideResults;
        let hasInsideResults;
        if (scopeCollectionId) {
            hasOutsideResults = Object.keys(commonParentHitsMap).some(id => !id.includes(scopeCollectionId));
            hasInsideResults = Object.keys(commonParentHitsMap).some(id => id.includes(scopeCollectionId));
        }

        const hitResults = Object.keys(commonParentHitsMap).map((id, i) => {
            const isScopeModule = id.includes(scopeCollectionId);
            if (!accountName) {
                const parentCollections = commonParentHitsMap[id][0].parentCollectionSummaries;
                accountName = parentCollections.length && parentCollections[0].length ? parentCollections[0][0].title : "";
            }
            const readableParentCollections = this.filterReadableBreadcrumbs(commonParentHitsMap[id][0].parentCollectionSummaries);
            if (readableParentCollections.length === 0) {
                readableParentCollections.push([])
            }
            const collectionTitles = readableParentCollections.map((collections, j) => {
                let items = [];
                if (collections.length === 0) {
                    items = [{ name: accountName, renderAsLast: false }];
                } else {
                    items = collections.map((col, j) => ({
                        name: col.title,
                        link: this.buildBreadcrubmLink(collections, j),
                        renderAsLast: false,
                    }))
                    if (items[0].name !== accountName) {
                        items = [
                            { name: accountName, renderAsLast: false },
                            ...items
                        ];
                    }
                }
                return <Breadcrumbs
                    key={`breadcrumb-${id}-${i}-${j}-`}
                    items={items}
                    keySuffix={`${i}-${j}`}
                    itemContextMenu={<span />} // it's needed for keeping dots (...) on left for longer breadcrumbs
                />
            });

            const result = (
                <React.Fragment key={id}>
                    {
                        scopeCollectionId ?
                            <>
                                {isScopeModule && !ifInsideCollectionTitleAlreadyRendered ? (<ScopeTitle isTruncated={results.isTruncatedInScope} hitCount={itemsInCollectionCount} inScope={true} />) : null}
                                {!isScopeModule && !ifOutsideCollectionTitleAlreadyRendered && (<ScopeTitle isTruncated={results.isTruncatedOutsideScope} hitCount={results.totalHitCount - itemsInCollectionCount} inScope={false} />)}
                            </> :
                            null
                    }

                    <div className="search-result-parentCollectionModule">
                        <div className="search-result-parentCollectionModule-title">
                            {collectionTitles}
                        </div>
                        {commonParentHitsMap[id].map(({ renderItem }) => renderItem)}
                    </div>
                </React.Fragment>
            );
            ifInsideCollectionTitleAlreadyRendered = isScopeModule;
            ifOutsideCollectionTitleAlreadyRendered = !isScopeModule;
            return result;
        });

        let accountName;

        const maybeEmptyInScopeBlock = hasOutsideResults && !hasInsideResults ?
            <ScopeTitle isTruncated={results.isTruncatedInScope} hitCount={0} inScope={true} /> :
            null;
        const maybeEmptyOutScopeBlock = !hasOutsideResults && hasInsideResults ?
            <ScopeTitle isTruncated={results.isTruncatedOutsideScope} hitCount={0} inScope={false} /> :
            null;

        return (
            <div className={cx("story-list", "list", "full-render")}>
                <SmallestFontSizeWrapper totalItems={results.hits.length}>
                    {maybeEmptyInScopeBlock}
                    {hitResults}
                    {maybeEmptyOutScopeBlock}
                </SmallestFontSizeWrapper>
            </div>
        );
    }

    renderTextHits(fieldHits: IFieldSearchHitsClient[]) {
        const textualHits = fieldHits.filter(hit => hit.field === "modules.text.chunked.chunks");
        return textualHits.map((hit, index) => {
            const { contexts } = hit;
            const shownContexts = contexts.slice(0, 2);
            const places = contexts.length;
            const contextElements = shownContexts.slice(0, 2).map((context, cIndex) => {
                const content = { __html: context.html };
                return <p key={cIndex} dangerouslySetInnerHTML={content} />;
            });
            const additionalInfo = buildMatchCountString(contexts.map(context => context.text), buildSearchTerms(this.props.searchResults.query));
            return (
                <div className="search-result-text-hits" key={index}>
                    {contextElements}
                    {additionalInfo && places > 2 && (
                        <label className="search-result-info-mentions">
                            {additionalInfo || ""}
                        </label>
                    )}
                </div>
            );
        });
    }

    renderHit(searchHit: PublicationSearchHitClient | CollectionSearchHitClient, index: number) {
        return searchHit["collection"] ?
            this.renderCollectionHit(searchHit as CollectionSearchHitClient, index) :
            this.renderPublicationHit(searchHit as PublicationSearchHitClient, index);
    }

    renderCollectionHit(searchHit: CollectionSearchHitClient, index: number) {
        const { preferredLanguages, router: { history } } = this.props;
        const { searchResults: results } = this.props;
        const { collection } = searchHit;
        const browse = () => {
            captureFrontendEvent(ReaderEvent.SearchResultClicked, { resultIndex: index, type: "collection" });
            browseCollection(history, collection.id);
        }
        const searchTerms = buildSearchTerms(results.query.toLowerCase());
        return (
            <StoryItem
                storyTile={storyTileFromCollection(collection, searchTerms, preferredLanguages)}
                onClickStory={browse}
                key={`${index}${collection.id}`}
                searchTitle={this.getCollectionTitleFromSearchHit(searchHit)}
                showProgress={this.props.features.includes(FEATURE_CHECKLISTS)}
            />
        );
    }

    private getCollectionTitleFromSearchHit(
        searchHit: CollectionSearchHitClient
    ): { title: string, languageCode: string } {
        if (searchHit.fieldHits.length === 0) return;
        const hit = searchHit.fieldHits.find(hit => hit.field === "titles.title");
        if (hit == null || hit.contexts.length === 0) return;
        if (hit.languageCode == null) return;
        const title = hit.contexts[0].html ?? hit.contexts[0].text;
        return {
            title,
            languageCode: hit.languageCode,
        }
    }

    renderPublicationHit(searchHit: PublicationSearchHitClient, index: number) {
        const { history } = this.props.router;
        const { features } = this.props;
        const { fieldHits, publicationSummary: summary } = searchHit;

        let jumpToText = undefined;
        if (features.includes(FEATURE_SEARCH_JUMP_TO_CHUNK) && fieldHits.length > 0) {
            const textualHits = fieldHits.filter(hit => hit.field === "modules.text.chunked.chunks");
            if (textualHits[0]) {
                jumpToText = textualHits[0].contexts[0].text;
            }
        }
        const jumpToReader = () => {
            captureFrontendEvent(ReaderEvent.SearchResultClicked, { resultIndex: index, type: "publication" });
            switchToSummary(history, summary.binderId, summary.language.iso639_1, jumpToText)
        };
        const storyTile = storyTileFromSummary(summary, fieldHits);

        return (
            <StoryItem
                storyTile={storyTile}
                onClickStory={jumpToReader}
                key={`${index}${summary.id}`}
                showProgress={features.includes(FEATURE_CHECKLISTS)}
                checklistProgress={this.calculateProgress.bind(this)(summary.binderId)}
            >
                {this.renderTextHits(fieldHits)}
            </StoryItem>
        );
    }

    renderLoading() {
        return <Loader text={this.props.t(TranslationKeys.DocManagement_LoadingSearchResults)} />;
    }

    render() {
        const { searchResults: results } = this.props;
        const { accountId, userId } = this.props;
        return (
            <div className="search-result-layout">
                <ReaderHeader
                    router={this.props.router}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    logo={(window as any).bindersBranding.logo}
                    accountId={accountId}
                    userId={userId}
                />
                {(results && results.query) ? this.renderResults() : this.renderLoading()}
            </div>
        );
    }
}

const SearchResultWithHooks = withHooks(SearchResult, () => ({
    accountId: useActiveAccountId(),
    checklistsProgressByBinderId: useChecklistStoreState(state => state.checklistsProgressByBinderId),
    userId: useCurrentUserId(),
    searchResults: useBinderStoreState(state => state.searchResults),
}));
export default withTranslation()(SearchResultWithHooks);