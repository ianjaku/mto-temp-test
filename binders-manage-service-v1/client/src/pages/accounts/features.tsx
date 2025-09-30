import * as React from "react";
import {
    Account,
    FEATURES,
    FEATURE_DESCRIPTIONS,
    IFeatureUsage,
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../components/dialog";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { toastStyles, useToast } from "../../components/use-toast";
import { useCallback, useState } from "react";
import {
    useGetAccount,
    useGetAccountFeaturesUsage,
    useLinkFeature,
    useListAccountFeatures,
    useListAccounts,
    useUnlinkFeature,
} from "../../api/hooks";
import { AccountsActions } from "../../actions/accounts";
import { FeaturesPresetDialog } from "./featurespreset";
import FontAwesome from "react-fontawesome";
import { ManagedSearchTable } from "../../search/ManagedSearchTable";
import { RouteComponentProps } from "react-router";
import { Search } from "../../components/search";
import { SearchAwareText } from "../../search/SearchAwareText";
import { SearchTable } from "../../search/SearchTable";
import { SearchTableConfig } from "../../search/types";

export interface FeaturesProps {
    accountId: string;
}

export interface IFeature {
    featureDescription: string;
    featureName: string;
    featureUsage: number;
    isIncluded: boolean;
}

export const AccountFeatures = (props: RouteComponentProps<{ accountId: string }, unknown>) => {
    const { accountId } = props.params;
    const accounts = useListAccounts();
    const account = useGetAccount(accountId);
    const features = useListAccountFeatures(accountId);
    const featuresUsage = useGetAccountFeaturesUsage();
    const [query, setQuery] = useState("");

    const getFeatureUsage = useCallback((feature: string): number => {
        if (featuresUsage.data == null) return 0;
        return (featuresUsage.data[feature]?.length ?? 0);
    }, [featuresUsage.data]);

    const selectedFeatures = features.data?.map(name => toFeature(name, true, getFeatureUsage)) ?? [];
    const allFeatures = FEATURES.map(name => toFeature(name, false, getFeatureUsage));

    const linkedFeatureRows = [...selectedFeatures]
        .sort((a, b) => b.featureUsage - a.featureUsage);
    const featuresSet = new Set(features.data ?? []);

    const unlinkedFeatureRows = allFeatures
        .filter(f => !featuresSet.has(f.featureName))
        .sort((a, b) => b.featureUsage - a.featureUsage);

    const featuresTableConfig = {
        idField: "featureName",
        index: ["featureName", "featureDescription"],
        boost: { featureName: 2 },
        sorting: {
            field: "featureUsage",
            order: "desc",
        },
        hideSearch: true,
    } as SearchTableConfig<IFeature>;

    const featuresTableHeaders = [
        { label: "Name", sort: true, get: "featureName" },
        { label: "Usage", sort: true, get: "featureUsage" },
        { label: "Description", sort: true, get: "featureDescription" },
        "Actions"
    ];

    return (
        <>
            <ContentTitleRow title={"Features for " + account.data?.name}>
                <ContentTitleAction icon="" label="Cancel" variant="outline" handler={AccountsActions.switchToOverview} />
                <FeaturesPresetDialog accountId={accountId} />
            </ContentTitleRow>
            <div className="flex flex-col gap-4">
                <Search id="feeatures" value={query} setValue={setQuery} />
                <div>
                    <h2>Enabled Features</h2>
                    <ManagedSearchTable
                        render={feature => <FeatureRow
                            feature={feature}
                            accountId={accountId}
                            accounts={accounts.data ?? []}
                            featuresUsage={featuresUsage.data ?? {}}
                        />}
                        data={linkedFeatureRows}
                        query={query}
                        config={featuresTableConfig}
                        headers={featuresTableHeaders} />
                </div>
                <div>
                    <h2>Disabled Features</h2>
                    <ManagedSearchTable
                        render={feature => <FeatureRow
                            feature={feature}
                            accountId={accountId}
                            accounts={accounts.data ?? []}
                            featuresUsage={featuresUsage.data ?? {}}
                        />}
                        data={unlinkedFeatureRows}
                        query={query}
                        config={featuresTableConfig}
                        headers={featuresTableHeaders} />
                </div>
            </div>
        </>
    );
};


export const FeatureRow = (props: {
    feature: IFeature;
    accounts: Account[];
    featuresUsage: IFeatureUsage;
    accountId: string;
}) => {
    const {
        accountId,
        featuresUsage,
        accounts,
        feature,
    } = props;
    const { featureName, featureDescription, featureUsage, isIncluded } = feature;
    const linkFeature = useLinkFeatureMutation();
    const unlinkFeature = useUnlinkFeatureMutation();
    const action = useCallback(() => {
        if (isIncluded) { unlinkFeature.mutate({ accountId, feature: featureName }); }
        else { linkFeature.mutate({ accountId, feature: featureName }); }
    }, [accountId, featureName, isIncluded, linkFeature, unlinkFeature]);

    const accountIds = featuresUsage[featureName] ?? [];
    const accountIdsSet = new Set(accountIds);
    const accountsWithFeature = accounts.filter(acc => accountIdsSet.has(acc?.id));
    return (
        <tr key={featureName} className={tableRowStyles.base}>
            <td className={tableCellStyles.base}><SearchAwareText>{featureName}</SearchAwareText></td>
            <td className={tableCellStyles.base}>
                {featureUsage > 0 ?
                    <AccountFeatureUsageDialog feature={feature} accounts={accountsWithFeature} /> :
                    featureUsage}
            </td>
            <td className={tableCellStyles.base}><SearchAwareText>{featureDescription}</SearchAwareText></td>
            <td className={tableCellStyles.actions}>
                <FontAwesome name={isIncluded ? "minus" : "plus"} onClick={action} />
            </td>
        </tr>
    )
}

const AccountFeatureUsageDialog = ({ accounts, feature }: { accounts: Account[]; feature: IFeature; }) => {
    const unlinkFeature = useUnlinkFeatureMutation();
    return (
        <Dialog>
            <DialogTrigger>
                <span className="cursor-pointer underline"><SearchAwareText>{feature.featureUsage}</SearchAwareText></span>
            </DialogTrigger>
            <DialogContent className="w-full md:min-w-3xl max-w-[90vw]">
                <DialogHeader className="flex flex-col gap-2">
                    <DialogTitle>Accounts with feature "{feature.featureName}"</DialogTitle>
                    <DialogDescription>{feature.featureDescription}</DialogDescription>
                </DialogHeader>
                <div className="max-h-[80vh] overflow-auto">
                    <SearchTable
                        data={accounts}
                        config={{ index: ["name"] }}
                        headers={[
                            { label: "Account ID", get: "id", sort: true },
                            { label: "Name", get: "name", sort: true },
                            "Action",
                        ]}
                        render={account => (
                            <tr className={tableRowStyles.base} key={account.id}>
                                <td className={tableCellStyles.base}><SearchAwareText>{account.id}</SearchAwareText></td>
                                <td className={tableCellStyles.base}><SearchAwareText>{account.name}</SearchAwareText></td>
                                <td className={tableCellStyles.actions}>
                                    <FontAwesome name="minus" onClick={() => {
                                        unlinkFeature.mutate({ accountId: account.id, feature: feature.featureName });
                                    }} />
                                </td>
                            </tr>
                        )}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function toFeature(featureName: string, isIncluded: boolean, getFeatureUsage: (f: string) => number): IFeature {
    return {
        featureDescription: FEATURE_DESCRIPTIONS[featureName] ?? "",
        featureUsage: getFeatureUsage(featureName),
        featureName,
        isIncluded,
    }
}

function useLinkFeatureMutation() {
    const { toast } = useToast();
    return useLinkFeature({
        onSuccess: (_, { feature }) => toast({
            className: toastStyles.info,
            title: "Feature added",
            description: <>Feature <strong>{feature}</strong> was added to the account</>,
        }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to add feature", description: e.message })
    });
}

export function useUnlinkFeatureMutation() {
    const { toast } = useToast();
    return useUnlinkFeature({
        onSuccess: (_, { feature }) => toast({
            className: toastStyles.info,
            title: "Feature removed",
            description: <>Feature <strong>{feature}</strong> was removed from the account</>,
        }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to remove feature", description: e.message })
    });
}


