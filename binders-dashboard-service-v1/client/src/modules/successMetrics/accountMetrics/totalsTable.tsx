import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountTotals } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { isBindersMedia } from "../../../shared/helper";
import { isManualToLogin } from "@binders/client/lib/util/user";

interface ITotalsTableProps {
    accounts: Account[];
    activeAccount: Account;
    activeAccountMembers: User[];
    documentTotals: AccountTotals;
    totalPublicDocs: number | Element;
}

function getLocalDate(date: string | undefined): string {
    return date ? fmtDateIso8601TZ(new Date(date)) : "-";
}

function bytesToSize(bytes: number): string {
    const sizes: string[] = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "n/a"
    const i: number = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString())
    if (i === 0) return `${bytes} ${sizes[i]}`
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

class TotalsTable extends React.Component<ITotalsTableProps, Record<string, unknown>> {

    private buildRows() {
        const {
            activeAccount,
            activeAccountMembers,
            documentTotals,
            totalPublicDocs
        } = this.props;
        const { membersCount, licenseCount } = getMembersCountAndLicenseCount(activeAccount, activeAccountMembers);

        const storageDetails = activeAccount.storageDetails || {}
        const accountData = activeAccount ?
            [
                membersCount,
                licenseCount,
                activeAccount.maxNumberOfLicenses,
                getLocalDate(activeAccount.expirationDate),
                getLocalDate(activeAccount.readerExpirationDate),
                activeAccount.maxPublicCount,
                storageDetails.inUseVisualsSize ? bytesToSize(storageDetails.inUseVisualsSize) : "No data",
                storageDetails.deletedVisualsSize ? bytesToSize(storageDetails.deletedVisualsSize) : "No data"
            ] :
            ["", "", "", ""];
        const documentData = documentTotals ?
            [documentTotals.documentCount, totalPublicDocs, documentTotals.collectionCount] :
            ["", "", ""];
        return [
            [...accountData, ...documentData]
        ];
    }

    render(): JSX.Element {
        const headers = [
            "Registered users",
            "Active licenses",
            "Bought licenses",
            "Editor Expiration date",
            "Reader Expiration date",
            "Maximum number of public publications",
            "Visuals size in use",
            "Deleted visuals size",
            "Number of documents",
            "Number of public publications",
            "Number of collections"
        ];
        const data = this.buildRows();
        return (
            <Table customHeaders={headers} data={data} />
        );
    }
}

type MembersAndLicenseCount = { membersCount: number; licenseCount: number };
function getMembersCountAndLicenseCount(activeAccount: Account, activeAccountMembers: User[]): MembersAndLicenseCount {
    const isBindersMediaAccount = isBindersMedia(activeAccount);
    return activeAccountMembers.reduce((reduced, user): MembersAndLicenseCount => {
        const skipMember = !isBindersMediaAccount && isManualToLogin(user.login);
        if (skipMember) {
            return reduced;
        }
        return {
            membersCount: reduced.membersCount + 1,
            licenseCount: reduced.licenseCount + user.licenseCount,
        };
    }, { membersCount: 0, licenseCount: 0 } as MembersAndLicenseCount);
}

export default TotalsTable;