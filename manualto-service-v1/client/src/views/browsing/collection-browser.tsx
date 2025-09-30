import * as React from "react";
import {
    AccountSortMethod,
    FEATURE_AUTOMATED_ITEM_SORTING,
    FEATURE_BROWSER_TAB_TITLE,
    FEATURE_CHECKLISTS,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    ActiveCollectionInfo,
    useActiveCollectionItems,
    useBinderStoreState
} from "../../stores/zustand/binder-store";
import {
    Binder,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IStoryWithTitle, StoryTile } from "../../binders/contract";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    dispatchLoadingItem,
    loadAndActivateCollection,
    loadChecklistsProgress,
    loadParentPathContext,
    unloadPublication,
    updateClientLanguageSettings
} from "../../binders/binder-loader";
import { loadAccountSettings, loadDocsToEdit } from "../../stores/actions/account";
import {
    useActiveAccountFeatures,
    useActiveAccountId,
    useActiveAccountSettings
} from "../../stores/hooks/account-hooks";
import { useCurrentUserId, useCurrentUserPreferences } from "../../stores/hooks/user-hooks";
import {
    CollectionBrowserTabInfo
} from "./collection-browser-tab-info/collection-browser-tab-info";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { IChecklistProgress } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Loader from "../components/loader";
import { PermissionMap } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { RouteComponentProps } from "react-router";
import StoryBrowser from "./StoryBrowser";
import { UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import eventQueue from "@binders/client/lib/react/event/EventQueue";
import { getLanguageLabel } from "../../utils/languages";
import { sortStoryTiles } from "@binders/client/lib/util/sorting";
import { toStoryTile } from "./helpers";
import tokenStore from "@binders/client/lib/clients/tokenstore";
import { uniq } from "ramda";
import { useBrowsePath } from "../../stores/hooks/binder-hooks";
import { useChecklistStoreState } from "../../stores/zustand/checklist-store";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";

type CollectionBrowserProps = {
    router: RouteComponentProps;
    collectionId?: string;
    semanticLinkLanguageCode?: string;
    accountIds?: string[];
}

type CollectionBrowserPropsInternal = CollectionBrowserProps & {
    accountId: string;
    accountSettings: IAccountSettings;
    checklistsProgressByBinderId: Map<string, IChecklistProgress>;
    features: string[];
    userId: string;
    userPreferences: UserPreferences;
    activeCollectionInfo?: ActiveCollectionInfo;
    activeCollectionItems?: IStoryWithTitle[];
    languagesUsed: string[];
    loadingItemIds: string[];
    readableItems?: string[];
    readableItemsPermissions?: PermissionMap[];
    selectedLanguage?: string;
    browsePath?: Array<Binder | DocumentCollection | string>;
}

interface ICollectionBrowserState {
    collectionId?: string;
    languages?: string[];
    storyTiles: StoryTile[];
}

export class CollectionBrowser extends React.Component<CollectionBrowserPropsInternal, ICollectionBrowserState> {

    constructor(props: CollectionBrowserPropsInternal) {
        super(props);
        this.onChangeLanguagePreferences = this.onChangeLanguagePreferences.bind(this);
        
        const { router, collectionId: collectionIdFromProps } = props;
        const collectionId = collectionIdFromProps || router?.match?.params?.["collectionId"];

        this.state = {
            collectionId,
            storyTiles: (props.activeCollectionItems ?? []).map(toStoryTile),
        };
    }

    async componentDidMount() {
        unloadPublication();
        const { router, accountId, accountIds, collectionId: propsCollectionId, semanticLinkLanguageCode } = this.props;
        const routerParamsCollectionId = router?.match?.params?.["collectionId"]
        const collectionId = routerParamsCollectionId || propsCollectionId;
        if (accountId) {
            this.logCollectionOpened(collectionId);
            loadDocsToEdit(accountId);
        }

        const languages = uniq([
            ...(this.props.selectedLanguage ? [this.props.selectedLanguage] : []),
            ...(semanticLinkLanguageCode ? [semanticLinkLanguageCode] : []),
            ...(this.props.userPreferences?.readerLanguages ?? []),
        ]);

        dispatchLoadingItem(collectionId);
        await loadAndActivateCollection(collectionId, languages);
        await loadParentPathContext(accountIds, collectionId, undefined, { skipReaderFeedbackConfig: true });
        await loadAccountSettings(accountId, tokenStore.isPublic());
        this.updateLanguagePreference();

        const stateUpdates: Partial<ICollectionBrowserState> = {};
        if (this.props.activeCollectionItems) {
            const items = this.props.activeCollectionItems;
            stateUpdates.storyTiles = (items ?? []).map(toStoryTile);
        }

        this.setState({
            ...stateUpdates,
            languages,
        } as ICollectionBrowserState);

        if (!tokenStore.isPublic()) {
            this.loadChecklistsProgress();
        }
    }

    async componentDidUpdate(prevProps: CollectionBrowserPropsInternal, _prevState: ICollectionBrowserState) {
        const receivedAccountId = !prevProps.accountId && this.props.accountId;
        
        const stateUpdates: Partial<ICollectionBrowserState> = {};
        
        if (this.props.activeCollectionItems !== prevProps.activeCollectionItems) {
            const items = this.props.activeCollectionItems;
            stateUpdates.storyTiles = (items ?? []).map(toStoryTile);
        }

        if (receivedAccountId) {
            const { router, collectionId: propsCollectionId } = this.props;
            const routerParamsCollectionId = router?.match?.params?.["collectionId"]
            const collectionId = routerParamsCollectionId || propsCollectionId;
            this.logCollectionOpened(collectionId);
        }
        if (Object.keys(stateUpdates).length) {
            this.setState(stateUpdates as ICollectionBrowserState);
        }
    }

    updateLanguagePreference() {
        const { router, semanticLinkLanguageCode, userPreferences, languagesUsed } = this.props;
        const { collectionId } = this.state;
        const query = router.location.search;

        if (query && query.indexOf("lang") > -1) {
            const langMatch = query.match(/lang=([\w|-]*)(&|$)/);
            const lang = langMatch && langMatch[1];
            if (languagesUsed.includes(lang)) {
                updateClientLanguageSettings(
                    collectionId,
                    lang,
                    (userPreferences || {}).readerLanguages,
                );
                return;
            }
        }
        if (semanticLinkLanguageCode) {
            updateClientLanguageSettings(
                collectionId,
                semanticLinkLanguageCode,
                (userPreferences || {}).readerLanguages,
            );
        }
    }

    loadChecklistsProgress() {
        const { activeCollectionItems: items } = this.props;
        const binders = items.filter(item => item.kind === "summary");
        const binderIds = binders.map(item => item.key);
        loadChecklistsProgress(binderIds);
    }

    logCollectionOpened(collectionId: string) {
        const { accountId, userId } = this.props;
        if (collectionId) {
            eventQueue.log(
                EventType.COLLECTION_OPENED,
                accountId,
                { collectionId },
                false,
                userId
            );
        }
        captureFrontendEvent(ReaderEvent.CollectionOpened, { collectionId });
    }

    async onChangeLanguagePreferences(language) {
        const preferredLanguages = this.props.userPreferences?.readerLanguages ?? [];
        const languageCode = (language && language.value) ? language.value : language;
        if (languageCode !== this.props.selectedLanguage) {
            await updateClientLanguageSettings(this.state.collectionId, languageCode, preferredLanguages);
        } else {
            await updateClientLanguageSettings(this.state.collectionId, undefined, preferredLanguages);
        }
    }

    renderStoryBrowser() {
        const {
            storyTiles: unorderedStoryTiles,
        } = this.state;

        const { 
            accountId, 
            accountSettings, 
            checklistsProgressByBinderId, 
            features, 
            userId, 
            activeCollectionInfo,
            activeCollectionItems: items,
            languagesUsed,
            loadingItemIds,
            readableItems,
            selectedLanguage
        } = this.props;

        const binderIds = items && items.filter(item => item.kind === "summary").map(item => item.key);
        const checklistsProgress = binderIds && binderIds
            .filter(binderId => checklistsProgressByBinderId.has(binderId))
            .map(binderId => checklistsProgressByBinderId.get(binderId));

        const sortMethod = accountSettings?.sorting?.sortMethod ?? "default" as AccountSortMethod;
        const shouldSortStoryTiles = features?.includes(FEATURE_AUTOMATED_ITEM_SORTING) && sortMethod !== AccountSortMethod.None;
        const storyTiles = shouldSortStoryTiles ? sortStoryTiles<StoryTile>(unorderedStoryTiles, sortMethod) : unorderedStoryTiles;

        const languageCodes = languagesUsed || [];
        const languageSettingsPrepared = languageCodes.map(languageCode => (
            { value: languageCode, label: getLanguageLabel(languageCode) }
        ));

        if (loadingItemIds.length) {
            return <Loader />;
        }

        return (
            <StoryBrowser
                accountId={accountId}
                activeCollectionInfo={activeCollectionInfo}
                browsePath={this.props.browsePath}
                checklistsProgress={checklistsProgress}
                languageSettings={languageSettingsPrepared}
                languages={this.state.languages}
                onChangeLanguagePreferences={this.onChangeLanguagePreferences.bind(this)}
                readableItems={readableItems}
                router={this.props.router}
                selectedLanguageCode={selectedLanguage}
                showProgress={features && features.includes(FEATURE_CHECKLISTS)}
                showTabInfo={features && features.includes(FEATURE_BROWSER_TAB_TITLE)}
                storyTiles={storyTiles}
                userId={userId}
            />
        );
    }

    render() {
        return (
            <CollectionBrowserTabInfo>
                {this.renderStoryBrowser()}
            </CollectionBrowserTabInfo>
        )
    }
}

const CollectionBrowserWithHooks = withHooks(CollectionBrowser, () => ({
    accountId: useActiveAccountId(),
    accountSettings: useActiveAccountSettings(),
    checklistsProgressByBinderId: useChecklistStoreState(state => state.checklistsProgressByBinderId),
    features: useActiveAccountFeatures(),
    userId: useCurrentUserId(),
    userPreferences: useCurrentUserPreferences(),
    activeCollectionInfo: useBinderStoreState(state => state.activeCollectionInfo),
    activeCollectionItems: useActiveCollectionItems(),
    languagesUsed: useBinderStoreState(state => state.languagesUsed),
    loadingItemIds: useBinderStoreState(state => state.loadingItemIds),
    readableItems: useBinderStoreState(state => state.readableItems),
    readableItemsPermissions: useBinderStoreState(state => state.readableItemsPermissions),
    selectedLanguage: useBinderStoreState(state => state.selectedLanguage),
    browsePath: useBrowsePath(),
}));

export default CollectionBrowserWithHooks;