import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountViews from "./accountViews";
import { DocumentCreationsGraph } from "./documentCreations";
import { DocumentDeletionsGraph } from "./documentDeletions";
import { DocumentMergedOperationsGraph } from "./documentMergedOperations";
import { Section } from "../Section";

const DocumentMetrics: React.FC<{ activeAccount: Account }> = ({ activeAccount }) => {
    return (
        <div>
            <AccountViews account={activeAccount} />
            <Section>
                <DocumentCreationsGraph accountId={activeAccount.id} />
            </Section>
            <Section>
                <DocumentDeletionsGraph accountId={activeAccount.id} />
            </Section>
            <Section>
                <DocumentMergedOperationsGraph accountId={activeAccount.id} />
            </Section>
        </div>
    );
};

export default DocumentMetrics;
