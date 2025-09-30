import * as React from "react";
import {
    ApprovedStatus,
    BindersModuleMeta,
    DocumentCollection,
    IChunkApproval,
    Publication,
    PublicationFindResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Binder, { curriedMultiUpdate } from "@binders/client/lib/binders/custom/class";
import {
    BinderMediaStoreActions,
    useBinderPreviewVisuals,
    useBinderVisuals,
    useDraggingInfo
} from "../../media/binder-media-store";
import { DragStart, DropResult } from "react-beautiful-dnd";
import {
    FEATURE_APPROVAL_FLOW,
    FEATURE_BROWSER_LOGO_FAVICON,
    FEATURE_BROWSER_TAB_TITLE,
    FEATURE_CHECKLISTS,
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_QR_CODE_LOGO,
    FEATURE_READER_COMMENTING,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FIFTEEN_MINUTES, FIVE_MINUTES, ONE_MINUTE, } from "@binders/client/lib/util/time";
import { History, Location } from "history";
import {
    IBinderUpdate,
    IUpdateBinderOptions,
    relabelBinderLanguageUpdate
} from "./helpers/binderUpdates";
import { IWebData, WebData, WebDataState } from "@binders/client/lib/webdata";
import {
    ItemLock,
    ItemRelease,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import NavigationDrawer, { NavigationDrawerPaneItem } from "./components/NavigationDrawer";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import { User, UserDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import { addTranslation, replaceVisualInComposer } from "./helpers/binderUpdates";
import { areLockedItemsEqual, useItemLocks } from "../../editlocking/store";
import {
    fetchChecklistConfigs,
    fetchChunkApprovals,
    reloadAfterLanguageRelabel
} from "../actions";
import { findSemanticLinks, loadBinder, loadPublications } from "../actions/loading";
import { handleDrag, handleDrop } from "./helpers/dragdrop";
import { invalidateCommentThreads, useCommentThreads } from "../hooks";
import { useAccountUsersWD, useMyDetails } from "../../users/hooks";
import {
    useRibbonsBottomHeight,
    useRibbonsTopHeight
} from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import { APIDispatchEvent } from "../../notification/api";
import AccountStore from "../../accounts/store";
import { BinderDiffProvider } from "../../content/BinderDiffProvider";
import BinderStore from "../store";
import { BinderUpdateProvider } from "../../content/BinderUpdateProvider";
import Composer from "./composer";
import ComposerDragDropContext from "./dragDropContext";
import { ComposerSession } from "./contract";
import { FlashMessages } from "../../logging/FlashMessages";
import { ILockInfo } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { IPermissionFlag } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import InactivityModal from "./components/InactivityModal";
import { LDFlags } from "@binders/client/lib/launchdarkly";
import Layout from "../../shared/Layout/Layout";
import { PendingComposer } from "./components/PendingComposer";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TabInfo } from "@binders/ui-kit/lib/elements/tabinfo/TabInfo";
import UUID from "@binders/client/lib/util/uuid";
import { UiErrorCode } from "@binders/client/lib/errors";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { activateAccountId } from "../../accounts/actions";
import { addLanguageUserAction } from "../../analytics/actions";
import { all } from "ramda";
import { browseInfoFromRouteParams } from "../../browsing/MyLibrary/routes";
import cx from "classnames";
import debounce from "lodash.debounce";
import { differenceInMilliseconds } from "date-fns";
import { getParentLocation } from "../../browsing/tsHelpers";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { getWindowId } from "../../notification/windowId";
import { handleResetApproval } from "./helpers/approval";
import { handleVisualError } from "@binders/client/lib/clients/imageservice/v1/errorHandlers";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { isMobileViewOnOpenRightPane } from "../../shared/helper";
import { match } from "react-router-dom";
import { maybeLogEditSession } from "./helpers/tracking";
import { toTitlePath } from "../../browsing/helper";
import { useBrowsePathsWebData } from "../../browsing/hooks";
import { useComposerContext } from "./contexts/composerContext";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useLaunchDarklyFlagValue } from "@binders/ui-kit/lib/thirdparty/launchdarkly/hooks";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import { useRedirectReadonlyUserBack } from "./hooks/useRedirectReadonlyUserBack";
import {
    useSelectedChunkDetails
} from "./components/BinderLanguage/hooks/useSelectedChunkDetails";
import useStateBinder from "./hooks/useStateBinder";
import useWebData from "../../shared/hooks/useWebData";
import "./composer.styl";

const { useCallback, useEffect, useMemo, useState, useRef } = React;

interface MatchParams {
    binderId: string;
    collectionId?: string;
}

interface IComposerContainerProps {
    history: History;
    location: Location;
    match: match<MatchParams>;
    useLogo: boolean;
    permissionFlags: IPermissionFlag[];
}

async function loadData(binderId: string, t: TFunction, shouldUseNewTextEditor: boolean) {
    const accountFeatures = AccountStore.getAccountFeatures().data;
    const [featuresApprovaFlow, featuresChecklists, featuresCommenting] = [
        accountFeatures.includes(FEATURE_APPROVAL_FLOW),
        accountFeatures.includes(FEATURE_CHECKLISTS),
        accountFeatures.includes(FEATURE_COMMENTING_IN_EDITOR) || accountFeatures.includes(FEATURE_READER_COMMENTING),
    ];
    try {
        const binder = await loadBinder(binderId, shouldUseNewTextEditor);
        activateAccountId(binder.getAccountId());
        findSemanticLinks(binderId);
        loadPublications(binderId);
        if (featuresCommenting) {
            invalidateCommentThreads(binderId);
        }
        if (featuresApprovaFlow) {
            fetchChunkApprovals(binderId);
        }
        if (featuresChecklists) {
            fetchChecklistConfigs(binderId);
        }
        return binder;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        FlashMessages.error(t(TK.Edit_DocLoadFail));
        return null;
    }
}

const lockItem = (myDetails: UserDetails, itemId: string, accountId: string): void => {
    if (!myDetails) return;
    const user = myDetails.user;
    const body: ItemLock = {
        itemId,
        user: {
            id: user.id,
            login: user.login,
            displayName: user.displayName
        },
        windowId: getWindowId()
    };
    APIDispatchEvent(
        {
            type: RoutingKeyType.ACCOUNT,
            value: accountId
        },
        ServiceNotificationType.ITEM_LOCKED,
        body,
    );
};

interface RemoteData {
    storeBinder: Binder;
    semanticLinks: ISemanticLink[];
    publications: PublicationFindResult[];
    accountSettings: IAccountSettings;
    domains: string[];
    accountFeatures: string[];
}

const ComposerContainer = (props: IComposerContainerProps): React.ReactNode => {
    const {
        history,
        match: {
            params: { binderId, collectionId, ...restParams }
        },
    } = props;
    const {
        focusedVisualId,
        bumpChunkImagesBumpable,
        navigationDrawerItem
    } = useComposerContext();
    const isRightPaneOpen = navigationDrawerItem != null && navigationDrawerItem != NavigationDrawerPaneItem.AddLanguagePane;
    const disallowReleaseLocking = useRef(false);
    const lockBinderIntervalID = useRef(null);
    const lastActivityMoment = useRef(new Date());
    const modalPlaceholder = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const [isMobile, setIsMobile] = useState(false);
    const inactivityIntervalId = useRef(null);
    const binderWasReleased = useRef(false);
    const [mobileViewOnOpenRightPane, setMobielViewOnOpenRightPane] = useState(false);
    /* eslint-disable no-undef,no-mixed-operators */
    const [lockedByInfo, setLockedByInfo] = useState<ILockInfo>(undefined);
    const [editLockingHandled, setEditLockingHandled] = useState(false);
    const [inactivityDetected, setInactivityDetected] = useState<boolean>(false);
    const [primaryLanguageCode, setPrimaryLanguageCode] = useState<string>(undefined);
    const [secondaryLanguageCode, setSecondaryLanguageCode] = useState<string>(undefined);
    const [imageModuleKey, setImageModuleKey] = useState<string>(undefined);
    const [selectedChunkDetails, setSelectedChunkDetails] = useSelectedChunkDetails();
    const myDetails = useMyDetails();
    const { stateBinder, setStateBinder } = useStateBinder();
    const shouldUseNewTextEditor = useLaunchDarklyFlagValue<boolean>(LDFlags.USE_TIP_TAP);

    const checkIfMobile = useCallback(() => {
        const mobileViewOnOpenRightPaneUpdated = isMobileViewOnOpenRightPane();
        setIsMobile(isMobileView());
        setMobielViewOnOpenRightPane(mobileViewOnOpenRightPaneUpdated);
    }, []);

    const previousBinderId = usePrevious(binderId);
    const incomingBinderId = !previousBinderId && !!binderId;

    useEffect(() => {
        if (incomingBinderId) {
            loadData(binderId, t, shouldUseNewTextEditor);
        }
    }, [incomingBinderId, binderId, t, shouldUseNewTextEditor]);

    useEffect(() => {
        if (previousBinderId != null && previousBinderId !== binderId) {
            loadData(binderId, t, shouldUseNewTextEditor)
                .then(binder => setStateBinder(() => binder, undefined, undefined, true));
        }
    }, [binderId, previousBinderId, t, setStateBinder, shouldUseNewTextEditor]);

    const renderFailure = (error: Error) => {
        const ErrorComposer = () => (<label>{`error ${(error && error.message)}`}</label>);
        return <ErrorComposer />;
    }

    const lockedItems = useItemLocks();
    const storeBinder: IWebData<Binder> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getActiveBinder());
    const semanticLinks: IWebData<ISemanticLink[]> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getSemanticLinks());
    const publications: IWebData<PublicationFindResult[]> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getActiveBinderPublications());
    const accountSettings: IWebData<IAccountSettings> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountSettings());
    const domains: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getDomains());
    const accountFeatures: IWebData<string[]> = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getAccountFeatures());
    const previewVisuals = useBinderPreviewVisuals(binderId);
    const draggingInfo = useDraggingInfo();
    const mostUsedLanguages: string[] = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getMostUsedLanguages());
    const { data: commentThreads = [] } = useCommentThreads(binderId);
    const chunkApprovals: IWebData<IChunkApproval[]> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getChunkApprovals());
    const accountUsersWD = useAccountUsersWD();
    const accountId: string = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getActiveAccountId());
    const backendMetaModule: BindersModuleMeta[] = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getBackendMetaModule());
    const breadcrumbsPathsWD = useBrowsePathsWebData();
    const binderVisuals = useBinderVisuals();
    const accountUsers: User[] | undefined = useMemo(() => (accountUsersWD.state === WebDataState.SUCCESS && accountUsersWD.data) || undefined, [accountUsersWD]);
    const domain: string | undefined = useMemo(() => (domains.state === WebDataState.SUCCESS && domains.data.length && domains.data[0]) || undefined, [domains]);
    const readerLocation = useMemo(() => getReaderLocation(domain), [domain]);
    const breadcrumbsPaths = useMemo(
        () => breadcrumbsPathsWD.state === WebDataState.SUCCESS && breadcrumbsPathsWD.data as DocumentCollection[][],
        [breadcrumbsPathsWD]
    );

    const publicationLocations = useMemo(() => {
        const publicationLocationItems = (breadcrumbsPaths || []).map(bcp => bcp.slice(0, bcp.length - 1));
        return publicationLocationItems.map(toTitlePath);
    }, [breadcrumbsPaths]);

    const prevLockedItems = usePrevious(lockedItems);

    const binderLoaded = useRef(false);

    const webData: IWebData<RemoteData> = WebData.compose({
        storeBinder,
        semanticLinks,
        publications,
        accountSettings,
        domains,
        accountFeatures,
    });

    const releaseBinder = useCallback(() => {
        if (binderWasReleased.current) {
            return;
        }
        const body: ItemRelease = {
            itemId: binderId,
            userId: myDetails?.user.id,
            windowId: getWindowId()
        };
        APIDispatchEvent(
            {
                type: RoutingKeyType.ACCOUNT,
                value: accountId
            },
            ServiceNotificationType.ITEM_RELEASED,
            body,
        );
        binderWasReleased.current = true;
    }, [accountId, binderId, myDetails?.user.id]);

    const showSecondaryLanguage = useCallback((language) => {
        setSecondaryLanguageCode(language.iso639_1);
    }, [setSecondaryLanguageCode]);

    const hideSecondaryLanguage = useCallback(() => {
        setSecondaryLanguageCode(undefined);
    }, [setSecondaryLanguageCode]);

    const hasApprovalFlowFeature = useMemo(() => accountFeatures?.data.includes(FEATURE_APPROVAL_FLOW), [accountFeatures?.data]);

    useEffect(
        () => {
            if (hasApprovalFlowFeature) {
                fetchChunkApprovals(binderId);
            }
        },
        [binderId, hasApprovalFlowFeature]
    );

    useEffect(
        () => {
            if (isMobile) {
                hideSecondaryLanguage();
            }
        },
        [isMobile, hideSecondaryLanguage]
    );

    useEffect(
        () => {
            if (myDetails) {
                lockBinderIntervalID.current = setInterval(() => lockItem(myDetails, binderId, accountId), ONE_MINUTE);
            }
            return () => {
                clearInterval(lockBinderIntervalID.current);
            }
        },
        [accountId, binderId, myDetails]
    );

    useEffect(() => {
        checkIfMobile();
        window.addEventListener("resize", checkIfMobile);
        window.addEventListener("beforeunload", releaseBinder);
        window.addEventListener("pagehide", releaseBinder); // needed for iOS that doesn't fire beforeunload
        return () => {
            window.removeEventListener("resize", checkIfMobile);
            window.removeEventListener("beforeunload", releaseBinder);
        }
    }, [checkIfMobile, releaseBinder]);

    useEffect(() => {
        binderWasReleased.current = false;
        return () => {
            if (!disallowReleaseLocking.current) {
                releaseBinder();
            }
        }
    }, [releaseBinder]);

    const redirectUserBack = useCallback((disallowReleaseLock = false, reason?: UiErrorCode) => {
        disallowReleaseLocking.current = disallowReleaseLock;
        const previousLocation = getParentLocation(collectionId, restParams);
        history.push({
            pathname: previousLocation,
            search: reason ? `?redirect_reason=${reason}` : undefined
        })
        // exhaustive deps disabled: restParams is "updated" too often but keeps its initial value
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionId, history]);

    const handleEditLocking = useCallback(() => {
        if (!myDetails) return;
        const lockedByInfoFromLockedItems = lockedItems.get(binderId);
        if (!lockedByInfoFromLockedItems) {
            lockItem(myDetails, binderId, accountId);
        } else {
            const user = myDetails?.user;
            const changed = !lockedByInfo || (lockedByInfo?.lockedInThisWindow !== lockedByInfoFromLockedItems.lockedInThisWindow);
            if (changed) {
                setLockedByInfo({
                    ...lockedByInfoFromLockedItems,
                    itsMe: user && user.id === lockedByInfoFromLockedItems.user.id,
                });
            }
        }
        setEditLockingHandled(true);
    }, [lockedItems, lockedByInfo, accountId, binderId, myDetails, setLockedByInfo])

    useEffect(() => {
        if (!prevLockedItems) return;
        const lockedItemsChanged = !areLockedItemsEqual(lockedItems, prevLockedItems);
        const shouldHandleEditLocking = !binderWasReleased.current && (!editLockingHandled || lockedItemsChanged);
        if (shouldHandleEditLocking) {
            handleEditLocking();
        }

    }, [lockedItems, editLockingHandled, binderWasReleased, handleEditLocking, prevLockedItems]);

    const onOverrideLock = useCallback(() => {
        const user = myDetails?.user;
        if (!user) return;
        const body: ItemLock = {
            itemId: binderId,
            user: {
                id: user.id,
                displayName: user.displayName,
                login: user.login
            },
            windowId: getWindowId()
        };
        APIDispatchEvent(
            {
                type: RoutingKeyType.ACCOUNT,
                value: accountId
            },
            ServiceNotificationType.OVERRIDE_ITEM_LOCK,
            body,
        );
    }, [accountId, binderId, myDetails?.user]);

    const binder = useMemo(
        () => {
            return stateBinder || (storeBinder && storeBinder.state === WebDataState.SUCCESS && storeBinder.data);
        },
        [stateBinder, storeBinder]
    );

    const isDisabledView = useMemo(() => {
        return binder && binder.isDeleted && binder.isDeleted();
    }, [binder]);

    useEffect(() => {
        if (!stateBinder && binder) {
            setStateBinder(() => binder, undefined, undefined, true);
        }
    }, [binder, setStateBinder, stateBinder]);

    const storyTitleInfo = useMemo(
        () => {
            if (binder) {
                const { isPrimary } = selectedChunkDetails;
                const isoCode = isPrimary ? primaryLanguageCode : secondaryLanguageCode;
                const language = binder.getLanguageByIso(isoCode);
                return {
                    itemTitle: language?.storyTitle,
                    isoCode
                }
            }
            return undefined;
        },
        [binder, primaryLanguageCode, secondaryLanguageCode, selectedChunkDetails]
    )
    const sessionId = useMemo(() => UUID.randomWithPrefix("ses-"), []);
    const session: ComposerSession = useMemo(
        () => ({
            sessionId,
            binderId,
            itemId: binderId,
            itemKind: "binder",
            userId: (myDetails?.user.id),
            ...(storyTitleInfo || {})
        }),
        [sessionId, binderId, myDetails?.user.id, storyTitleInfo]
    );

    const getPostBinderUpdate = useCallback((updateBinderOptions: IUpdateBinderOptions = {}) => {
        const { newSelectedChunkIndex, affectsVisuals, proposedApprovalResetChunks, postBinderAction } = updateBinderOptions;
        const postBinderUpdates = [];
        if (newSelectedChunkIndex !== undefined) {
            const { index, isPrimary, useTimeout } = newSelectedChunkIndex;
            postBinderUpdates.push(async () => {
                if (useTimeout) {
                    setTimeout(() => setSelectedChunkDetails({ index, isPrimary }), 100);
                } else {
                    setSelectedChunkDetails({ index, isPrimary });
                }
            });
        }
        if (affectsVisuals) {
            postBinderUpdates.push(async (binder: Binder) => {
                const visualIds = binder.getVisualIds("i1");
                BinderMediaStoreActions.updateUsedVisuals(binder, visualIds);
            });
        }
        if (proposedApprovalResetChunks) {
            const approvals = chunkApprovals.state === WebDataState.SUCCESS ? chunkApprovals.data : [];
            handleResetApproval(binder, proposedApprovalResetChunks, approvals);
        }
        if (postBinderAction) {
            postBinderUpdates.push(async (binder: Binder) => {
                await postBinderAction(binder);
            });
        }
        if (!postBinderUpdates.length) {
            return undefined;
        }
        return async (updatedBinder: Binder) => {
            for (const update of postBinderUpdates) {
                await update(updatedBinder);
            }
        }
    }, [binder, chunkApprovals, setSelectedChunkDetails]);

    const handleBinderUpdate = useCallback((binderUpdate: IBinderUpdate) => {
        const { updateBinderOptions, patches } = binderUpdate;
        maybeLogEditSession(accountId, session);

        const postBinderUpdate = getPostBinderUpdate(updateBinderOptions);
        const bumpContentVersion = updateBinderOptions?.bumpContentVersion;
        setStateBinder(
            curriedMultiUpdate(patches, bumpContentVersion),
            postBinderUpdate,
            updateBinderOptions?.postBinderSaveCallback,
            false,
            bumpContentVersion,
            updateBinderOptions?.isEmptyChunk,
        );
        // The curried multiUpdate function will receive its last parameter (the binder)
        // in the setStateBinder implementation in useStateBinder hook. This assures we have the latest version
    }, [accountId, getPostBinderUpdate, session, setStateBinder]);

    useEffect(() => {
        const moduleKeyPair = primaryLanguageCode && binder && binder.getModulePairByLanguage(primaryLanguageCode);
        if (moduleKeyPair && moduleKeyPair.length > 1) {
            setImageModuleKey(moduleKeyPair[1]);
        }
    }, [primaryLanguageCode, binder, setImageModuleKey])

    useEffect(() => {
        // this effect redirects the user back when their edit lock has been overtaken taken over in another window (by themselves). The storeBinder.state becomes NOT_ASKED in that case
        if (storeBinder.state === WebDataState.SUCCESS) {
            binderLoaded.current = true;
            return;
        }
        if (storeBinder.state === WebDataState.NOT_ASKED && binderLoaded.current) {
            redirectUserBack(true);
        }
    }, [webData, lockedItems, binderLoaded, redirectUserBack, storeBinder.state]);

    useRedirectReadonlyUserBack(binderId, collectionId, () => redirectUserBack(false, UiErrorCode.noAccessEditor));

    // eslint-disable-next-line prefer-const
    let checkInactivityTimePassed;

    const startCheckInactivityInterval = useCallback(() => {
        if (inactivityIntervalId.current) {
            return;
        }
        inactivityIntervalId.current = setInterval(checkInactivityTimePassed, ONE_MINUTE);
    }, [checkInactivityTimePassed]);

    const stopCheckInactivityInterval = useCallback(() => {
        if (inactivityIntervalId.current) {
            clearInterval(inactivityIntervalId.current);
            inactivityIntervalId.current = null;
        }
    }, []);

    checkInactivityTimePassed = useCallback(() => {
        const diff = differenceInMilliseconds(new Date(), lastActivityMoment.current);
        if (isIOSSafari() && diff > FIVE_MINUTES) {
            stopCheckInactivityInterval();
            window.location.replace(getParentLocation(collectionId, restParams));
            return;
        }
        if (diff >= FIFTEEN_MINUTES) {
            stopCheckInactivityInterval();
            setInactivityDetected(true);
        }
    }, [collectionId, restParams, setInactivityDetected, stopCheckInactivityInterval]);

    useEffect(() => {
        if (!inactivityDetected) {
            startCheckInactivityInterval();
        }
        return () => {
            stopCheckInactivityInterval();
        }
    }, [startCheckInactivityInterval, stopCheckInactivityInterval, inactivityDetected]);

    const resetInactivityPeriod = useCallback(() => {
        lastActivityMoment.current = new Date();
        setInactivityDetected(false);
    }, [setInactivityDetected]);

    const onDragStart = useCallback((dragStart: DragStart) => {
        handleDrag(dragStart);
    }, []);

    const onDragEnd = useCallback((dropResult: DropResult) => {
        try {
            const binderUpdate = handleDrop(binder, dropResult);
            if (binderUpdate) {
                handleBinderUpdate(binderUpdate);
            }
            bumpChunkImagesBumpable();
        } catch (e) {
            handleVisualError(e, msg => FlashMessages.error(msg, true));
        }
    }, [binder, bumpChunkImagesBumpable, handleBinderUpdate]);

    const renderPending = (loadingMessage: string, _hideLoader: boolean, incompleteData: Partial<RemoteData> = {}) => {
        const {
            publications: publicationFindResults,
            semanticLinks,
            accountSettings,
            accountFeatures,
        } = incompleteData;
        const publications = publicationFindResults as Publication[]
        const noData = !publications || !semanticLinks || !accountSettings || !accountFeatures;
        return !binder || noData ?
            <PendingComposer
                isMobile={isMobile}
                mobileViewOnOpenRightPane={mobileViewOnOpenRightPane}
            /> :
            (
                <ComposerDragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                    {[
                        <Composer
                            accountFeatures={accountFeatures}
                            accountId={accountId}
                            binder={binder}
                            key="pending-composer"
                            lockedByInfo={lockedByInfo}
                            meta={backendMetaModule}
                            publications={publications}
                            semanticLinks={semanticLinks}
                            {...props}
                            accountSettings={accountSettings}
                            accountUsers={accountUsers}
                            binderVisuals={binderVisuals}
                            breadcrumbsPaths={breadcrumbsPaths}
                            commentThreads={commentThreads}
                            domain={domain}
                            draggingInfo={draggingInfo}
                            featuresChecklists={accountFeatures.includes(FEATURE_CHECKLISTS)}
                            hideSecondaryLanguage={hideSecondaryLanguage}
                            history={history}
                            isDisabledView={isDisabledView}
                            isMobile={isMobile}
                            mobileViewOnOpenRightPane={mobileViewOnOpenRightPane}
                            modalPlaceholder={modalPlaceholder.current}
                            mostUsedLanguages={mostUsedLanguages}
                            onAddLanguage={onAddLanguage}
                            onBinderUpdate={handleBinderUpdate}
                            onOverrideLock={onOverrideLock}
                            previewVisuals={previewVisuals}
                            primaryLanguageCode={primaryLanguageCode}
                            redirectUserBack={redirectUserBack}
                            secondaryLanguageCode={secondaryLanguageCode}
                            selectedChunkDetails={selectedChunkDetails}
                            setPrimaryLanguageCode={setPrimaryLanguageCode}
                            setSecondaryLanguageCode={setSecondaryLanguageCode}
                            setSelectedChunkDetails={setSelectedChunkDetails}
                            setStateBinder={setStateBinder}
                            useLogo={accountFeatures && accountFeatures.includes(FEATURE_QR_CODE_LOGO)}
                        />
                    ]}
                </ComposerDragDropContext>
            );
    }

    const onReplaceVisual = useCallback((patch, affectedChunkIndices: number[]) => {
        const binderUpdate = replaceVisualInComposer(patch, affectedChunkIndices);
        handleBinderUpdate(binderUpdate);
    }, [handleBinderUpdate])

    const onAddLanguage = useCallback((languageCode) => {
        const textModuleKey = binder.getNextTextModuleKey();
        const caption = "";
        const storyTitle = "";
        const updatedBinder = addTranslation(textModuleKey, languageCode, caption, imageModuleKey, storyTitle);
        handleBinderUpdate(updatedBinder);
        if (isMobile) {
            setPrimaryLanguageCode(languageCode);
        } else {
            setSecondaryLanguageCode(languageCode);
        }
        addLanguageUserAction(UserActionType.LANGUAGE_ADDED, languageCode, binderId, myDetails?.user.id, accountId);
    }, [binder, imageModuleKey, handleBinderUpdate, setSecondaryLanguageCode, accountId, myDetails, binderId, isMobile, setPrimaryLanguageCode])

    const onRelabelLanguage = useCallback((fromLanguageCode: string, toLanguageCode: string) => {
        const binderUpdate = relabelBinderLanguageUpdate(fromLanguageCode, toLanguageCode);
        handleBinderUpdate(binderUpdate);
        if (primaryLanguageCode === fromLanguageCode) {
            setPrimaryLanguageCode(toLanguageCode);
        }
        if (secondaryLanguageCode === fromLanguageCode) {
            setSecondaryLanguageCode(toLanguageCode);
        }
        reloadAfterLanguageRelabel(binderId, accountFeatures.data);
    }, [accountFeatures, binderId, handleBinderUpdate, primaryLanguageCode, secondaryLanguageCode]);

    useEffect(() => {
        if (isRightPaneOpen) {
            hideSecondaryLanguage();
        }
    }, [isRightPaneOpen, hideSecondaryLanguage]);

    const checkApprovals = useCallback((languageCode) => {
        const title = 1
        const keys = binder.getModulePairByLanguage(languageCode);
        if (keys.length === 0) {
            return false;
        }
        const [textsModules] = keys.map(key => binder.getModuleByKey(key));
        const chunkCount = textsModules.data.length;
        const approvals = chunkApprovals.state === WebDataState.SUCCESS ? chunkApprovals.data : [];

        const approvalsForLanguage = approvals.filter(({ chunkLanguageCode }) => chunkLanguageCode === languageCode);
        const areAllApproved = all((app: IChunkApproval) => app.approved === ApprovedStatus.APPROVED);

        if (!approvals.length || approvalsForLanguage.length < chunkCount + title) return false;
        return areAllApproved(approvalsForLanguage);
    }, [chunkApprovals, binder]
    );

    const onDeleteLanguage = useCallback((languageCode, callback) => {
        if (primaryLanguageCode === languageCode) {
            const newPrimaryLanguageCode = binder.getFirstLanguage(languageCode).iso639_1;
            setPrimaryLanguageCode(newPrimaryLanguageCode);
            callback();
            return;
        }
        callback();
        addLanguageUserAction(UserActionType.LANGUAGE_DELETED, languageCode, binderId, myDetails?.user.id, accountId);
    }, [binder, primaryLanguageCode, setPrimaryLanguageCode, accountId, myDetails, binderId]);

    const renderSuccess = (data: RemoteData) => {
        const { accountFeatures, publications: publicationFindResults, semanticLinks, accountSettings } = data;
        const publications = publicationFindResults as Publication[]
        return (
            <ComposerDragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                {[
                    <Composer
                        accountFeatures={accountFeatures}
                        accountId={accountId}
                        binder={binder}
                        key="composer"
                        lockedByInfo={lockedByInfo}
                        meta={backendMetaModule}
                        publications={publications}
                        semanticLinks={semanticLinks}
                        {...props}
                        accountSettings={accountSettings}
                        accountUsers={accountUsers}
                        binderVisuals={binderVisuals}
                        breadcrumbsPaths={breadcrumbsPaths}
                        commentThreads={commentThreads}
                        domain={domain}
                        draggingInfo={draggingInfo}
                        featuresChecklists={accountFeatures.includes(FEATURE_CHECKLISTS)}
                        hideSecondaryLanguage={hideSecondaryLanguage}
                        history={history}
                        isDisabledView={isDisabledView}
                        isMobile={isMobile}
                        mobileViewOnOpenRightPane={mobileViewOnOpenRightPane}
                        modalPlaceholder={modalPlaceholder.current}
                        mostUsedLanguages={mostUsedLanguages}
                        onAddLanguage={onAddLanguage}
                        onBinderUpdate={handleBinderUpdate}
                        onOverrideLock={onOverrideLock}
                        previewVisuals={previewVisuals}
                        primaryLanguageCode={primaryLanguageCode}
                        redirectUserBack={redirectUserBack}
                        secondaryLanguageCode={secondaryLanguageCode}
                        selectedChunkDetails={selectedChunkDetails}
                        setPrimaryLanguageCode={setPrimaryLanguageCode}
                        setSecondaryLanguageCode={setSecondaryLanguageCode}
                        setSelectedChunkDetails={setSelectedChunkDetails}
                        setStateBinder={setStateBinder}
                        useLogo={accountFeatures.includes(FEATURE_QR_CODE_LOGO)}
                    />,
                    <NavigationDrawer
                        {...props}
                        accountFeatures={webData.state === WebDataState.SUCCESS ? webData.data.accountFeatures : []}
                        accountId={accountId}
                        binder={binder}
                        checkApprovals={checkApprovals}
                        clickedVisualId={focusedVisualId}
                        domain={domain}
                        imageModuleKey={imageModuleKey}
                        isDisabledView={isDisabledView}
                        isMobile={isMobile}
                        key="drawer"
                        meta={backendMetaModule}
                        modalPlaceholder={modalPlaceholder.current}
                        mostUsedLanguages={mostUsedLanguages}
                        onAddLanguage={onAddLanguage}
                        onDeleteLanguage={onDeleteLanguage}
                        onRelabelLanguage={onRelabelLanguage}
                        onReplaceVisual={onReplaceVisual}
                        onShowSecondaryLanguage={showSecondaryLanguage}
                        primaryLanguageCode={primaryLanguageCode}
                        publicationLocations={publicationLocations}
                        publications={publications}
                        readerLocation={readerLocation}
                        secondaryLanguageCode={secondaryLanguageCode}
                        selectedChunkDetails={selectedChunkDetails}
                        semanticLinks={webData.state === WebDataState.SUCCESS ? webData.data.semanticLinks : []}
                        setStateBinder={setStateBinder}
                        showShowLanguages={!secondaryLanguageCode}
                        useLogo={webData.state === WebDataState.SUCCESS ? webData.data.accountFeatures.includes(FEATURE_QR_CODE_LOGO) : false}
                    />,
                ]}
            </ComposerDragDropContext>
        );
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const resetLastActivityMoment = useCallback(debounce(
        (() => lastActivityMoment.current = new Date()),
        500,
        { leading: true }
    ), []);

    // eslint-disable-next-line no-mixed-operators
    const toRender = useWebData<RemoteData>(
        webData,
        renderSuccess,
        renderPending,
        renderFailure
    );

    const ribbonsTopHeight = useRibbonsTopHeight();
    const ribbonsBottomHeight = useRibbonsBottomHeight();
    const useBinderFavicon = !(accountFeatures ? accountFeatures.data.includes(FEATURE_BROWSER_LOGO_FAVICON) : false);

    const onRedirectBackNoActivity = useCallback(() => {
        redirectUserBack(false, UiErrorCode.composerInactivity);
    }, [redirectUserBack]);

    return (
        <div
            className={cx("composer-wrapper", { "composer-wrapper--wide": !!secondaryLanguageCode })}
            ref={modalPlaceholder}
            onClick={resetLastActivityMoment}
            onKeyUp={resetLastActivityMoment}
            style={{
                marginTop: `${ribbonsTopHeight}px`,
                marginBottom: `${ribbonsBottomHeight}px`,
            }}
        >
            {accountFeatures && accountFeatures.data.includes(FEATURE_BROWSER_TAB_TITLE) &&
                <TabInfo
                    title={binder && primaryLanguageCode ? binder.getTitle(primaryLanguageCode) : undefined}
                    faviconUrl={(useBinderFavicon && binder) ? binder.getThumbnailUrl() : undefined}
                />
            }
            <BinderUpdateProvider
                binder={binder}
                updateBinder={handleBinderUpdate}
            >
                <BinderDiffProvider>
                    <Layout
                        {...props}
                        browseInfoFromRouteParams={browseInfoFromRouteParams}
                        modalPlaceholder={modalPlaceholder.current}
                        cloneBreadcrumbsPaths={true}
                        inCompose={true}
                        hideBreadcrumbs={true}
                        hideBreadcrumbsContextMenu={isDisabledView}
                    >
                        {toRender}
                    </Layout>
                </BinderDiffProvider>
            </BinderUpdateProvider>
            <div
                id="draggable-element"
            />
            {inactivityDetected && (
                <InactivityModal
                    resetInactivity={resetInactivityPeriod}
                    redirectBack={onRedirectBackNoActivity}
                />
            )}
        </div>
    );
};

export default ComposerContainer;
