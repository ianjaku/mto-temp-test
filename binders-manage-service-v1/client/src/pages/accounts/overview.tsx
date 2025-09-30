import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/dropdown-menu";
import {
    NOT_AVAILABLE_DATE,
    fmtDate,
    parseDateFromString
} from "@binders/client/lib/util/date";
import {
    maybeDate,
    maybeDifferenceInDays,
    maybeIsAfter,
    maybeMinDate
} from "@binders/client/lib/date/maybeDateFns";
import { toastStyles, useToast } from "../../components/use-toast";
import { useCallback, useEffect, useState } from "react";
import { useListAccounts, useSetAccountDomains } from "../../api/hooks";
import { APIAccountsLastUsageInformation } from "../../api/trackingService";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountLastUsageInformation } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { AccountsActions } from "../../actions/accounts";
import { Button } from "../../components/button";
import FontAwesome from "react-fontawesome";
import { Input } from "../../components/input";
import { SearchAwareText } from "../../search/SearchAwareText";
import { SearchTable } from "../../search/SearchTable";
import { browserHistory } from "react-router";
import { cn } from "../../cn";
import { useQuery } from "@tanstack/react-query";

function useAccountsLastUsageInformation(accounts: Account[]) {
    const accountIds = accounts.map(a => a.id);
    return useQuery({
        queryFn: () => APIAccountsLastUsageInformation(accountIds),
        queryKey: ["accounts-last-usage-info", ...accountIds],
        enabled: accountIds.length > 0,
    })
}

export const AccountsOverview = () => {
    const accounts = useListAccounts();
    const { data: lastUsageInfo, isSuccess: hasLoadedLastUsageInfo } = useAccountsLastUsageInformation(accounts.data ?? []);

    const loadingView = accounts.isLoading ?
        <div className="entityTable is-loading">
            <p>This shouldn't take long</p>
        </div> :
        null;

    const errorView = accounts.isError ?
        <div className="entityTable is-failed">
            <p>An error occurred. You can try and reload the table.</p>
        </div> :
        null;

    const emptyView = !accounts.data?.length ?
        <div className="entityTable is-failed">
            <p>No matching users found...</p>
        </div> :
        null;

    return <>
        <ContentTitleRow title="Account overview">
            <ContentTitleAction icon="refresh" label="Reload" variant="outline" handler={() => { }} />
            <ContentTitleAction icon="plus" label="Create" handler={() => browserHistory.push("/accounts/create")} />
        </ContentTitleRow>

        {loadingView ?? errorView ?? emptyView ?? (
            <div className="acc-table flex flex-col gap-4">
                <SearchTable
                    render={account => <AccountRow
                        account={account}
                        lastUsageInfo={hasLoadedLastUsageInfo ? lastUsageInfo?.[account.id] : undefined}
                    />}
                    data={accounts.data}
                    config={{
                        index: ["name", "domains", "subscriptionType"],
                        boost: { name: 2 }
                    }}
                    headers={[
                        { label: "Account ID", sort: true, get: a => a.id },
                        { label: "Name", sort: true, get: a => a.name },
                        { label: "Users", sort: true, get: a => a.members.length },
                        "Plan",
                        { label: "Expiration Date", sort: true, get: a => a.expirationDate },
                        { label: "Domains", sort: true, get: a => a.domains[0] },
                        "Last Read Date",
                        "Last Edit Date",
                        "",
                    ]}
                />
            </div>
        )}</>;
}

const AccountRow = ({ account, lastUsageInfo }: {
    account: Account;
    lastUsageInfo: AccountLastUsageInformation;
}) => {
    const today = maybeDate(new Date());
    const readerExpirationDate = maybeDate(account.readerExpirationDate);
    const editorExpirationDate = maybeDate(account.expirationDate);
    const isExpired = maybeIsAfter(today, maybeMinDate([editorExpirationDate, readerExpirationDate])).getOrElse(false);
    const editorExpiresIn = maybeDifferenceInDays(editorExpirationDate, today).getOrElse(Infinity);
    const readerExpiresIn = maybeDifferenceInDays(readerExpirationDate, today).getOrElse(Infinity);
    const warningLimitDays = 31
    let accountStateClass = "text-foreground";
    if (
        editorExpiresIn <= warningLimitDays && editorExpiresIn > 0 ||
        account.readerExpirationDate &&
        readerExpiresIn <= warningLimitDays &&
        readerExpiresIn > 0
    ) {
        accountStateClass += " text-warning";
    } else if (isExpired) {
        accountStateClass += " text-destructive";
    }
    const [isEditingDomains, setIsEditingDomains] = useState(false);
    const [editedDomainsCsv, setEditedDomainsCsv] = useState(account.domains.join(","));
    const setDomainsForAccount = useSetAccountDomains()
    const { toast } = useToast();
    useEffect(() => {
        setEditedDomainsCsv(account.domains.join(","));
    }, [account.domains]);

    const save = useCallback(() => {
        setDomainsForAccount.mutate({
            accountId: account.id,
            domains: editedDomainsCsv.split(",").filter(s => s.length),
        }, {
            onError: () => {
                toast({
                    className: toastStyles.error,
                    title: "Update failed",
                    description: `Invalid account domains: ${editedDomainsCsv}`,
                });
                setIsEditingDomains(false);
            },
            onSuccess: () => {
                toast({
                    className: toastStyles.info,
                    title: "Domain updated",
                    description: <>Updated domains <strong>{editedDomainsCsv}</strong> for account <strong>{account.name}</strong></>,
                });
                setIsEditingDomains(false);
            },
        });
    }, [account.id, account.name, editedDomainsCsv, setDomainsForAccount, toast]);

    const domains = account.domains.map(d => [(<label key={`dmn-${d}`}><SearchAwareText>{d}</SearchAwareText></label>), <br key={`br-${d}`} />]);
    const loadingView = setDomainsForAccount.isLoading ?
        <div className="italic text-muted-foreground inline-flex gap-2 items-center"><FontAwesome name="spinner" /> Saving...</div> :
        null;
    const emptyView = domains.length === 0 ?
        <Button
            variant="ghost"
            size="sm"
            className="italic text-muted-foreground inline-flex gap-2 items-center"
            onClick={() => setIsEditingDomains(true)}
        ><FontAwesome name="pencil" />Click to add</Button> :
        null;
    const editingView = isEditingDomains ?
        <div>
            <Input
                autoFocus={true}
                type="text"
                placeholder="domains csv"
                onBlur={() => save()}
                onChange={e => setEditedDomainsCsv(e.currentTarget.value)}
                value={editedDomainsCsv}
                onKeyDown={e => { if (e.keyCode === 13) save(); }}
            />
        </div> :
        null;
    const domainsRecord = loadingView ?? editingView ?? emptyView ?? <span onClick={() => setIsEditingDomains(true)}>{domains}</span>

    return (
        <tr key={account.id} className={cn(
            accountStateClass,
            "bg-white border-b border-gray-200 hover:bg-gray-50",
        )}>
            <td className="acc-id text-muted-foreground text-xs px-2 py-1"><SearchAwareText>{account.id}</SearchAwareText></td>
            <td className="acc-name px-2 py-1"><SearchAwareText>{account.name}</SearchAwareText></td>
            <td className="text-sm px-2 py-1"><SearchAwareText>{account.members.length}</SearchAwareText></td>
            <td className="text-sm px-2 py-1"><SearchAwareText>{account.subscriptionType}</SearchAwareText></td>
            <td className="text-sm px-2 py-1"><SearchAwareText>{formatDate(account.expirationDate)}</SearchAwareText></td>
            <td className="acc-domains text-sm px-2 py-1">{domainsRecord}</td>
            <td className="text-sm px-2 py-1">{lastUsageInfo ? formatDate(lastUsageInfo?.readDate) : <span className="text-muted-foreground">N/A</span>}</td>
            <td className="text-sm px-2 py-1">{lastUsageInfo ? formatDate(lastUsageInfo?.editDate) : <span className="text-muted-foreground">N/A</span>}</td>
            <td className="px-2 py-1 inline-flex gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><FontAwesome name="ellipsis-h" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => AccountsActions.switchToAccountEditDetails(account.id)}><FontAwesome name="pencil" />Edit details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => AccountsActions.switchToAccountMembers(account.id)}><FontAwesome name="users" />Manage users</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => AccountsActions.switchToAccountAdmins(account.id)}><FontAwesome name="shield" />Manage admins</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => AccountsActions.switchToFeatures(account.id)}><FontAwesome name="list" />Feature flags</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </td>
        </tr>
    );
}

const formatDate = (dateStr: string): string => {
    const date = parseDateFromString(dateStr);
    return date ? fmtDate(date, "MMM dd, yyyy") : NOT_AVAILABLE_DATE;
}

