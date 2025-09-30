import * as React from "react";
import { APIGetRootCollection, APILoadBinder, APISaveNewBinder } from "../api";
import {
    Account,
    AccountFeatures,
    AccountLicensing,
    FEATURE_ANALYTICS,
    FEATURE_CHECKLISTS,
    FEATURE_COLLECTION_HIDE,
    FEATURE_DIALECTS,
    FEATURE_DOCUMENT_OWNER,
    FEATURE_NOTIFICATIONS,
    FEATURE_PUBLICCONTENT,
    FEATURE_READER_COMMENTING,
    FEATURE_READER_RATING,
    FEATURE_READ_CONFIRMATION,
    FEATURE_READ_REPORTS,
    FEATURE_RECURSIVE_ACTIONS,
    FEATURE_TRANSLATOR_ROLE,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AssigneeType,
    IAclRestrictionSet,
    IPermissionFlag,
    PermissionMap,
    PermissionName,
    ResourceType,
    Role
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import BinderClass, { create as createBinder } from "@binders/client/lib/binders/custom/class";
import { IWebData, WebData, WebDataState } from "@binders/client/lib/webdata";
import {
    ItemLock,
    RoutingKeyType,
    ServiceNotificationType
} from "@binders/client/lib/clients/notificationservice/v1/contract";
import { StoreItemLock, areLockedItemsEqual, useItemLocks } from "../../editlocking/store";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import TranslocateItem, { TranslocateOperation } from "../TranslocateItem";
import { User, UserDetails, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    addUserToAcl,
    addUsergroupToAcl,
    grantPublicReadAccess,
    removeUserFromAcl,
    removeUsergroupFromAcl,
    revokePublicReadAccess,
    updateGroupAcl,
    updateUserAcl
} from "../../authorization/actions";
import {
    buildAccessDataAssignees,
    calculatePermissionFlags,
    filterPermissionsWithRestrictions,
    getUiRoleName
} from "../../authorization/tsHelpers";
import { buildAclsList, extractTitleForBreadcrumb } from "../../browsing/helper";
import {
    deleteCollection,
    deleteDocument,
    removeItemFromAllCollections,
    removeItemFromCollection,
    setCollectionIsHidden
} from "../actions";
import { findSemanticLinks, loadPublications } from "../actions/loading";
import {
    getParentId,
    hasPublicAncestors,
    loadDocumentAcls,
    patchBreadCrumbsBinder,
    setBinderShowInOverview,
    setCollectionShowInOverview,
    setIsPublicForId
} from "../../browsing/actions";
import {
    useAccountUsersOrEmpty,
    useCurrentUserId,
    useMyDetails,
} from "../../users/hooks";
import {
    useActiveBrowsePathWebData,
    useActiveCollection,
    useActiveParentCollections,
    useDocumentsPublicInfo
} from "../../browsing/hooks";
import {
    useHasFullPermissionAnywhere,
    useMyPermissionMapOrEmpty
} from "../../authorization/hooks";
import { APIDispatchEvent } from "../../notification/api";
import { APIFindMyResourceGroups } from "../../authorization/api";
import AccessModal from "../../browsing/MyLibrary/document/AccessModal/AccessModal";
import AccountStore from "../../accounts/store";
import AddNewDocument from "../../browsing/MyLibrary/document/AddNewDocument";
import AllAccounts from "../../accounts/AllAccounts";
import BinderStore from "../../documents/store";
import Button from "@binders/ui-kit/lib/elements/button";
import { ChecklistsActionsModal } from "../modals/ChecklistsActionsModal/ChecklistsActionsModal";
import { ComposerSharingModal } from "../../shared/sharing/ComposerSharingModal";
import { Container } from "flux/utils";
import ContextMenu from "@binders/ui-kit/lib/elements/contextmenu";
import CreateInstanceModal from "../../browsing/MyLibrary/document/CreateInstanceModal";
import { DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import DocumentStore from "../../documents/store";
import EditCollectionForm from "../../browsing/MyLibrary/collection/form/edit";
import FindInTrash from "@binders/ui-kit/lib/elements/icons/FindInTrash";
import { FlashMessages } from "../../logging/FlashMessages";
import { IAccessDataAssignee } from "../../shared/access-box";
import { Map } from "immutable";
import MenuItem from "@binders/ui-kit/lib/elements/contextmenu/MenuItem";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { NotificationSettingsModal } from "../../notification/settings/NotificationSettingsModal";
import OwnershipModal from "../../browsing/MyLibrary/document/OwnershipModal/OwnershipModal";
import ReadStatsModal from "../../browsing/MyLibrary/document/ReadStatsModal";
import {
    ReaderFeedbackSettingsModal
} from "../../readerfeedback/settings/ReaderFeedbackSettingsModal";
import RecursiveActionsModal from "../RecursiveActions";
import { StoresList } from "flux/lib/FluxContainer";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TRASH_ROUTE } from "../../trash/routes";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import autobind from "class-autobind";
import { buildAclKey } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import { createPortal } from "react-dom";
import { deserializeEditorStates } from "@binders/client/lib/draftjs/helpers";
import { ensureDocumentAcl } from "../../authorization/tsHelpers";
import { equals } from "ramda";
import { extractTitle, } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { getItemIdsFromPermissionMap } from "../../authorization/helper";
import { getItemLink } from "../../browsing/tsHelpers";
import { getPathFromParentItems } from "../actions";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { invalidatePublicDocumentCount } from "../hooks";
import { isThisItemHidden } from "../../shared/helper";
import { loadAccountLicensing } from "../../accounts/actions";
import { showModal } from "@binders/ui-kit/lib/compounds/modals/showModal";
import { useGetAccountUsergroupsIncludingAutoManaged } from "../../users/query";
import { useVisualModal } from "../../media/VisualModal";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";

type ItemContextMenuProps = {
    permissions: PermissionMap[];
    accountUsers?: User[];
    accountUsergroups?: Usergroup[];
    canEditAnythingInAccount: boolean;
    currentUser?: UserDetails;
    getParentItems;
    history;
    inCompose;
    isForActive;
    item;
    modalPlaceholder;
    livesInLibraryItem;
    lockedItems: ReadonlyMap<string, StoreItemLock>;
    showMyLibraryLink;
    t: TFunction;
    visualModal;
    breadcrumbsData;
    activeCollection;
    parentCollectionIds;
    isPublicInfo;
    userId?: string;
};

type Data = {
    accountFeatures: AccountFeatures;
    accountSettings: IAccountSettings;
    accountRoles: Role[];
    adminGroup: string;
}

type ItemContextMenuState = {
    accountId: string;
    accountDomains;
    data: IWebData<Data>;
    defaultCreationLanguage: string;
    domain: string;
    isPublicToggleActive: boolean;
    isRecursiveActionsModalShown: boolean;
    items;
    licensing;
    lockedBy?: {
        id: string,
        displayName: string,
        login: string,
    };
    mostUsedLanguages;
    myEditAccessAccounts: Account[] | null;
    parentItems?: DocumentCollection[];
    parentPermissionFlags;
    permissionFlags: IPermissionFlag[];
    permissionMap;
    readerLocation;
    removalInProgress: boolean;
    userAccessData;
    editCollectionInitialTabIndex: number;
    fullBinder: BinderClass;
};

export class ItemContextMenu extends WebDataComponent<Data, ItemContextMenuProps> {

    getParentItemsPromise = null;

    static getStores(): StoresList {
        return [AccountStore, DocumentStore];
    }

    static calculateState(previousState: ItemContextMenuState, props: ItemContextMenuProps): ItemContextMenuState {
        const domainsWD = AccountStore.getDomains();
        const domains = domainsWD.state === WebDataState.SUCCESS && domainsWD.data;
        const domain = (domains && domains.length > 0 && domains[0]) || "";
        const accountId = AccountStore.getActiveAccountId();
        return {
            accountId,
            data: WebData.compose<Data>({
                accountRoles: AccountStore.getAccountRoles(),
                adminGroup: AccountStore.getAdminGroup(),
                accountSettings: AccountStore.getAccountSettings(),
                accountFeatures: AccountStore.getAccountFeatures(),
            }),
            ...(props.inCompose || !props.livesInLibraryItem ? { activeBinderPublications: DocumentStore.getActiveBinderPublications() } : {}),
            defaultCreationLanguage: AccountStore.getAccountSettings(),
            items: DocumentStore.getEditableItems(),
            domain,
            licensing: AccountStore.getAccountLicensing(),
            permissionMap: (previousState && previousState.permissionMap) || {},
            userAccessData: (previousState && previousState.userAccessData) || Map(),
            accountDomains: AccountStore.getDomains(),
            isPublicToggleActive: (previousState && previousState.isPublicToggleActive) || true,
            readerLocation: (previousState && previousState.readerLocation) || (domain ? getReaderLocation(domain) : undefined),
            myEditAccessAccounts: AccountStore.myAccountsWithEditAccess(),
            removalInProgress: previousState ? previousState.removalInProgress : false,
            isRecursiveActionsModalShown: previousState ? previousState.isRecursiveActionsModalShown : false,
            permissionFlags: (previousState && previousState.permissionFlags) || [],
            parentPermissionFlags: previousState?.parentPermissionFlags ?? [],
            mostUsedLanguages: BinderStore.getMostUsedLanguages(),
            editCollectionInitialTabIndex: previousState?.editCollectionInitialTabIndex ?? 0,
            fullBinder: previousState?.fullBinder ?? null,
        };
    }

    constructor(props: ItemContextMenuProps) {
        super(props);
        autobind(this, ItemContextMenu.prototype);
        this.onDeleteItem = this.onDeleteItem.bind(this);
    }

    componentDidMount(): void {
        const { getParentItems } = this.props;
        if (getParentItems) {
            this.getParentItemsPromise = getParentItems();
        }
    }

    componentDidUpdate(prevProps: ItemContextMenuProps, _prevState: ItemContextMenuState): void {
        const { breadcrumbsData: prevBreadcrumbsData, lockedItems: prevLockedItems } = prevProps;
        const { breadcrumbsData, item, getParentItems, lockedItems } = this.props;
        const { lockedBy } = this.state;
        const lockedItemsChanged = !areLockedItemsEqual(lockedItems, prevLockedItems);
        const breadcrumbsDataChanged = !equals(breadcrumbsData?.result, prevBreadcrumbsData?.result);
        if ((lockedBy === undefined || lockedItemsChanged || breadcrumbsDataChanged) && breadcrumbsData?.state === WebDataState.SUCCESS) {
            const fullActiveIdPath = [...breadcrumbsData.result.map(i => i.id), item.id];
            const relevantLockedItemId = fullActiveIdPath.find(id => lockedItems.has(id));
            const relevantLockedItem = relevantLockedItemId && lockedItems.get(relevantLockedItemId);
            const newLockedBy = relevantLockedItem?.user;
            if (newLockedBy !== lockedBy) {
                this.setState({
                    lockedBy: newLockedBy,
                });
            }
        }
        if (getParentItems && !this.getParentItemsPromise) {
            this.getParentItemsPromise = getParentItems(); // MT-2770
        }
    }

    documentHasPublications(): boolean {
        const { livesInLibraryItem, item } = this.props;
        const { activeBinderPublications: activeBinderPublicationsWD } = this.state;
        const { result: publicationsResult } = activeBinderPublicationsWD || {};
        return livesInLibraryItem ?
            item.hasPublications :
            publicationsResult && publicationsResult.length > 0; // in the composer, use activeBinderPublications from store, which updates dynamically
    }


    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    getProperParentsForTreeNavigator() {
        const { rootItemOfNewDocument, parentItems: parentItemsFromProps } = this.state;
        const parentItems = [...parentItemsFromProps] || [];
        const restrictionlessPermissions = filterPermissionsWithRestrictions(this.props.permissions);
        const itemIds = getItemIdsFromPermissionMap(restrictionlessPermissions, [PermissionName.ADMIN, PermissionName.EDIT]);
        for (const parentItem of [...parentItems]) {
            if (itemIds.includes(parentItem.id)) {
                break;
            }
            parentItems.shift();
        }
        const extract = item => (
            { id: item.id, domainCollectionId: item.domainCollectionId, name: extractTitleForBreadcrumb(item) }
        );
        const properParentItems = parentItems.map(extract);
        if (rootItemOfNewDocument) {
            properParentItems.push(rootItemOfNewDocument);
        }
        return properParentItems;
    }

    hideChooseDestinationAccountIdModal(): void {
        this.setState({ isChooseDestinationAccountIdModalShown: false });
    }

    onEditCollection(): void {
        this.setState({
            isEditCollectionModalShown: true,
        });
    }

    onDoubleClickVisual(openVisual: unknown): void {
        this.props.visualModal.showVisualModal(openVisual);
    }

    onCloseEditCollectionForm(): void {
        this.setState({ isEditCollectionModalShown: false });
    }

    toggleOwnershipModal(to: unknown): void {
        this.setState({ isOwnershipModalShown: to ?? !this.state.isOwnershipModalShown });
    }

    onAddNewDocument(): (selectedCollectionId: string, selectedCollectionParentPath: string, selectedLanguage: string) => Promise<void> {
        const { t } = this.props;
        return async (selectedCollectionId, selectedCollectionParentPath, selectedLanguage) => {
            const binder = await APISaveNewBinder("", selectedCollectionId, selectedLanguage, this.state.accountId);

            this.setState({
                isNewDocumentModalShown: false,
            });
            const fullPathItems = [
                ...selectedCollectionParentPath,
                selectedCollectionId
            ];
            const path = fullPathItems.reduce((prev, id) => `${prev}/${id}`, "");
            FlashMessages.success(t(TK.Edit_DocCreateSuccess));
            this.props.history.push(`/documents${path}/${binder.id}`);
        }
    }

    onCloseAddNewDocumentModal(): void {
        this.setState({
            isNewDocumentModalShown: false,
        })
    }

    onShowAddNewDocumentModal(rootItemOfNewDocument: unknown): void {
        this.setState({
            isNewDocumentModalShown: true,
            rootItemOfNewDocument
        });
    }

    async onSelectTranslocateDestinationAccountId(accountId: string): Promise<void> {
        const { parentItems, accountId: currentAccountId } = this.state;
        const rootCollection = await APIGetRootCollection(accountId);
        const permissions = await APIFindMyResourceGroups([accountId], ResourceType.DOCUMENT, [PermissionName.EDIT, PermissionName.ADMIN], false);
        const parents = (parentItems.length === 0 || rootCollection.id !== parentItems[0].id) ?
            [{
                id: rootCollection.id,
                domainCollectionId: rootCollection.id,
                name: rootCollection.titles[0].title,
            }] :
            this.getProperParentsForTreeNavigator();
        this.showTranslocateModal(currentAccountId, accountId, parents, { permissions });
    }

    updateUserAccessData(
        data: { isLoading: boolean } | { isPublic: boolean } | { showInOverview: boolean },
        id?: string
    ): void {
        const { item: { id: itemIdFromProps } } = this.props;
        const itemId = id || itemIdFromProps;
        const previousData = this.state.userAccessData.get(itemId);
        const newData = { ...previousData, ...data };
        this.setState({
            userAccessData: this.state.userAccessData.set(itemId, newData)
        });
    }

    async onChangeAccess(assigneeId: string, oldAclId: string, newRoleName: string, newAclRestrictionSet: IAclRestrictionSet): Promise<void> {
        const { item: { id: itemId }, t } = this.props;
        const { accountId, userAccessData, data: { partials } } = this.state;
        const { accountRoles: accountRolesWD } = partials;
        const accessData = userAccessData.get(itemId);

        const newRole = accountRolesWD.result.find(r => r.name === newRoleName);
        const newAclId = await ensureDocumentAcl(accessData.assignees, itemId, accountId, newRole, newAclRestrictionSet);
        const assignee = accessData.assignees.find(data => data.id === assigneeId);
        const updateFn = assignee.type === AssigneeType.USER ? updateUserAcl : updateGroupAcl;

        const skipPersistToDb = newRoleName === "Contributor" && newAclRestrictionSet?.languageCodes && !(newAclRestrictionSet?.languageCodes.length);

        try {
            if (!skipPersistToDb) {
                await updateFn(oldAclId, newAclId, accountId, assigneeId);
            }
            const newData = {
                ...accessData,
                assignees: accessData.assignees.map(assignee => (
                    assignee.id === assigneeId && !assignee.isInheritedAcl ?
                        {
                            ...assignee,
                            aclKey: buildAclKey(newRoleName, newAclRestrictionSet),
                            aclId: newAclId,
                            roleName: newRoleName,
                            uiRoleName: getUiRoleName(newRole, newAclRestrictionSet),
                            aclRestrictionSet: newAclRestrictionSet
                        } :
                        assignee
                )),
            };
            this.setState({
                userAccessData: userAccessData.set(itemId, newData),
            });
        } catch (error) {
            FlashMessages.error(t(TK.Acl_AccessChangeFail));
        }
    }

    buildOnUserAccessAdd(data: Data): (aclItems: { id: string, rawLabel: string, value: unknown }[], roleName: string, aclRestrictionSet?: IAclRestrictionSet) => Promise<void> {
        return async (aclItems, roleName, aclRestrictionSet) => {
            const { accountId, userAccessData, data: { partials } } = this.state;
            const { accountRoles: accountRolesWD } = partials;
            const { item: { id: itemId } } = this.props;
            const accessData = userAccessData.get(itemId);

            const role = accountRolesWD.result.find((r: Role) => r.name === roleName);

            const aclId = await ensureDocumentAcl(accessData.assignees, itemId, accountId, role, aclRestrictionSet);
            // retrieve acls not inherited from root collection
            const newAssignees = aclItems.map((aclItem) => {
                const isUser = aclItem.id.startsWith("uid");
                return {
                    aclId,
                    id: aclItem.id,
                    isInheritedAcl: false,
                    label: aclItem.rawLabel,
                    roleName: role.name,
                    uiRoleName: getUiRoleName(role, aclRestrictionSet),
                    type: isUser ? AssigneeType.USER : AssigneeType.USERGROUP,
                    value: aclItem.value,
                    aclKey: buildAclKey(roleName, aclRestrictionSet),
                    aclRestrictionSet,
                };
            });

            for await (const { id } of newAssignees) {
                const isUser = id.startsWith("uid");
                const addFn = isUser ? addUserToAcl : addUsergroupToAcl;
                await addFn(aclId, accountId, id);
            }
            this.loadDocumentAccess(data, false);
        }
    }

    buildOnUserAccessRemoval(data: Data): (assignee: IAccessDataAssignee) => Promise<void> {
        return async (assignee: IAccessDataAssignee): Promise<void> => {
            const { t } = this.props;
            const { accountId } = this.state;
            const isUser = assignee.type === AssigneeType.USER;
            const removalFn = isUser ? removeUserFromAcl : removeUsergroupFromAcl;
            try {
                await removalFn(assignee.aclId, accountId, assignee.id);
                this.loadDocumentAccess(data);
            } catch (error) {
                FlashMessages.error(t(TK.User_RemoveFail));
            }
        }
    }

    async onToggleItemPublic(isPublic: boolean): Promise<void> {
        const { item: { id: itemId }, t } = this.props;
        const { accountId } = this.state;
        const toggleFn = isPublic ? revokePublicReadAccess : grantPublicReadAccess;
        this.updateUserAccessData({ isLoading: true });
        try {
            await toggleFn(accountId, itemId);
            setIsPublicForId(itemId, !isPublic);
            loadAccountLicensing(accountId);
            this.updateUserAccessData({ isPublic: !isPublic });
            invalidatePublicDocumentCount(accountId);
        } catch (error) {
            FlashMessages.error(t(TK.Acl_ChangePublicFail));
        } finally {
            this.updateUserAccessData({ isLoading: false });
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async setShowInOverview(item, showInOverview: boolean): Promise<void> {
        const { t } = this.props;
        const { isPublicToggleActive, accountId } = this.state;
        // set/unset explicit public read access so we can easily find them on reader side
        const toggleFn = showInOverview ? revokePublicReadAccess : grantPublicReadAccess;
        this.updateUserAccessData({ isLoading: true });
        try {
            if (item.kind === "collection") {
                await setCollectionShowInOverview(item.id, !showInOverview);
            } else {
                await setBinderShowInOverview(item, !showInOverview);
            }
            if (!isPublicToggleActive) {
                await toggleFn(accountId, item.id);
                setIsPublicForId(item.id, true);
            }
            this.updateUserAccessData({ showInOverview: !showInOverview });
        } catch (error) {
            FlashMessages.error(t(TK.Acl_ChangeOptionFail));
        } finally {
            this.updateUserAccessData({ isLoading: false });
        }
    }

    async loadDocumentAccess(data: Data, revealModalOnFinish = true): Promise<void> {
        const { item } = this.props;
        const { userAccessData, parentItems, isPublicInfo } = this.state;
        const { accountUsers: users, accountUsergroups: usergroups } = this.props;
        const { accountRoles } = data;
        const permissionMap = await loadDocumentAcls(item.id, item.accountId);
        const assignees = buildAccessDataAssignees(
            permissionMap.permissions,
            item.id,
            users,
            usergroups ?? [],
            accountRoles,
        );
        const currentData = userAccessData.get(item.id);
        // const currentItem = items.find(item => item.id === document.id);
        let showInOverview;
        if (currentData && currentData.showInOverview !== undefined) {
            showInOverview = currentData.showInOverview;
        } else {
            if (item && item.showInOverview !== undefined) {
                showInOverview = item.showInOverview;
            }
        }
        let isPublicResult;
        const isPublicFromStore = isPublicInfo?.[item.id];
        if (isPublicFromStore) {
            isPublicResult = isPublicFromStore.isPublic ||
                isPublicFromStore.hasPublicAncestors
            this.setState({
                isPublicToggleActive: !(isPublicFromStore.hasPublicAncestors),
            });
        } else {
            const isPublic = permissionMap.permissions
                .filter(perm => !perm.ancestorResourceId || perm.ancestorResourceId === item.id)
                .findIndex(perm => perm.assigneeType === AssigneeType.PUBLIC) > -1;

            const publicAncestorFound = await hasPublicAncestors(parentItems);
            setIsPublicForId(item.id, isPublic, publicAncestorFound, getParentId(parentItems));
            this.setState({
                isPublicToggleActive: !publicAncestorFound,
            });
            isPublicResult = isPublic || publicAncestorFound;

        }

        const newData = { showInOverview, isPublic: isPublicResult, assignees };
        this.setState({
            isChangeAccessModalShown: revealModalOnFinish ?
                true :
                this.state.isChangeAccessModalShown,
            permissionMap,
            userAccessData: userAccessData.set(item.id, newData),
        });
    }

    onCloseAccessModal(): void {
        this.setState({
            isChangeAccessModalShown: false,
            isPublicToggleActive: true,
        });
    }

    onAccessModalUnmount(): void {
        this.setState({
            isChangeAccessModalShown: false,
            permissionMap: {},
        });
    }

    async clickRecycleBin(): Promise<void> {
        const { item: { id }, history } = this.props;
        history.push(`${TRASH_ROUTE}/${id}`);
    }

    async onClickShareDocument(): Promise<void> {
        const { item: { id } } = this.props;
        const [fullBinderRaw] = await Promise.all([
            APILoadBinder(id, { cdnnify: false }),
            findSemanticLinks(id),
            loadPublications(id),
        ]);
        const fullBinder = createBinder(deserializeEditorStates(fullBinderRaw));
        this.setState({
            isSharingModalShown: true,
            fullBinder,
        });
    }

    onCloseShowQRCodeModal(): void {
        this.setState({ isSharingModalShown: false });
    }

    onCreateInstance(): void {
        this.setState({ isCreateInstanceModalShown: true });
    }

    onShowReadStats(): void {
        this.setState({ isReadStatsModalShown: true });
    }

    onCloseReadStats(): void {
        this.setState({ isReadStatsModalShown: false });
    }

    onCloseCreateDocumentInstance(): void {
        this.setState({ isCreateInstanceModalShown: false });
    }

    getCurrentUser() {
        return this.props.currentUser?.user;
    }

    handleLockedItemToDelete(lockedUserId: string): void {
        const { t } = this.props;
        const { id: userId, displayName, login } = this.getCurrentUser();
        const userName = displayName || login || userId;
        if (lockedUserId === userId) {
            this.setState({ showOverrideLockModal: true });
            return;
        }
        FlashMessages.error(
            t(TK.DocManagement_DeleteFailLocked, { name: userName }),
        );
    }

    onOverrideLock(): void {
        const { accountId } = this.state;
        const { item } = this.props;
        const { id, displayName, login } = this.getCurrentUser();
        const body: ItemLock = {
            itemId: item.id,
            user: { id, displayName, login },
        };
        APIDispatchEvent(
            {
                type: RoutingKeyType.ACCOUNT,
                value: accountId
            },
            ServiceNotificationType.OVERRIDE_ITEM_LOCK,
            body,
        );
    }

    async onClickDelete(): Promise<void> {
        const { inCompose, item } = this.props;
        const { lockedBy } = this.state;
        const { isInstance } = item;
        if (isInstance) {
            this.onDeleteItem();
            return;
        }

        if (!!lockedBy && !inCompose) { // when we're in compose, means we're editing it ourself, no need to show locked info
            this.handleLockedItemToDelete(lockedBy.id);
            return;
        }

        this.setState({
            isFacingRemoval: true
        });
    }

    async onDeleteItem(): Promise<void> {
        const { item, history, isForActive, t } = this.props;
        const { accountId, parentItems, userAccessData } = this.state;
        const { id, kind, isInstance } = item;
        const isCollection = kind === "collection";
        this.setState({
            removalInProgress: true,
        });
        try {
            if (isInstance) {
                if (parentItems.length === 0) {
                    await removeItemFromAllCollections(kind, id);
                } else {
                    const parentCollectionId = [...parentItems].pop().id;
                    await removeItemFromCollection(parentCollectionId, kind, id, accountId, true);
                }
            } else {
                const allData = userAccessData.get(id);
                if (allData && allData.isPublic) {
                    await revokePublicReadAccess(accountId, id);
                }
                if (isCollection) {
                    await deleteCollection(id, accountId);
                } else {
                    await deleteDocument(id, accountId);
                }
            }
            this.setState({
                isFacingRemoval: false,
                removalInProgress: false,
            });

            if (isForActive) {
                history.push(`/browse/${parentItems.map(item => item.id).join("/")}`);
            } else {
                // make sure collection in breadcrumbs knows that item has been deleted
                const parentCollection = [...parentItems].pop();
                parentCollection.elements = parentCollection.elements.filter(({ key: elementId }) => elementId !== id);
                patchBreadCrumbsBinder(parentCollection);
            }
            FlashMessages.success(t(TK.DocManagement_ItemDeleteSuccess, { itemKind: this.getItemTypeName(item) }));
        } catch (e) {
            // eslint-disable-next-line
            console.error(e);
            this.setState({
                isFacingRemoval: false,
                removalInProgress: false,
            });
            FlashMessages.error(t(TK.DocManagement_ItemDeleteFail));
        }
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    getItemTypeName(item): string {
        const { t } = this.props;
        if (item.isInstance) {
            return t(TK.DocManagement_Instance);
        }
        return item.kind === "collection" ? t(TK.DocManagement_Collection) : t(TK.DocManagement_Document);
    }

    cancelDelete(): void {
        this.setState({
            isFacingRemoval: false,
        });
    }

    onMove(): void {
        this.onTranslocate(TranslocateOperation.MOVE_ITEM);
    }

    onDuplicate(): void {
        this.onTranslocate(TranslocateOperation.DUPLICATE_ITEM);
    }

    onTranslocate(translocateOperation: TranslocateOperation): void {
        const { accountId, myEditAccessAccounts } = this.state;
        const translocateDestinationParentItems = this.getProperParentsForTreeNavigator();

        this.setState({
            translocateOperation,
            translocateDestinationParentItems
        }, () => {
            if (
                myEditAccessAccounts?.length > 1 &&
                translocateOperation === TranslocateOperation.DUPLICATE_ITEM
            ) {
                this.onShowChooseDestinationAccountIdModal();
            } else {
                this.showTranslocateModal(
                    accountId,
                    accountId,
                    translocateDestinationParentItems, { permissions: this.props.permissions },
                );
            }
        });
    }

    showTranslocateModal(
        fromAccountId: string,
        toAccountId: string,
        translocateDestinationParentItems: unknown,
        translocateDestinationPermissionMap: unknown,
    ): void {
        this.setState({
            isChooseDestinationAccountIdModalShown: false,
            translocateDestinationAccountInfo: { fromAccountId, toAccountId },
            translocateDestinationParentItems,
            translocateDestinationPermissionMap,
        }, this.onShowTranslocateItemModal);
    }

    onShowChooseDestinationAccountIdModal(): void {
        this.setState({
            isChooseDestinationAccountIdModalShown: true,
        })
    }

    onShowTranslocateItemModal(): void {
        const { item } = this.props;
        const { translocateDestinationAccountInfo } = this.state;
        const { id, kind, isRootCollection } = item;
        this.setState({
            isTranslocateItemModalShown: true,
            translocatingItem: {
                id,
                kind,
                isRootCollection,
            },
            translocateDestinationAccountInfo,
        })
    }

    onHideTranslocateItemModal(): void {
        this.setState({ isTranslocateItemModalShown: false, translocatingItem: undefined });
    }

    showRecursiveActionsModal(): void {
        this.setState({
            isRecursiveActionsModalShown: true,
        });
    }
    hideRecursiveActionsModal(): void {
        this.setState({
            isRecursiveActionsModalShown: false,
        });
    }


    renderRecursiveActionsModal(): JSX.Element {
        const { t, item } = this.props;
        const { isRecursiveActionsModalShown, accountId, parentCollectionIds, activeCollection, mostUsedLanguages } = this.state;
        if (!isRecursiveActionsModalShown) {
            return null;
        }

        let parentCollectionId: string | undefined;
        if (activeCollection === item.id) {
            parentCollectionId = ([...parentCollectionIds].pop()) || activeCollection || "/"
        } else {
            parentCollectionId = activeCollection
        }

        return <RecursiveActionsModal
            t={t}
            hideModal={this.hideRecursiveActionsModal.bind(this)}
            collectionId={item.id}
            parentCollectionId={parentCollectionId}
            collectionTitle={item.titles[0].title}
            accountId={accountId}
            mostUsedLanguages={mostUsedLanguages}
        />
    }

    getMenuAndIconStyle(isForActive: boolean): {
        menuStyle: undefined | { width: "auto", height: "auto", padding: 0 },
        menuIconStyle: undefined | { fontSize: 18 }
    } {
        return {
            menuStyle: !isForActive ?
                undefined :
                {
                    width: "auto",
                    height: "auto",
                    padding: 0,
                },
            menuIconStyle: !isForActive ?
                undefined :
                {
                    fontSize: 18,
                },
        }
    }

    openReaderWindow(id: string, isCollection: boolean): () => void {
        return () => {
            const { parentItems, readerLocation, domain } = this.state;

            const config = {
                isCollection,
                itemId: id,
                parentCollections: getPathFromParentItems(undefined, parentItems),
                domain,
                readerLocation,
                isDraft: false,
            };
            const url = buildLink(config);
            const win = window.open(url, "_blank");
            if (win) {
                win.focus();
            }
        }
    }

    async onChangeOpened(open: boolean): Promise<void> {
        if (open && !this.state.parentItems) {
            const parentItems = await this.getParentItemsPromise;
            const adhocPermissionFlags = calculatePermissionFlags(
                [parentItems],
                this.props.permissions,
                [this.props.item.id],
            );
            const parentPermissionFlags = calculatePermissionFlags(
                [parentItems],
                this.props.permissions,
                [],
            );
            this.setState({
                parentItems,
                permissionFlags: adhocPermissionFlags,
                parentPermissionFlags
            });
        }
    }

    getLicensing(): AccountLicensing {
        const { licensing } = this.state;
        if (licensing.status === WebDataState.SUCCESS) {
            return licensing.data;
        }
        return {} as AccountLicensing;
    }

    /*
        allowLanguageRestriction: allow the presence of a language restriction
        e.g. to check if someone is an editor and not a translator (ie editor for language X), this must be false (= stricter check)
    */
    hasFlag(
        permissionName: PermissionName,
        allowLanguageRestriction = true,
        onlyOnParents = false
    ): boolean {
        const permissionFlags = onlyOnParents ?
            this.state.parentPermissionFlags :
            this.state.permissionFlags;

        const flag = permissionFlags.find(pf => pf.permissionName === permissionName);
        if (!flag) {
            return false;
        }
        if (allowLanguageRestriction) {
            return true;
        }
        return !(flag.languageCodes);
    }

    renderPending(): JSX.Element {
        return <label />;
    }

    renderSuccess(data: Data): JSX.Element[] {
        const { item, modalPlaceholder } = this.props;
        const contextMenu = item.kind === "collection" ?
            this.renderCollectionContextMenu(data) :
            this.renderDocumentContextMenu(data);
        const modals = (
            <div>
                {this.renderDeleteConfirmationModal()}
                {this.renderChooseDestinationAccountIdModal()}
                {this.renderTranslocateItemModal()}
                {this.renderRecursiveActionsModal()}
                {this.renderCreateInstanceModal()}
                {this.renderReadStatsModal(data)}
                {this.renderSharingModal()}
                {this.renderAccessModal(data)}
                {this.renderOwnershipModal()}
                {this.renderAddNewDocumentModal()}
                {this.renderEditCollectionModal(data)}
                {this.renderOverrideLockModal()}
            </div>
        );
        return [
            contextMenu,
            createPortal(modals, modalPlaceholder, "modals"),
        ];
    }

    renderDocumentContextMenu(data: Data): JSX.Element {
        const { accountFeatures } = data;
        const { item: document, history, inCompose, isForActive, modalPlaceholder, userId, canEditAnythingInAccount, t } = this.props;
        const { parentItems, lockedBy } = this.state;
        let canAdmin;
        let canPublish;
        let canEdit;
        let canEditParent;
        let canView;
        if (parentItems) {
            canAdmin = this.hasFlag(PermissionName.ADMIN);
            canEdit = this.hasFlag(PermissionName.EDIT, false);
            canEditParent = this.hasFlag(PermissionName.EDIT, false, true);
            canView = this.hasFlag(PermissionName.VIEW);
            canPublish = this.hasFlag(PermissionName.PUBLISH);
        }
        const { isInstance, id } = document;
        const hasPublications = this.documentHasPublications();
        const { menuStyle, menuIconStyle } = this.getMenuAndIconStyle(isForActive);
        const isLocked = !!lockedBy && lockedBy?.id !== userId;
        const isItemHiddenForMe = isThisItemHidden(accountFeatures, AccountStore.getActiveAccount().canIEdit, canEdit, canView)
        const clickEdit = () => {
            if (isLocked) return;
            history.push(getItemLink(parentItems, document));
        };
        const clickAnalytics = () => history.push(getAnalyticsLink(parentItems, document));
        const clickAccess = () => this.loadDocumentAccess(data);

        const canDelete = canEditParent && (!hasPublications || isInstance);
        let deleteTooltip = "";
        if (!canEditParent) {
            deleteTooltip = t(TK.DocManagement_NotAllowed);
        } else if (!isInstance && hasPublications) {
            deleteTooltip = t(TK.DocManagement_InstanceDeleteDisabledPubs);
        }

        const isReadDisabled = !hasPublications;
        const isEditVisible = !inCompose && !isItemHiddenForMe;
        const isEditDisabled = isLocked;
        const isDeleteVisible = !isItemHiddenForMe;
        const isDeleteDisabled = !canDelete || isLocked;
        const isMoveVisible = !isItemHiddenForMe && canEditAnythingInAccount;
        const isMoveDisabled = (hasPublications && !canPublish) || isLocked;
        const isCreateInstanceVisible = !isItemHiddenForMe && canEditAnythingInAccount && canPublish && !isLocked;
        const isAccessVisible = !isItemHiddenForMe;
        const isAccessDisabled = !canAdmin;
        const isDuplicateVisible = canEditAnythingInAccount;
        const isReadStatsVisible = accountFeatures.includes(FEATURE_READ_REPORTS) && !isItemHiddenForMe;
        const isAnalyticsVisible = accountFeatures.includes(FEATURE_ANALYTICS) && !isItemHiddenForMe && canAdmin;
        const isChecklistsVisible = accountFeatures.includes(FEATURE_CHECKLISTS);

        return (
            <ContextMenu
                container={modalPlaceholder}
                key={`${id}-menu`}
                menuIconName={"more_vert"}
                menuStyle={menuStyle}
                menuIconStyle={menuIconStyle}
                doNotShowUntilResolved={this.getParentItemsPromise}
                onChangeOpened={this.onChangeOpened.bind(this)}
            >
                {isEditVisible && (
                    <MenuItem
                        onClick={clickEdit}
                        title={t(TK.General_Edit)}
                        iconName="edit"
                        disabled={isEditDisabled}
                    />
                )}
                {isDeleteVisible && <MenuItem
                    iconName="delete"
                    onClick={canDelete && this.onClickDelete.bind(this)}
                    title={isInstance ? t(TK.DocManagement_InstanceDelete) : t(TK.General_MoveToTrash)}
                    disabled={isDeleteDisabled}
                    tooltip={deleteTooltip}
                />}
                <MenuItem
                    iconName="chrome_reader_mode"
                    onClick={this.openReaderWindow(id, false)}
                    title={t(TK.DocManagement_ViewInReader)}
                    disabled={isReadDisabled}
                    tooltip={!hasPublications && t(TK.Edit_HistoryNoPublications)}
                />
                {isMoveVisible && (<MenuItem
                    onClick={isLocked ? Function.prototype : this.onMove.bind(this)}
                    title={t(TK.General_Move)}
                    iconName="folder"
                    disabled={isMoveDisabled}
                    tooltip={hasPublications && !canPublish && t(TK.DocManagement_ItemMoveDisabledPerms)}
                />)}
                {isCreateInstanceVisible && (<MenuItem
                    onClick={this.onCreateInstance.bind(this)}
                    title={t(TK.DocManagement_InstanceCreate)}
                    iconName="content_copy"
                />)}
                {isAccessVisible && (
                    <MenuItem
                        onClick={clickAccess}
                        title={t(TK.Acl_AccessTitle)}
                        iconName="person"
                        disabled={isAccessDisabled}
                        tooltip={canAdmin ?
                            t(TK.Acl_AccessTooltipDoc) :
                            t(TK.Acl_AccessTooltipNoPermDoc)
                        }
                    />
                )}
                {accountFeatures.includes(FEATURE_DOCUMENT_OWNER) && (
                    <MenuItem
                        onClick={this.toggleOwnershipModal}
                        title={t(TK.DocOwners_Title)}
                        iconName="person"
                        tooltip={t(TK.DocOwners_TooltipDoc)}
                    />
                )}
                {isDuplicateVisible && (
                    <MenuItem
                        onClick={this.onDuplicate.bind(this)}
                        title={t(TK.DocManagement_Duplicate)}
                        iconName="filter_2"
                    />
                )}
                {isChecklistsVisible && (
                    <MenuItem
                        onClick={() => showModal(
                            ChecklistsActionsModal,
                            { itemId: document.id }
                        )}
                        title={t(TK.Checklists_Progress)}
                        iconName="playlist_add_check"
                    />
                )}
                {isReadStatsVisible && (<MenuItem
                    onClick={this.onShowReadStats.bind(this)}
                    title={t(TK.Analytics_ReadSessions)}
                    iconName="insert_chart"
                />)}
                {isAnalyticsVisible && (
                    <MenuItem
                        onClick={clickAnalytics.bind(this)}
                        title={t(TK.Analytics_Title)}
                        iconName="insert_chart"
                    />
                )}
                {canPublish && accountFeatures.includes(FEATURE_NOTIFICATIONS) && (
                    <MenuItem
                        onClick={() => showModal(NotificationSettingsModal, { item: document })}
                        title={t(TK.Notifications_Settings)}
                        iconName="notifications"
                    />
                )}
                {canAdmin && isUserFeedbackFeature(accountFeatures) && (
                    <MenuItem
                        onClick={() => showModal(ReaderFeedbackSettingsModal, {
                            initialItem: document,
                        })}
                        title={t(TK.ReaderFeedback_Setting)}
                        iconName="comment"
                    />
                )}
            </ContextMenu>
        );
    }

    renderOverrideLockModal(): JSX.Element | "" {
        const { t } = this.props;
        const { showOverrideLockModal } = this.state;
        if (!showOverrideLockModal) {
            return "";
        }
        const onHide = () => this.setState({ showOverrideLockModal: false });
        const onConfirm = async () => {
            this.onOverrideLock();
            await this.onDeleteItem();
            onHide();
        };

        return (
            <Modal
                title={t(TK.Edit_LockInfoSelfTitle)}
                buttons={[
                    <Button key="cancel" secondary text={t(TK.General_Cancel)} onClick={onHide} />,
                    <Button key="ok" text={t(TK.General_Ok)} onClick={onConfirm} />,
                ]}
                onHide={onHide}
            >
                <p>
                    {t(TK.Edit_LockInfoSelf1)}
                </p>
                <p>
                    {t(TK.Edit_LockInfoSelf2)}
                </p>
            </Modal>
        );
    }

    renderDeleteConfirmationModal(): JSX.Element | "" {
        const { isFacingRemoval, removalInProgress } = this.state;
        const { item, t } = this.props;
        const onDelete = this.onDeleteItem.bind(this);
        const cancelDelete = this.cancelDelete.bind(this);
        const buttons = [
            <Button key="yes" text={t(TK.General_Yes)} secondary onClick={onDelete} inactiveWithLoader={removalInProgress} />,
            <Button key="no" text={t(TK.General_No)} onClick={cancelDelete} />,
        ];
        return (isFacingRemoval) ?
            <Modal
                title={t(TK.General_Confirmation)}
                buttons={buttons}
                onHide={cancelDelete}
                onEnterKey={onDelete}
                onEscapeKey={cancelDelete}
            >
                <p>
                    <strong>{extractTitle(item)}</strong>
                </p>
                <p>
                    {t(TK.DocManagement_ItemDeleteConfirm, { itemKind: this.getItemTypeName(item) })}
                </p>
            </Modal> :
            "";
    }

    renderCollectionContextMenu(data: Data): JSX.Element {
        const { accountFeatures } = data;
        const {
            item: collection,
            history,
            isForActive,
            showMyLibraryLink,
            canEditAnythingInAccount,
            t,
        } = this.props;
        const { parentItems, lockedBy } = this.state;
        let canAdmin: boolean;
        let canPublish: boolean;
        let canEdit: boolean;
        let canEditParent: boolean;
        let canView: boolean;

        if (parentItems) {
            canAdmin = this.hasFlag(PermissionName.ADMIN);
            canEdit = this.hasFlag(PermissionName.EDIT, false);
            canEditParent = this.hasFlag(PermissionName.EDIT, false, true);
            canView = this.hasFlag(PermissionName.VIEW);
            canPublish = this.hasFlag(PermissionName.PUBLISH);
        }
        const { id, isInstance, isRootCollection, elements, hasPublications } = collection;
        const isLocked = !!lockedBy;
        const isEmpty = !elements || elements.length === 0;
        const clickAccess = (() => this.loadDocumentAccess(data)).bind(this);
        const clickHide = () => setCollectionIsHidden(collection.id, !collection.isHidden);
        const clickAnalytics = () => history.push(getAnalyticsLink(parentItems, collection));
        const clickBrowse = (() => history.push(getItemLink(parentItems, collection))).bind(this);
        const isItemHiddenForMe = isThisItemHidden(accountFeatures, AccountStore.getActiveAccount().canIEdit, canEdit, canView)

        const { menuStyle, menuIconStyle } = this.getMenuAndIconStyle(isForActive);
        const getCollectionDeleteTooltip = () => {
            if (isRootCollection) {
                return t(TK.DocManagement_ColDeleteFailAccCol);
            }
            if (!isEmpty) {
                return t(TK.DocManagement_ColDeleteFailNonEmpty);
            }
        }
        const clickAddDocument = (() => this.onShowAddNewDocumentModal({ id: collection.id, name: collection.titles[0].title })).bind(this);

        const canDelete = canEditParent && !isRootCollection && (isEmpty || isInstance);
        let deleteTooltip = "";
        if (!canEditParent) {
            deleteTooltip = t(TK.DocManagement_NotAllowed);
        } else if (!isInstance) {
            deleteTooltip = getCollectionDeleteTooltip();
        }

        const isAddDocumentVisible = !isItemHiddenForMe;
        const isAddDocumentDisabled = !canEdit || isLocked;
        const isReadDisabled = isEmpty || !hasPublications;
        const isEditVisible = !isItemHiddenForMe;
        const isEditDisabled = isLocked;
        const isDeleteVisible = !isItemHiddenForMe;
        const isDeleteDisabled = !canDelete || isLocked;
        const isMoveVisible = !isItemHiddenForMe && canEditAnythingInAccount;
        const isMoveDisabled = isRootCollection || isLocked || (hasPublications && !canPublish) || isLocked;
        const isCreateInstanceVisible = !isItemHiddenForMe && !isRootCollection && canEditAnythingInAccount && canPublish && !isLocked;
        const isAccessVisible = !isItemHiddenForMe;
        const isAccessDisabled = !canAdmin;
        const isDuplicateVisible = canEditAnythingInAccount;
        const isDuplicateDisabled = isLocked;
        const isHideVisible = (accountFeatures.includes(FEATURE_COLLECTION_HIDE) && !isItemHiddenForMe);
        const isHideDisabled = !canAdmin;
        const isAnalyticsVisible = accountFeatures.includes(FEATURE_ANALYTICS);
        const isRecursiveActionsVisible = accountFeatures.includes(FEATURE_RECURSIVE_ACTIONS) && !isItemHiddenForMe && canEdit && canPublish && !isRootCollection;
        const isRecursiveActionsDisabled = isLocked;
        const isReadStatsVisible = accountFeatures.includes(FEATURE_READ_REPORTS) && !isItemHiddenForMe;
        const isChecklistsVisible = accountFeatures.includes(FEATURE_CHECKLISTS);

        return (
            <ContextMenu
                key={`${id}-menu`}
                menuIconName={"more_vert"}
                menuStyle={menuStyle}
                menuIconStyle={menuIconStyle}
                onChangeOpened={this.onChangeOpened.bind(this)}
            >
                {showMyLibraryLink && (
                    <MenuItem
                        onClick={clickBrowse.bind(this)}
                        title={t(TK.DocManagement_Browse)}
                        iconName="view_list"
                        tooltip={t(TK.DocManagement_BrowseTooltip)}
                    />
                )}
                {isAddDocumentVisible && (<MenuItem
                    onClick={clickAddDocument}
                    title={t(TK.DocManagement_AddDocument)}
                    disabled={isAddDocumentDisabled}
                    iconName="library_add"
                />)}
                <MenuItem
                    iconName="chrome_reader_mode"
                    onClick={this.openReaderWindow(id, true)}
                    title={t(TK.DocManagement_ViewInReader)}
                    disabled={isReadDisabled}
                    // eslint-disable-next-line no-nested-ternary
                    tooltip={isEmpty ?
                        t(TK.DocManagement_ViewInReaderFailEmpty) :
                        (
                            !hasPublications ? t(TK.DocManagement_ViewInReaderFailNoPubsInCol) : undefined
                        )}
                />
                {isEditVisible && (<MenuItem
                    onClick={this.onEditCollection.bind(this)}
                    title={t(TK.General_Edit)}
                    iconName="edit"
                    disabled={isEditDisabled}
                />)}
                {isDeleteVisible && (<MenuItem
                    iconName="delete"
                    onClick={canDelete && this.onClickDelete.bind(this)}
                    title={isInstance ? t(TK.DocManagement_InstanceDelete) : t(TK.General_MoveToTrash)}
                    disabled={isDeleteDisabled}
                    tooltip={deleteTooltip}
                />)}
                <MenuItem
                    onClick={this.clickRecycleBin.bind(this)}
                    title={t(TK.Trash_RemovedItems)}
                    icon={<FindInTrash className="contextMenu-item-icon customIcon" />}
                    tooltip={t(TK.Trash_ContextInfo)}
                />
                {isMoveVisible && (<MenuItem
                    onClick={this.onMove.bind(this)}
                    title={t(TK.General_Move)}
                    iconName="folder"
                    disabled={isMoveDisabled}
                    tooltip={
                        // eslint-disable-next-line no-nested-ternary
                        isRootCollection ?
                            t(TK.DocManagement_ColMoveFailAccCol) :
                            (
                                (hasPublications && !canPublish) ?
                                    t(TK.DocManagement_ItemMoveDisabledPerms) :
                                    ""
                            )
                    }
                />)}
                {isCreateInstanceVisible && (<MenuItem
                    onClick={this.onCreateInstance.bind(this)}
                    title={t(TK.DocManagement_InstanceCreate)}
                    iconName="content_copy"
                />)}
                {isAccessVisible && (
                    <MenuItem
                        onClick={clickAccess}
                        title={t(TK.Acl_AccessTitle)}
                        iconName="person"
                        disabled={isAccessDisabled}
                        tooltip={canAdmin ? t(TK.Acl_AccessTooltipCol) : t(TK.Acl_AccessTooltipNoPermCol)}
                    />
                )}
                {accountFeatures.includes(FEATURE_DOCUMENT_OWNER) && (
                    <MenuItem
                        onClick={this.toggleOwnershipModal}
                        title={t(TK.DocOwners_Title)}
                        iconName="person"
                        tooltip={t(TK.DocOwners_TooltipCol)}
                    />
                )}
                {isDuplicateVisible && (
                    <MenuItem
                        onClick={this.onDuplicate.bind(this)}
                        title={t(TK.DocManagement_Duplicate)}
                        iconName="filter_2"
                        disabled={isDuplicateDisabled}
                    />)}
                {isChecklistsVisible && (
                    <MenuItem
                        onClick={() => showModal(
                            ChecklistsActionsModal,
                            { itemId: collection.id }
                        )}
                        title={t(TK.Checklists_Progress)}
                        iconName="playlist_add_check"
                    />
                )}
                {isHideVisible && (
                    <MenuItem
                        onClick={clickHide.bind(this)}
                        title={`${collection.isHidden ? t(TK.DocManagement_ColShowInReader) : t(TK.DocManagement_ColHideInReader)}`}
                        disabled={isHideDisabled}
                        iconName={collection.isHidden ? "visibility_on" : "visibility_off"}
                        tooltip={canAdmin ? undefined : t(TK.Acl_AccessTooltipNoPermCol)}
                    />
                )}
                {isAnalyticsVisible && !isItemHiddenForMe && canAdmin && (
                    <MenuItem
                        onClick={clickAnalytics}
                        title={t(TK.Analytics_Title)}
                        iconName="insert_chart"
                    />
                )}
                {isReadStatsVisible && (<MenuItem
                    onClick={this.onShowReadStats.bind(this)}
                    title={t(TK.Analytics_ReadSessions)}
                    iconName="insert_chart"
                />)}
                {isRecursiveActionsVisible && (
                    <MenuItem
                        onClick={this.showRecursiveActionsModal.bind(this)}
                        title={t(TK.Edit_RecursiveActions)}
                        iconName="cached"
                        disabled={isRecursiveActionsDisabled}
                    />
                )}
                {canPublish && accountFeatures.includes(FEATURE_NOTIFICATIONS) && (
                    <MenuItem
                        onClick={() => showModal(NotificationSettingsModal, { item: collection })}
                        title={t(TK.Notifications_Settings)}
                        iconName="notifications"
                    />
                )}
                {canAdmin && isUserFeedbackFeature(accountFeatures) && (
                    <MenuItem
                        onClick={() => showModal(ReaderFeedbackSettingsModal, {
                            initialItem: collection,
                        })}
                        title={t(TK.ReaderFeedback_Setting)}
                        iconName="comment"
                    />
                )}
            </ContextMenu>
        );
    }

    renderCreateInstanceModal(): JSX.Element {
        const { isCreateInstanceModalShown, accountId } = this.state;
        const { item } = this.props;
        if (isCreateInstanceModalShown) {
            const properParentsForTreeNavigator = this.getProperParentsForTreeNavigator();
            return (
                <CreateInstanceModal
                    onHide={this.onCloseCreateDocumentInstance.bind(this)}
                    history={this.props.history}
                    parentItems={properParentsForTreeNavigator}
                    permissionMap={{ permissions: this.props.permissions }}
                    item={item}
                    accountId={accountId}
                />
            );
        }
        return null;
    }

    renderReadStatsModal(data: Data): JSX.Element {
        const { accountFeatures } = data;
        const { isReadStatsModalShown, accountId } = this.state;
        const { item } = this.props;
        if (isReadStatsModalShown) {
            return (
                <ReadStatsModal
                    onHide={this.onCloseReadStats.bind(this)}
                    accountId={accountId}
                    item={item}
                    accountFeatures={accountFeatures}
                />
            );
        }
        return null;
    }

    renderChooseDestinationAccountIdModal(): JSX.Element {
        const { isChooseDestinationAccountIdModalShown, accountId, myEditAccessAccounts } = this.state;
        return isChooseDestinationAccountIdModalShown && (
            <AllAccounts
                activeAccountId={accountId}
                accounts={myEditAccessAccounts}
                onClose={this.hideChooseDestinationAccountIdModal.bind(this)}
                onSelectAccount={this.onSelectTranslocateDestinationAccountId.bind(this)}
                isActiveSelectable={true}
            />
        );
    }

    renderTranslocateItemModal(): JSX.Element {
        const { history, item, livesInLibraryItem } = this.props;
        const {
            isTranslocateItemModalShown,
            translocateOperation,
            translocatingItem,
            translocateDestinationAccountInfo,
            translocateDestinationParentItems,
            translocateDestinationPermissionMap,
            parentItems,
            breadcrumbsData,
        } = this.state;
        if (!isTranslocateItemModalShown) {
            return null;
        }
        const hasPublications = item.hasPublications || this.documentHasPublications();
        return (
            <TranslocateItem
                accountInfo={translocateDestinationAccountInfo}
                onHide={this.onHideTranslocateItemModal.bind(this)}
                item={translocatingItem}
                history={history}
                parentItems={translocateDestinationParentItems}
                operation={translocateOperation}
                permissionMap={translocateDestinationPermissionMap}
                itemHasPublications={hasPublications}
                livesInLibraryItem={livesInLibraryItem}
                sourceCollection={parentItems[parentItems.length - 1]}
                breadcrumbsData={breadcrumbsData}
            />
        );
    }

    renderSharingModal(): JSX.Element {
        return this.state.fullBinder && this.state.isSharingModalShown && (
            <ComposerSharingModal
                hide={() => {
                    this.setState({
                        isSharingModalShown: false,
                    })
                }}
                binder={this.state.fullBinder}
            />
        );
    }

    renderAddNewDocumentModal(): JSX.Element {
        const { defaultCreationLanguage } = this.state;
        const defaultLanguageSettings = defaultCreationLanguage.result.languages &&
            defaultCreationLanguage.result.languages.defaultCode;
        if (this.state.isNewDocumentModalShown) {
            const properParentsForTreeNavigator = this.getProperParentsForTreeNavigator();
            return (
                <AddNewDocument
                    defaultLanguageSettings={defaultLanguageSettings}
                    onModalHide={this.onCloseAddNewDocumentModal.bind(this)}
                    parentItems={properParentsForTreeNavigator}
                    onClose={this.onAddNewDocument().bind(this)}
                    onAddNewDocument={this.onAddNewDocument().bind(this)}
                />
            )
        }
        return null;
    }

    renderOwnershipModal(): JSX.Element {
        return this.state.isOwnershipModalShown && (
            <OwnershipModal
                onHide={this.toggleOwnershipModal.bind(this)}
                item={this.props.item}
            />
        );
    }

    renderAccessModal(data: Data): JSX.Element {
        const { accountRoles, accountFeatures, adminGroup } = data;
        const {
            accountId,
            permissionMap: { permissions },
            userAccessData,
            isPublicToggleActive,
        } = this.state;
        const { currentUser, item } = this.props;
        const allData = userAccessData.get(item.id);
        const acls = buildAclsList(permissions, accountRoles);
        // mark your own user(admin) or admin usergroup not changeable
        const assignees = allData && allData.assignees.map((aclItem) => {
            return (aclItem.id === currentUser?.user.id ||
                (adminGroup && aclItem.id === adminGroup)) ?
                { ...aclItem, isInheritedAcl: true } :
                aclItem;
        });

        return this.state.isChangeAccessModalShown && (
            <AccessModal
                accountRoles={accountRoles}
                isPublicToggleActive={isPublicToggleActive}
                accountId={accountId}
                hidden={!this.state.isChangeAccessModalShown}
                onUnmount={this.onAccessModalUnmount.bind(this)}
                onHide={this.onCloseAccessModal.bind(this)}
                allData={assignees}
                isPublic={allData.isPublic}
                onItemRemove={this.buildOnUserAccessRemoval(data).bind(this)}
                onNewItemAdd={this.buildOnUserAccessAdd(data).bind(this)}
                onToggleItemPublic={(() => this.onToggleItemPublic(allData.isPublic)).bind(this)}
                item={item}
                showInOverview={allData.showInOverview}
                setShowInOverview={(() => this.setShowInOverview(item, allData.showInOverview)).bind(this)}
                acls={acls}
                onChangeAccess={this.onChangeAccess.bind(this)}
                featuresPublicContent={accountFeatures.includes(FEATURE_PUBLICCONTENT)}
                featuresTranslatorRole={accountFeatures.includes(FEATURE_TRANSLATOR_ROLE)}
                featuresDialects={accountFeatures.includes(FEATURE_DIALECTS)}
                licensing={this.getLicensing()}
                isPublicTogglesLoading={allData.isLoading}
            />
        );
    }

    renderEditCollectionModal(data: Data): JSX.Element {
        const { isEditCollectionModalShown, editCollectionInitialTabIndex } = this.state;
        if (!isEditCollectionModalShown) {
            return null;
        }
        const { item, modalPlaceholder, isForActive } = this.props;
        const { accountSettings, accountFeatures } = data;
        const translatorLanguages = this.getTranslatorLanguageCodes(accountFeatures);

        return (
            <EditCollectionForm
                collectionId={item.id}
                modalPlaceholder={modalPlaceholder}
                onClose={this.onCloseEditCollectionForm.bind(this)}
                accountSettings={accountSettings}
                collectionObject={item}
                onDoubleClickVisual={this.onDoubleClickVisual.bind(this)}
                translatorLanguages={translatorLanguages}
                isForActive={isForActive}
                initialTabIndex={editCollectionInitialTabIndex}
            />
        )
    }

    getTranslatorLanguageCodes(accountFeatures: AccountFeatures): string[] {
        const { permissionFlags } = this.state;
        if (!accountFeatures.includes(FEATURE_TRANSLATOR_ROLE)) {
            return [];
        }
        return permissionFlags
            .find(pf => pf.permissionName === PermissionName.EDIT)
            ?.languageCodes ?? [];
    }

    render(): JSX.Element {
        return this.renderWebData(this.state.data);
    }

    renderFailure(_error: Error, _incompleteData: unknown): JSX.Element {
        return <div>{this.props.t(TK.General_SomethingWentWrong)}</div>;
    }
}

const container = Container.create(fixES5FluxContainer(ItemContextMenu), { withProps: true }) as React.ComponentType<ItemContextMenuProps>;
const containerWithHooks = withHooks(container, () => ({
    activeCollection: useActiveCollection(),
    breadcrumbsData: useActiveBrowsePathWebData(),
    currentUser: useMyDetails(),
    isPublicInfo: useDocumentsPublicInfo(),
    lockedItems: useItemLocks(),
    parentCollectionIds: useActiveParentCollections(),
    userId: useCurrentUserId(),
    visualModal: useVisualModal(),
    accountUsergroups: useGetAccountUsergroupsIncludingAutoManaged().data,
    accountUsers: useAccountUsersOrEmpty(),
    canEditAnythingInAccount: useHasFullPermissionAnywhere(),
    permissions: useMyPermissionMapOrEmpty(),
}));
export default withTranslation()(containerWithHooks);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function getAnalyticsLink(rest, item): string {
    const { id, kind } = item;
    const path = `analytics/${kind}`;
    const previous = rest.length > 0 ? `/${rest.map(({ id }) => id).join("/")}` : "";
    return `/${path}${previous}/${id}`;
}

const READER_FEEDBACK_FEATURES = [FEATURE_READER_COMMENTING, FEATURE_READER_RATING, FEATURE_READ_CONFIRMATION] as const;
function isUserFeedbackFeature(accountFeatures: AccountFeatures): boolean {
    return READER_FEEDBACK_FEATURES.some(feature => accountFeatures.includes(feature));
}
