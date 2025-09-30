import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import { CsvParseResult, CsvParsedRow } from "../../../hooks/types";
import { groupBy, toPairs } from "ramda";
import { BareTable } from "./BareTable";
import { CevaUser } from "@binders/client/lib/clients/userservice/v1/contract";
import { ImportUsersPreviewRow } from "./ImportCevaUsersTable";

type ImportCevaUsersPreviewProps = {
    previewData: CsvParseResult<CevaUser>;
}

export const ImportCevaUsersPreview: React.FC<ImportCevaUsersPreviewProps> = ({ previewData }) => {
    if (previewData.type === "error") {
        return (
            <div className="import-users-preview">
                <span className="import-users-csverror">{previewData.error}</span>
            </div>
        )
    }
    const groups = toPairs(groupBy(u => u.type === "row" && u.cell.department, previewData.rows))
        .map(([name, users]) => ({ name, users: users || [] }));

    return (
        <div className="import-users-preview">
            <AccordionGroup>
                {groups.map(
                    group => (
                        <Accordion key={group.name} header={groupHeader(group.name, group.users)}>
                            <BareTable
                                data={group.users}
                                className="import-users-table"
                                Row={ImportUsersPreviewRow}
                                idCol={t => t.type === "row" && t.cell.employeeId || ""}
                                headers={[
                                    "Name",
                                    "Organization",
                                    "Service",
                                    "MW Number",
                                ]}
                            />
                        </Accordion>
                    )
                )}
            </AccordionGroup>
        </div>
    )
}

function groupHeader(name: string, rows: CsvParsedRow<CevaUser>[]) {
    const hasErrors = rows.filter(row => 
        row.type === "error" || (
            row.type === "row" &&
            Object.values(row.errors).filter(w => w && w.length).length > 0
        )
    ).length > 0;
    if (hasErrors) {
        return <span className="import-users-csverror">{name}</span>;
    }
    return name;
}

export default ImportCevaUsersPreview;
