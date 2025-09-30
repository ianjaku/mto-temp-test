import * as React from "react";
import { APILoadAccountDomain, APILoadDocumentTotals, APILoadPublicDocsTotal } from "../../documents/api";
import { MostEditedDocumentsTable, MostReadDocumentsTable } from "./documentTable";
import { APIFindUserDetailsForIds } from "../../accounts/api";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountTotals } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { MostActiveEditorsTable } from "./activeEditors";
import { Section } from "../Section";
import TotalsTable from "./totalsTable";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import vars from "@binders/ui-kit/lib/variables";
import "./accountMetrics.styl";

interface IAccountSuccessMetricsProps {
    activeAccount: Account;
    accounts: Account[];
}

interface IAccountSuccessMetricsState {
    activeAccount?: Account;
    documentTotals: AccountTotals;
    accountMembers: User[];
    readerDomain?: string;
    totalPublicDocs: number;
}

class AccountSuccessMetrics extends React.Component<IAccountSuccessMetricsProps, IAccountSuccessMetricsState> {

    constructor(props: IAccountSuccessMetricsProps) {
        super(props);
        this.state = {
            documentTotals: undefined,
            readerDomain: undefined,
            accountMembers: [],
            totalPublicDocs: undefined,
        };
    }

    static getDerivedStateFromProps(nextProps: IAccountSuccessMetricsProps, prevState: IAccountSuccessMetricsState): Partial<IAccountSuccessMetricsState> {
        return {
            activeAccount: nextProps.activeAccount,
            documentTotals: prevState.documentTotals,
            totalPublicDocs: prevState.totalPublicDocs
        };
    }

    componentDidMount(): void {
        this.reload();
    }

    componentDidUpdate(prevProps: IAccountSuccessMetricsProps): void {
        const { activeAccount } = this.props;
        const { activeAccount: prevActiveAccount } = prevProps;
        if (activeAccount !== prevActiveAccount) {
            this.reload();
        }
    }

    private reload() {
        const { activeAccount } = this.props;
        const update = this.setState.bind(this);
        this.setState({ documentTotals: undefined, totalPublicDocs: undefined}, async () => {
            if (activeAccount) {
                const [documentTotals, readerDomain, accountMembers] = await Promise.all([
                    APILoadDocumentTotals(activeAccount.id),
                    APILoadAccountDomain(activeAccount.id),
                    APIFindUserDetailsForIds(activeAccount.members),
                ]);
                update({
                    documentTotals,
                    readerDomain,
                    accountMembers,
                    totalPublicDocs: CircularProgress("", {}, 14, vars.borderGrayColor),
                });
                const totalPublicDocs = await APILoadPublicDocsTotal(activeAccount.id);
                update({
                    totalPublicDocs
                });
            }
        });
    }

    render(): JSX.Element {
        const { accounts, activeAccount } = this.props;
        const { documentTotals, totalPublicDocs, accountMembers } = this.state;
        return activeAccount && (
            <div>
                <Section title={"Overview"}>
                    <TotalsTable
                        activeAccount={activeAccount}
                        activeAccountMembers={accountMembers}
                        documentTotals={documentTotals}
                        totalPublicDocs={totalPublicDocs}
                        accounts={accounts}
                    />
                </Section>
                <Section title={"Most read documents"}>
                    <MostReadDocumentsTable accountId={activeAccount.id} readerDomain={this.state.readerDomain} />
                </Section>
                <Section title={"Most edited documents"}>
                    <MostEditedDocumentsTable accountId={activeAccount.id} readerDomain={this.state.readerDomain} />
                </Section>
                <Section title={"Most active editors"}>
                    <MostActiveEditorsTable accountId={activeAccount.id} />
                </Section>
            </div>
        );
    }
}

export default AccountSuccessMetrics;