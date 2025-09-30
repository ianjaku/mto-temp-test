import * as React from "react";
import { Account, AccountLicensing } from "@binders/client/lib/clients/accountservice/v1/contract";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";

interface IPlatformProps {
    accounts: Account[];
    licensing: AccountLicensing[];
}

const getVisibleAccounts = (accounts: Account[], includeExpired: boolean) => {
    const result = {};
    const visibleAccounts = includeExpired ?
        accounts :
        accounts.filter( account => account.accountIsNotExpired );

    visibleAccounts.forEach(account => result[account.id] = account);
    return result;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function Platform (props: IPlatformProps) {
    const { accounts, licensing } = props;

    const [ includeExpired, setIncludeExpired ] = React.useState(false);

    const visibleAccounts = React.useMemo(
        () => getVisibleAccounts(accounts, includeExpired),
        [ accounts, includeExpired ]
    );
    const data = React.useMemo(
        () => {
            return licensing
                .filter(l => visibleAccounts[l.accountId] !== undefined)
                .map(license => [
                    visibleAccounts[license.accountId].name,
                    license.totalPublicDocuments,
                    license.maxPublicCount,
                    license.totalLicenses,
                    license.maxNumberOfLicenses,
                ]);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ accounts, licensing, includeExpired ]
    );

    const headers = [
        "Account",
        "Current Public Documents",
        "Maxium Public Count",
        "Current Users",
        "Maximum Number of Users",
    ];

    return (
        <div className="tabs-content">
            <div className="account-metrics-section">
                <h1>Licensing issues</h1>
                <div>
                    <Checkbox onCheck={setIncludeExpired} />
                    Show expired accounts
                </div>
                <Table customHeaders={headers} data={data} />
            </div>
        </div>
    );

}