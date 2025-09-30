import * as React from "react";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import {
    useDeleteReaderBranding,
    useListAccounts,
    useListBrandings,
    useListDomainFilters,
} from "../../api/hooks";
import { Button } from "../../components/button";
import { ContentTitleRow } from "../maintitle";
import FontAwesome from "react-fontawesome";
import { SearchAwareText } from "../../search/SearchAwareText";
import { SearchTable } from "../../search/SearchTable";
import { browserHistory } from "react-router";
import { cn } from "../../cn";

export const BrandingsOverview = () => {
    const accounts = useListAccounts();
    const domainFilters = useListDomainFilters();
    const brandings = useListBrandings();
    const deleteBranding = useDeleteReaderBranding();

    const isLoading = accounts.isLoading || domainFilters.isLoading || brandings.isLoading;

    const hasDomains = domainFilters.data?.length > 0;

    const data = domainFilters.data?.map(
        (entity) => {
            const account = accounts.data?.find(({ id }) => id === entity.accountId);
            const accountName = account ? account.name : entity.accountId;
            const domainBranding = brandings.data?.find(branding => branding.domain === entity.domain);
            if (!domainBranding) {
                return {
                    ...entity,
                    accountName,
                    domainBranding: undefined,
                    id: `${entity.domainFilterId}_${entity.accountId}_${entity.domainCollectionId}`,
                }
            }

            return {
                ...entity,
                accountName,
                domainBranding,
                domainBrandingName: domainBranding.name || domainBranding.id,
                id: `${entity.domainFilterId}_${entity.accountId}_${entity.domainCollectionId}`,
            };
        }
    ) ?? [];

    const loadingView = isLoading ? <div>Loading ...</div> : null
    const emptyView = !hasDomains ? <div>No domains found for account</div> : null;

    return (
        <div className="container">
            <ContentTitleRow title="Branding" />
            {loadingView ?? emptyView ?? (
                <SearchTable
                    render={domainFilter => {
                        const { accountId, domain, accountName, domainBranding } = domainFilter;

                        return (
                            <tr key={domainFilter.id} className={tableRowStyles.base}>
                                <td className={tableCellStyles.base}><SearchAwareText>{accountName}</SearchAwareText></td>
                                <td className={cn("br-domain", tableCellStyles.base)}><SearchAwareText>{domain}</SearchAwareText></td>
                                <td className={tableCellStyles.base}>
                                    <SearchAwareText>
                                        {domainBranding ? (domainBranding.name || domainBranding.id) : ""}
                                    </SearchAwareText>
                                </td>
                                <td className={tableCellStyles.actions}>
                                    {domainBranding && (
                                        <div className="flex flex-row gap-2 items-center">
                                            <Button size="icon" variant="ghost" title="Edit custom branding" onClick={() => browserHistory.push(`/branding/edit/${accountId}/${domainBranding.id}`)}>
                                                <FontAwesome name="pencil-square-o" />
                                            </Button>
                                            <Button size="icon" variant="ghost" title="Remove custom branding" onClick={() => {
                                                if (confirm(`This will delete branding for account ${accountName}. Continue?`)) {
                                                    deleteBranding.mutate(domainBranding);
                                                }
                                            }}>
                                                <FontAwesome name="trash-o" />
                                            </Button>
                                        </div>
                                    )}
                                    {!domainBranding && (
                                        <div className="flex flex-row gap-2 items-center">
                                            <Button size="icon" variant="ghost" title="Add custom branding" onClick={() => {
                                                const accountPath = accountId ? `/${accountId}/` : "/";
                                                browserHistory.push(`/branding${accountPath}new`);
                                            }}>
                                                <FontAwesome name="plus" />
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            </tr >
                        );
                    }}
                    data={data}
                    config={{
                        index: ["domain", "accountId", "accountName", "domainBrandingName"],
                    }}
                    headers={[
                        {
                            label: "Account",
                            sort: true,
                            get: (a) => {
                                const account = accounts.data?.find(({ id }) => id === a.accountId);
                                const accountName = account ? account.name : a.accountId;
                                return accountName;
                            },
                        },
                        {
                            label: "Domain",
                            sort: true,
                            get: "domain",
                        },
                        {
                            label: "Style",
                            sort: true,
                            get: (a) => {
                                const branding = brandings.data?.find(branding => branding.domain === a.domain);
                                return branding && (branding.name || branding.id) || "";
                            },
                        },
                        "Actions",
                    ]}
                />
            )}
        </div>
    );
}
