import * as Immutable from "immutable";
import * as React from "react";
import {
    ActiveCollectionInfo,
    BinderStoreGetters,
    useBinderStoreActions,
    useBinderStoreLoaded,
    useBinderStoreState
} from "../../stores/zustand/binder-store";
import { IStoryWithTitle, StoryTile } from "../../binders/contract";
import {
    unloadPublication,
    updateClientLanguageSettingsNoCollection
} from "../../binders/binder-loader";
import {
    useCurrentUserId,
    useCurrentUserPreferences,
    useIsLoggedIn
} from "../../stores/hooks/user-hooks";
import { Div100Vh } from "../../utils/div100vh";
import { EmptyAccount } from "./EmptyAccount";
import Loader from "../components/loader";
import ManualToRoutes from "@binders/client/lib/util/readerRoutes";
import ReaderHeader from "../header/header";
import { RouteComponentProps } from "react-router";
import StoryBrowserComponent from "./StoryBrowser";
import { getLanguageLabel } from "../../utils/languages";
import { loadDocsToEdit } from "../../stores/actions/account";
import { navigateToBrowsePath } from "../../navigation";
import { toFullPath } from "../../util";
import { toStoryTile } from "./helpers";
import { useActiveAccountId } from "../../stores/hooks/account-hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./story-browser.styl";

type StoryBrowserProps = {
    router: RouteComponentProps;
}

type StoryBrowserPropsInternal = StoryBrowserProps & {
    accountId: string;
    isLoggedIn: boolean;
    preferredLanguages: string[];
    userId: string;
    items?: Immutable.Map<string, IStoryWithTitle>;
    languagesUsed: string[];
    selectedLanguage?: string;
    unsetActiveCollection: () => void;
    activeCollectionInfo?: ActiveCollectionInfo;
    binderStoreLoaded: () => boolean;
}

interface IStoryBrowserState {
    storyTiles?: StoryTile[];
}

export class StoryBrowser extends React.Component<StoryBrowserPropsInternal, IStoryBrowserState> {

    constructor(props: StoryBrowserPropsInternal) {
        super(props);
        this.onChangeLanguagePreferences = this.onChangeLanguagePreferences.bind(this);
        this.maybeNavigateToSingleCollection = this.maybeNavigateToSingleCollection.bind(this);
        this.isSingleCollectionShown = this.isSingleCollectionShown.bind(this);
        this.state = { storyTiles: undefined };
    }

    componentDidMount(): void {
        unloadPublication();
        this.props.unsetActiveCollection();
        loadDocsToEdit(this.props.accountId);
        const { preferredLanguages } = this.props;

        // calculate languages for browse view if we really will stay here
        // if we navigate to single collection - no need to do it
        if (!this.isSingleCollectionShown()) {
            updateClientLanguageSettingsNoCollection(this.props.selectedLanguage, preferredLanguages);
        }

        const storyTiles = this.props.items ? this.props.items.toArray().map(toStoryTile) : undefined;

        if (storyTiles) {
            this.setState({
                storyTiles: this.props.items.toArray().map(toStoryTile),
            });
            this.maybeNavigateToSingleCollection(storyTiles);
        }

    }

    componentDidUpdate(prevProps: StoryBrowserPropsInternal): void {
        const { items } = this.props;
        const { items: prevItems } = prevProps;
        const stateUpdates: Partial<IStoryBrowserState> = {};

        if (items !== prevItems) {
            const storyTiles = items !== undefined ? items.toArray().map(toStoryTile) : undefined;
            stateUpdates.storyTiles = storyTiles;
            this.maybeNavigateToSingleCollection(storyTiles);
        }

        if (this.needsRedirectToLogin()) {
            window.location.href = `${toFullPath(ManualToRoutes.LOGIN)}${window.location.search}`;
        }

        if (Object.keys(stateUpdates).length) {
            this.setState(stateUpdates as IStoryBrowserState);
        }
    }

    private needsRedirectToLogin() {
        return this.isEmptyAccount() && !this.props.isLoggedIn;
    }

    private isEmptyAccount() {
        return this.props.binderStoreLoaded &&
            this.props.activeCollectionInfo == null &&
            this.state.storyTiles?.length === 0;
    }

    private isSingleCollectionShown(storyTilesParam?: StoryTile[]) {
        const storyTiles = storyTilesParam || this.state.storyTiles;
        if (!storyTiles || storyTiles.length !== 1) {
            return;
        }
        const [{ key: collectionId, kind }] = storyTiles;
        return (kind === "collection" || kind === "collectionsummary") ? collectionId : undefined;
    }

    private maybeNavigateToSingleCollection(storyTiles?: StoryTile[]) {
        const collectionIdToNavigate = this.isSingleCollectionShown(storyTiles);
        if (collectionIdToNavigate) {
            navigateToBrowsePath(this.props.router.history, [collectionIdToNavigate]);
        }
    }


    private async onChangeLanguagePreferences(language) {
        const languageCode = (language && language.value) ? language.value : language;
        const { preferredLanguages } = this.props;
        if (languageCode !== BinderStoreGetters.getSelectedLanguage()) {
            await updateClientLanguageSettingsNoCollection(languageCode, preferredLanguages);
        } else {
            await updateClientLanguageSettingsNoCollection(undefined, preferredLanguages)
        }
    }

    render(): React.ReactNode {
        const {
            storyTiles,
        } = this.state;
        const { accountId, isLoggedIn, userId } = this.props
        const languageSettingsPrepared = this.props.languagesUsed ?
            this.props.languagesUsed.map(languageCode => {
                return {
                    value: languageCode,
                    label: getLanguageLabel(languageCode)
                };
            }) :
            [];

        const loadingView = !storyTiles || !this.props.binderStoreLoaded || this.needsRedirectToLogin() ? <Loader /> : null;
        const emptyView = this.isEmptyAccount() && isLoggedIn ?
            <Div100Vh asMinHeight={false} className="story-browser-layout" >
                <ReaderHeader
                    accountId={accountId}
                    logo={window.bindersBranding.logo}
                    router={this.props.router}
                    userId={userId}
                >
                </ReaderHeader>
                <EmptyAccount />
            </Div100Vh> :
            null;
        return loadingView ?? emptyView ?? (
            <StoryBrowserComponent
                router={this.props.router}
                activeCollectionInfo={this.props.activeCollectionInfo}
                storyTiles={storyTiles}
                languageSettings={languageSettingsPrepared}
                selectedLanguageCode={this.props.selectedLanguage}
                onChangeLanguagePreferences={this.onChangeLanguagePreferences.bind(this)}
                accountId={accountId}
                userId={userId}
            />
        );
    }
}

const StoryBrowserWithHooks = withHooks(StoryBrowser, () => ({
    accountId: useActiveAccountId(),
    isLoggedIn: useIsLoggedIn(),
    userId: useCurrentUserId(),
    preferredLanguages: useCurrentUserPreferences().readerLanguages,
    languagesUsed: useBinderStoreState(state => state.languagesUsed),
    selectedLanguage: useBinderStoreState(state => state.selectedLanguage),
    activeCollectionInfo: useBinderStoreState(state => state.activeCollectionInfo),
    selectedLanguageCode: useBinderStoreState(state => state.selectedLanguage),
    items: useBinderStoreState(state => state.items),
    binderStoreLoaded: useBinderStoreLoaded(),
    unsetActiveCollection: useBinderStoreActions().unsetActiveCollection,
}));
export default StoryBrowserWithHooks;
