import * as React from "react";
import { CsvParseResult, isError } from "../../../hooks/types";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useTranslation } from "@binders/client/lib/react/i18n";

export type ImportManualtoUsersPreviewProps = {
    previewData: CsvParseResult<User>;
}

export const ImportManualtoUsersPreview: React.FC<ImportManualtoUsersPreviewProps> = ({ previewData }) => {
    const { t } = useTranslation();

    if (previewData.type === "error") {
        return (
            <div className="import-users-preview">
                <span className="import-users-csverror">{previewData.error}</span>
            </div>
        )
    }

    const tableData = previewData.rows.map(
        (row) => {
            if (isError(row)) {
                return [<span className="import-users-csverror">Error {row.error}</span>];
            } else {
                const result = ["firstName", "lastName", "login", "preferredLanguage", "groups"].map(prop => {
                    if (row.errors[prop]) {
                        return (
                            <label className="import-users-csverror" title={prop}>
                                {row.errors[prop]}<br/>
                                {row.cell[prop]}
                            </label>
                        );
                    }
                    return Array.isArray(row.cell[prop]) ? row.cell[prop].join(", ") : row.cell[prop];
                })
                return result;
            }
        });

    const headers = [
        t(TK.User_FirstName),
        t(TK.User_LastName),
        t(TK.General_Email),
        t(TK.General_PreferredLanguage),
        t(TK.User_Groups),
    ];

    return (
        <div className="import-users-preview">
            <Table
                customHeaders={headers}
                data={tableData}
            />
        </div>
    )
}

export default ImportManualtoUsersPreview
