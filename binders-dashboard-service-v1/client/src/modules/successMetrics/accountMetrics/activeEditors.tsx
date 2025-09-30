import * as React from "react";
import type { DocumentEditor } from "@binders/client/lib/clients/trackingservice/v1/contract";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { useMostActiveEditors } from "../hooks";

const HEADERS = ["Login", "Display name", "Edit count", "Document count"] as const;

export const MostActiveEditorsTable: React.FC<{ accountId: string }> = ({ accountId }) => {
    const { data = [], isLoading } = useMostActiveEditors(accountId);
    return isLoading ?
        <span>Loading...</span> :
        <Table customHeaders={HEADERS} data={mapDataToRows(data)} />;
};

/** Maps data to match {@link HEADERS} */
const mapDataToRows = (data: DocumentEditor[]) =>
    data.map(info => [
        info.login,
        info.displayName,
        info.editCount,
        info.documentCount
    ]);
