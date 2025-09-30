import * as React from "react";
import {
    APIColInfosCsv,
    APIDocInfosCsv,
    APISummarizeDraftsForAccountCsv,
    APISummarizePublicationsForAccountCsv,
} from "../../../documents/api";
import { APIReadSessionsCsv } from "../../../tracking/api";
import Button from "@binders/ui-kit/lib/elements/button";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { saveCsvToFile } from "@binders/client/lib/util/download";
import { useActiveAccount } from "../../hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./UsageReports.styl";


interface Props {
    accountId: string;
}

const UsageReports: React.FC<Props> = ({
    accountId,
}) => {

    const [readSessionsLoading, setReadSessionsLoading] = React.useState(false);
    const [docInfoLoading, setDocInfoLoading] = React.useState(false);
    const [colInfoLoading, setColInfoLoading] = React.useState(false);
    const [pubInfoLoading, setPubInfoLoading] = React.useState(false);
    const [draftInfoLoading, setDraftInfoLoading] = React.useState(false);

    const [errorMessage, setErrorMessage] = React.useState("");
    const activeAccount = useActiveAccount();
    const { t } = useTranslation();

    const downloadReport = async (
        apiCall: () => Promise<string>,
        fileName: string,
        setLoadingState: (loading: boolean) => void,
    ) => {
        const onError = (e: Error) => {
            setErrorMessage(t(TK.Analytics_Reports_ErrorGeneral));
            // eslint-disable-next-line no-console
            console.error(e);
        };
        await saveCsvToFile(apiCall, fileName, onError, setLoadingState);
    };

    const generateReadSessions = async () => {
        await downloadReport(
            () => APIReadSessionsCsv(accountId),
            `readsessions for ${activeAccount.name} on manualto`,
            setReadSessionsLoading,
        )
    }

    const generateDocInfo = async () => {
        await downloadReport(
            () => APIDocInfosCsv(accountId),
            `doc info for ${activeAccount.name} on manualto`,
            setDocInfoLoading,
        )
    }

    const generateColInfo = async () => {
        await downloadReport(
            () => APIColInfosCsv(accountId),
            `collection info for ${activeAccount.name} on manualto`,
            setColInfoLoading,
        )
    }

    const generatePubInfo = async () => {
        await downloadReport(
            () => APISummarizePublicationsForAccountCsv(accountId),
            `publications for ${activeAccount.name} on manualto`,
            setPubInfoLoading,
        )
    }

    const generateDraftInfo = async () => {
        await downloadReport(
            () => APISummarizeDraftsForAccountCsv(accountId),
            `drafts for ${activeAccount.name} on manualto`,
            setDraftInfoLoading,
        )
    }

    return (
        <div className="usageReports">
            <div className="usageReports-section">
                <Button
                    onClick={generateReadSessions}
                    text={t(TK.Analytics_Reports_ReadSessions_Cta)}
                    inactiveWithLoader={readSessionsLoading}
                    secondary
                />
                <label>
                    {t(TK.Analytics_Reports_ReadSessions_Info)}
                </label>
            </div>
            <div className="usageReports-section">
                <Button
                    onClick={generateDocInfo}
                    text={t(TK.Analytics_Reports_DocInfo_Cta)}
                    inactiveWithLoader={docInfoLoading}
                    secondary
                />
                <label>
                    {t(TK.Analytics_Reports_DocInfo_Info)}
                </label>
            </div>
            <div className="usageReports-section">
                <Button
                    onClick={generateColInfo}
                    text={t(TK.Analytics_Reports_ColInfo_Cta)}
                    inactiveWithLoader={colInfoLoading}
                    secondary
                />
                <label>
                    {t(TK.Analytics_Reports_ColInfo_Info)}
                </label>
            </div>
            <div className="usageReports-section">
                <Button
                    onClick={generatePubInfo}
                    text={t(TK.Analytics_Reports_PubInfo_Cta)}
                    inactiveWithLoader={pubInfoLoading}
                    secondary
                />
                <label>
                    {t(TK.Analytics_Reports_PubInfo_Info)}
                </label>
            </div>
            <div className="usageReports-section">
                <Button
                    onClick={generateDraftInfo}
                    text={t(TK.Analytics_Reports_DraftInfo_Cta)}
                    inactiveWithLoader={draftInfoLoading}
                    secondary
                />
                <label>
                    {t(TK.Analytics_Reports_DraftInfo_Info)}
                </label>
            </div>
            {errorMessage && (
                <div className="usageReports-errors">
                    {errorMessage}
                </div>
            )}
        </div>
    )
}

export default UsageReports;
