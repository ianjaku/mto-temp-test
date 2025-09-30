import * as React from "react";
import { useMostEditedDocuments, useMostReadDocuments } from "../hooks";
import { IDashboardDocument } from "@binders/client/lib/clients/trackingservice/v1/contract";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";

const HEADERS = ["Title", "Number of reads", "Number of edits" ] as const;

export const MostReadDocumentsTable: React.FC<{
    accountId: string;
    readerDomain?: string;
}> = ({ accountId, readerDomain }) => {
    const { data = [], isLoading } = useMostReadDocuments(accountId);
    return isLoading ?
        <span>Loading...</span> :
        <Table customHeaders={HEADERS} data={mapDataToRows(data, readerDomain)} />;
}

export const MostEditedDocumentsTable: React.FC<{
    accountId: string;
    readerDomain?: string;
}> = ({ accountId, readerDomain }) => {
    const { data = [], isLoading } = useMostEditedDocuments(accountId);
    return isLoading ?
        <span>Loading...</span> :
        <Table customHeaders={HEADERS} data={mapDataToRows(data, readerDomain)} />;
}

/** Maps data to match {@link HEADERS} */
const mapDataToRows = (data: IDashboardDocument[], readerDomain?: string) => {
    const toRowTitle = readerDomain ?
        (title: string, id: string) => <a target="_blank" rel="noopener noreferrer" href={`https://${readerDomain}/launch/${id}`}>{title}</a> :
        (title: string) => <span>{title}</span>;
    return data.map(dashboardDoc => {
        return [
            toRowTitle(dashboardDoc.title || "<document without title>", dashboardDoc._id),
            dashboardDoc.numberOfReads,
            dashboardDoc.numberOfEdits,
        ];
    })
}
