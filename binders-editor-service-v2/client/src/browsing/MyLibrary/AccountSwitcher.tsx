import * as React from "react";
import { Account, FEATURE_READONLY_EDITOR } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useActiveAccountFeatures, useActiveAccountId } from "../../accounts/hooks";
import { useLogout, useSwitchAccount } from "../hooks";
import AccountStore from "../../accounts/store";
import { AccountSwitcherElement } from "@binders/ui-kit/lib/elements/ResponsiveLayout/ResponsiveLayout";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { WebDataState } from "@binders/client/lib/webdata";
import { getLastUsedAccountIds } from "../../accounts/actions";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";
import { useIsAdminImpersonatedSession } from "../../stores/impersonation-store";
import { useMemo } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./AccountSwitcher.styl";

/**
 * Configures how many accounts will be displayed in the account switcher
 */
const NUMBER_OF_ACCOUNTS_TO_INCLUDE = 3;

export const AccountSwitcher = ({
    allAccountsAction,
    hideAccountSwitcher,
}: {
    allAccountsAction?: () => void;
    hideAccountSwitcher: boolean;
}) => {
    const activeAccountId = useActiveAccountId();
    const accountFeatures = useActiveAccountFeatures();
    const isAdminImpersonatedSession = useIsAdminImpersonatedSession();
    const { t } = useTranslation();
    const myAccountsWD = useFluxStoreAsAny(AccountStore, (_, store) => store.myAccounts());
    const myAccountsOrEmpty = myAccountsWD.state === WebDataState.SUCCESS ? myAccountsWD.data : [];
    const accounts = accountFeatures.includes(FEATURE_READONLY_EDITOR) ?
        sortAccounts(myAccountsOrEmpty) :
        sortAccounts(myAccountsOrEmpty).filter(account => account.canIEdit);

    const { accountSwitcherElements, horizontalRulePosition } = useMemo(() => {
        const currentAccount = accounts.find(account => account.id === activeAccountId);
        const accountsToDisplay = hideAccountSwitcher || !currentAccount ?
            [] :
            [currentAccount, ...getAdditionalAccountsToDisplay(accounts, currentAccount)];
        const notAllAccountsAreDisplayed = accounts.length > NUMBER_OF_ACCOUNTS_TO_INCLUDE;

        const accountSwitcherElements: AccountSwitcherElement[] = accountsToDisplay
            .map((account, index) => asAccountSwitcherElement(account, index, t));

        if (notAllAccountsAreDisplayed) {
            accountSwitcherElements.push({ id: "accounts", label: t(TK.Account_ViewAll) });
        }

        if (!isAdminImpersonatedSession) {
            accountSwitcherElements.push({ id: "logout", label: t(TK.General_Logout) });
        }

        return {
            accountSwitcherElements,
            horizontalRulePosition: notAllAccountsAreDisplayed ? accountSwitcherElements.length - 2 : accountSwitcherElements.length - 1,
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accounts, activeAccountId, hideAccountSwitcher])

    const switchAccount = useSwitchAccount();
    const logout = useLogout();

    const onSelectElement = React.useCallback((id: string) => {
        switch (id) {
            case "accounts":
                allAccountsAction();
                break;
            case "logout":
                logout();
                break;
            default:
                switchAccount?.(accountSwitcherElements[id]?.accountId);
        }
    }, [accountSwitcherElements, allAccountsAction, logout, switchAccount]);

    if (hideAccountSwitcher) return null;

    return <Dropdown
        type="Account"
        elements={accountSwitcherElements}
        dropUp={false}
        showBorders={false}
        selectedElementId={0}
        onSelectElement={onSelectElement}
        horizontalRulePositions={[horizontalRulePosition]}
        floatingElements={true}
        className="account-switcher topBar-helpIcon"
        unselectableElements={true}
    />
}

const accountCmp = (left: Account, right: Account): number => {
    return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
}

const sortAccounts = (accounts: Account[]): Account[] => {
    const lastUsed: string[] = getLastUsedAccountIds();
    lastUsed.reverse();
    const used: Account[] = [];
    const toSortAlphabetically = [...accounts];
    lastUsed.forEach(lastUsedId => {
        const lastUsedIndex = toSortAlphabetically.findIndex(a => a && a.id === lastUsedId)
        if (lastUsedIndex > -1) {
            used.push(toSortAlphabetically[lastUsedIndex]);
            delete toSortAlphabetically[lastUsedIndex];
        }
    })
    const sortedAlphabetically = toSortAlphabetically.sort(accountCmp);
    return used.concat(sortedAlphabetically);
}

const getAdditionalAccountsToDisplay = (allAccounts: Account[], currentAccount: Account): Account[] =>
    allAccounts
        .filter(account => account?.id !== currentAccount.id)
        .slice(0, NUMBER_OF_ACCOUNTS_TO_INCLUDE - 1);

const asAccountSwitcherElement = (account: Account, id: number, t: TFunction): AccountSwitcherElement => {
    return {
        accountId: account.id,
        avatar: account.thumbnail?.["buildRenderUrl"]?.({ requestedFormatNames: ["thumbnail"] }),
        fitBehaviour: account.thumbnail?.fitBehaviour,
        id: `${id}`,
        label: `${account.name}${account.accountIsNotExpired ? "" : ` (${t(TK.Account_Expired)})`}`,
        bgColor: account.thumbnail?.bgColor,
        rotation: account.thumbnail?.rotation,
    };
}

