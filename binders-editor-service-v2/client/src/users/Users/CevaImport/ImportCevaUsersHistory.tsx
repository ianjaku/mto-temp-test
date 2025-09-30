import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import { UserImportAction, UserImportResult } from  "@binders/client/lib/clients/userservice/v1/contract";
import { buildCsvContent, manualtoUsersToTable } from "../../../hooks/parseManualtoCsv";
import { containsInValues, downloadCsvTextFile } from "../ImportUsers/utils";
import CevaImportActionGroups from "./CevaImportActionGroups";
import FileDownload from "@binders/ui-kit/lib/elements/icons/FileDownload";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./cevaStyles.styl";

const { useCallback, useMemo } = React;

export type ImportHeaderProps = {
    importDate: string;
    results: UserImportResult[];
}

const ImportHeader: React.FC<ImportHeaderProps> = ({ importDate, results }) => {
    const { t } = useTranslation();
    const datestamp = fmtDateIso8601TimeLocalizedTZ(new Date(importDate));

    const exportCsvCallback: React.MouseEventHandler<HTMLButtonElement> = useCallback((e) => {
        e.stopPropagation();
        const csv = manualtoUsersToTable(results.filter(r => r.invitationLink));
        downloadCsvTextFile(buildCsvContent(csv));
    }, [results]);

    return (
        <div className="import-users-accordion-header">
            <label>{t(TK.User_ImportDate, { datestamp })}</label>
            <button onClick={exportCsvCallback}>{FileDownload({ fontSize: 16 })} CSV</button>
        </div>
    );
}

export type ImportUsersHistoryProps = {
    userImportActions: UserImportAction[];
    onSendInvitationMails: () => void;
    isSendingInvitationMails: boolean;
    onRecordSelected: (openIndices: number[]) => void;
    query?: string;
}

export const ImportCevaUsersHistory: React.FC<ImportUsersHistoryProps> = ({
    userImportActions,
    onRecordSelected,
    query,
}) => {
    const filteredUserImportActions = useMemo(() => {
        if (!userImportActions) {
            return [];
        }
        if (!query) {
            return userImportActions;
        }
        return userImportActions
            .map(action => ({ ...action, userImportResults: action.userImportResults.filter((r) => containsInValues(query, r.user)) }))
            .filter(({ userImportResults }) => userImportResults.length);
    }, [userImportActions, query]);

    if (!(filteredUserImportActions || []).length) {
        return <></>;
    }

    return (
        <div className="ceva-root">
            <AccordionGroup onChangeOpenIndexes={onRecordSelected}>
                {filteredUserImportActions.map(userImportAction => {
                    return (
                        <Accordion
                            key={userImportAction.importDate}
                            header={(
                                <ImportHeader
                                    importDate={userImportAction.importDate}
                                    results={userImportAction.userImportResults}
                                />
                            )}
                            className="import-users-results-accordion"
                            noGaps={true}
                        >
                            <CevaImportActionGroups
                                userImportAction={userImportAction}
                            />
                        </Accordion>
                    );
                })}
            </AccordionGroup>
        </div>
    )
}

