import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import Button from "@binders/ui-kit/lib/elements/button";
import CheckCircle from "@binders/ui-kit/lib/elements/icons/CheckCircle";
import { TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { UserImportAction } from "@binders/client/lib/clients/userservice/v1/contract";
import Warning from "@binders/ui-kit/lib/elements/icons/Warning";
import colors from "@binders/ui-kit/lib/variables";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { useTranslation } from "@binders/client/lib/react/i18n";

export const ImportHeader: React.FC<{ importDate: string }> = ({ importDate }) => {
    const { t } = useTranslation();
    const datestamp = fmtDateIso8601TimeLocalizedTZ(new Date(importDate));

    return (
        <div className="import-users-accordion-header">
            <label>{t(TK.User_ImportDate, { datestamp })}</label>
        </div>
    );
}

export type ImportUsersHistoryProps = {
    userImportActions: UserImportAction[];
    onExport: () => void;
    onSendInvitationMails: () => void;
    isSendingInvitationMails: boolean;
    onRecordSelected: (openIndices: number[]) => void;
}

export const ImportManualtoUsersHistory: React.FC<ImportUsersHistoryProps> = ({
    userImportActions,
    onRecordSelected,
    onExport,
    onSendInvitationMails,
    isSendingInvitationMails,
}) => {
    const { t } = useTranslation();
    return (
        <AccordionGroup onChangeOpenIndexes={onRecordSelected}>
            {userImportActions.map(record => {
                const resultHeaders = [
                    t(TK.User_DisplayName).toUpperCase(),
                    t(TK.User_FirstDisplayName),
                    t(TK.User_LastDisplayName),
                    t(TK.General_Email).toUpperCase(),
                    "",
                    "",
                ];
                const tableData = record.userImportResults.map(userImportResult => [
                    userImportResult.user.displayName,
                    userImportResult.user.firstName,
                    userImportResult.user.lastName,
                    userImportResult.user.login,
                    userImportResult.invitationLink ?
                        (
                            <a
                                href={userImportResult.invitationLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="invitation-link">
                                {t(TK.User_InviteLink)}
                            </a>
                        ) :
                        <span className="error">{userImportResult.exception}</span>,
                    userImportResult.invitationLink ?
                        CheckCircle({ fontSize: 16 }) :
                        Warning({ fontSize: 16, color: colors.colorError }),
                ]);
                return (
                    <Accordion
                        key={record.importDate}
                        header={<ImportHeader importDate={record.importDate} />}
                        className="import-users-results-accordion"
                    >
                        <Table
                            customHeaders={resultHeaders}
                            data={tableData}
                            className="import-users-results-accordion-table"
                            searchable
                        />
                        <div className="import-users-results-accordion-cta">
                            <Button
                                secondary
                                text={t(TK.User_ExportToCSV)}
                                onClick={onExport}
                            />
                            <Button
                                secondary
                                text={t(TK.User_SendInvitationMails)}
                                onClick={onSendInvitationMails}
                                inactiveWithLoader={isSendingInvitationMails}
                            />
                        </div>
                    </Accordion>
                );
            })}
        </AccordionGroup>
    )
}

