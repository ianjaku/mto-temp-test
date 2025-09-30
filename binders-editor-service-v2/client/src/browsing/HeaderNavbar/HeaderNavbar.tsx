import * as React from "react";
import {
    Account,
    FEATURE_ACCOUNT_ANALYTICS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { AddNewButtonModals, useAddNewButton } from "../MyLibrary/AddNewButton";
import { BottomBar, useIsBottomBarVisible } from "../MyLibrary/BottomBar";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    INavbarMenuItem,
    NavbarMenuItemType,
} from "@binders/ui-kit/lib/elements/navbar";
import { useActiveAccount, useCurrentDomain } from "../../accounts/hooks";
import { ACCOUNT_ANALYTICS_ROUTE } from "../../analytics/routes";
import { AccountSwitcher } from "../MyLibrary/AccountSwitcher";
import AllAccounts from "../../accounts/AllAccounts";
import { BROWSE_ROUTE } from "../MyLibrary/routes";
import { COMPOSER_ROUTE } from "../../documents/Composer/routes";
import { HOME_PAGE_ROUTE } from "../../home/routes";
import { NavbarCreateButton } from "@binders/ui-kit/lib/elements/navbar/NavbarMenuItemElement";
import ResponsiveLayout from "@binders/ui-kit/lib/elements/ResponsiveLayout";
import { SETTINGS_ROUTE } from "../../accounts/AccountSettings/routes";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { TRASH_ROUTE } from "../../trash/routes";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { TopBar } from "../MyLibrary/TopBar";
import { USERS_ROUTE } from "../../users/Users/routes";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { isThisItemHidden } from "../../shared/helper";
import { useHasFullPermissionAnywhere } from "../../authorization/hooks";
import { useIsHomePageEnabled } from "../../home/hooks";
import { useLayoutStoreState } from "../../stores/layout-store";
import { useSwitchAccount } from "../hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./HeaderNavbar.styl";

export function useNavbarElements(
    accountFeatures: string[],
    activeAccount: Account,
    showCreateLink: boolean,
    toggleAddNewMenu: () => void,
): {
    bottomNavbarElements: INavbarMenuItem[];
    elements: INavbarMenuItem[];
    createButtonRef: React.MutableRefObject<HTMLButtonElement | null>;
} {
    const isHomePageEnabled = useIsHomePageEnabled();
    const { t } = useTranslation();
    const createButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const { amIAdmin, canIEdit, canIAccessUsergroupsMgmt, canIAccessImportUsersMgmt, canIAccessAnalytics } = activeAccount ?? {};
    const showUsers = (amIAdmin || canIAccessUsergroupsMgmt || canIAccessImportUsersMgmt) && !isMobileView();
    const showAccountAnalytics = canIAccessAnalytics && accountFeatures.includes(FEATURE_ACCOUNT_ANALYTICS);
    const isReadonlyEditor = isThisItemHidden(accountFeatures, canIEdit);
    const elements: INavbarMenuItem[] = [];
    const bottomNavbarElements: INavbarMenuItem[] = [];
    const domain = useCurrentDomain();
    const readerLocation = getReaderLocation(domain);

    if (!isReadonlyEditor && showCreateLink) {
        elements.push({
            label: t(TK.DocManagement_Create),
            link: COMPOSER_ROUTE,
            type: NavbarMenuItemType.create,
            element: <NavbarCreateButton
                ref={createButtonRef}
                isDisabled={!canIEdit}
                label={t(TK.DocManagement_Create)}
                onClick={toggleAddNewMenu}
            />
        });
    }
    if (isHomePageEnabled) {
        elements.push({
            label: t(TK.General_Home),
            link: HOME_PAGE_ROUTE,
            type: NavbarMenuItemType.home,
        });
    }
    elements.push({
        label: t(TK.myLibrary),
        link: BROWSE_ROUTE,
        type: NavbarMenuItemType.myLibrary
    });
    if (showAccountAnalytics && !isReadonlyEditor) {
        elements.push({
            label: t(TK.Analytics_Title),
            link: ACCOUNT_ANALYTICS_ROUTE,
            type: NavbarMenuItemType.analytics
        });
    }
    if (showUsers) {
        elements.push({
            label: t(TK.User_Users),
            link: USERS_ROUTE,
            type: NavbarMenuItemType.users
        });
    }
    elements.push({
        label: t(TK.Trash_RecycleBin),
        link: TRASH_ROUTE,
        type: NavbarMenuItemType.trash
    });
    elements.push({
        label: t(TK.General_ReaderView),
        link: readerLocation,
        type: NavbarMenuItemType.reader
    });
    if (amIAdmin) {
        bottomNavbarElements.push({
            label: t(TK.General_Settings),
            link: SETTINGS_ROUTE,
            type: NavbarMenuItemType.settings
        });
    }

    return {
        elements,
        bottomNavbarElements,
        createButtonRef,
    };
}

export type HeaderNavbarProps = {
    accounts: Account[];
    accountFeatures: string[];
    children: React.ReactNode[] | React.ReactNode;
    hideAccountSwitcher: boolean;
    helpAccount?: Account;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = (props) => {
    const [showAllAccounts, setShowAllAccounts] = React.useState(false);
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);
    const activeAccount = useActiveAccount();
    const showCreateLink = useHasFullPermissionAnywhere();

    const {
        accountFeatures,
        accounts,
        children,
        helpAccount,
        hideAccountSwitcher,
    } = props;

    const addNewButtonProps = useAddNewButton();

    const { createButtonRef, elements: navbarElements, bottomNavbarElements } = useNavbarElements(
        accountFeatures,
        activeAccount,
        showCreateLink,
        addNewButtonProps.toggleMenuOpen
    );
    const headerImage = activeAccount.thumbnail as Thumbnail;

    const switchAccount = useSwitchAccount();

    const activateMenuItem = (itemType: NavbarMenuItemType) => {
        captureFrontendEvent(EditorEvent.NavbarButtonClicked, { button: itemTypeToName(itemType) })
        setIsMobileDrawerOpen(false);
    }

    const isBottomBarVisible = useIsBottomBarVisible();
    const headerTailElement = useLayoutStoreState(state => state.headerTailElement);

    if (showAllAccounts) {
        return (
            <AllAccounts
                activeAccountId={activeAccount.id}
                accounts={accounts}
                onClose={() => setShowAllAccounts(false)}
                onSelectAccount={switchAccount}
            />
        );
    }

    return (
        <ResponsiveLayout
            activateMenuItem={activateMenuItem}
            bottomItems={bottomNavbarElements}
            headerElement={isMobileView() ?
                <AccountSwitcher
                    allAccountsAction={() => setShowAllAccounts(true)}
                    hideAccountSwitcher={hideAccountSwitcher}
                /> :
                null
            }
            headerImage={headerImage}
            headerTailElement={headerTailElement}
            helpAccount={helpAccount}
            isMobileDrawerOpen={isMobileDrawerOpen}
            items={navbarElements}
            setIsMobileDrawerOpen={setIsMobileDrawerOpen}
        >
            <TopBar
                allAccountsAction={() => setShowAllAccounts(true)}
                hideAccountSwitcher={hideAccountSwitcher}
            />
            {isMobileView() && isBottomBarVisible ? <BottomBar /> : null}
            {children}
            <AddNewButtonModals
                anchorRef={createButtonRef.current}
                {...addNewButtonProps}
            />
        </ResponsiveLayout>
    );
}

function itemTypeToName(item: NavbarMenuItemType): string {
    switch (item) {
        case NavbarMenuItemType.create: return "NEW";
        case NavbarMenuItemType.myLibrary: return "LIBRARY";
        case NavbarMenuItemType.users: return "USERS";
        case NavbarMenuItemType.analytics: return "ANALYTICS";
        case NavbarMenuItemType.trash: return "TRASH";
        case NavbarMenuItemType.reader: return "READER";
        case NavbarMenuItemType.home: return "HOME";
        case NavbarMenuItemType.settings: return "SETTINGS";
        default: return "UNKNOWN";
    }
}

export default HeaderNavbar;
