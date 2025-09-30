import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import { CevaUserImportPayload } from "./cevaTypes";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { ImportCevaUsersPreview } from "./ImportCevaUsersPreview";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UseImportUsers } from "../../../hooks/useImportUsers";
import { UseQueryResult } from "@tanstack/react-query";
import { Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { useCevaImportPreview } from "./useCevaUserImport";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { useXlsxFileUpload } from "../../../hooks/useXlsxFileUpload";
import "./cevaStyles.styl";

const { useCallback, useEffect, useRef } = React;

export type ImportCevaUsersModalProps = {
    importUsers: UseImportUsers<CevaUserImportPayload>;
    isVisible: boolean;
    setIsVisible: (val: boolean) => void;
    usergroups: UseQueryResult<Usergroup[]>;
}

export const ImportCevaUsersModal: React.FC<ImportCevaUsersModalProps> = ({
    importUsers,
    isVisible,
    setIsVisible,
    usergroups,
}) => {
    const fileSelector = useRef<HTMLInputElement>();
    const { t } = useTranslation();
    const {
        errors: xlsxErrors, fileName, hasErrors: hasXlsxErrors, loadFile, reset: resetFileUpload, rows, triggerDialog,
    } = useXlsxFileUpload({ fileInputRef: fileSelector });
    const {
        hasErrors: hasImportErrors, importUsersPayload, parse, previewData, reset: resetUserImport,
    } = useCevaImportPreview();

    useEffect(() => {
        if (rows.length) {
            parse(rows)
        }
    }, [parse, rows]);

    const close = useCallback(() => {
        resetFileUpload();
        resetUserImport();
        importUsers.reset();
        setIsVisible(false);
    }, [resetFileUpload, resetUserImport, importUsers, setIsVisible]);

    if (!isVisible) return <></>;

    const hasPreviewData = previewData.type === "table" && previewData.columnCount > 0 && previewData.rows.length > 0;

    if (usergroups.isLoading) {
        return (
            <Modal title={t(TK.User_ImportUsers)}>
                <div className="wide-users-block">
                    {CircularProgress()}
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={t(TK.User_ImportUsers)}
            buttons={[
                importUsers.isImportingUsers ? <span style={{ lineHeight: "3rem" }}>{t(TK.General_Loading)} ...</span> : <></>,
                <Button
                    isEnabled={!hasXlsxErrors && !hasImportErrors && !importUsers.isImportingUsers}
                    text={t(TK.General_Import)}
                    onClick={() => importUsers.importUsers(importUsersPayload, close)}
                    inactiveWithLoader={importUsers.isImportingUsers}
                />,
            ]}
            hidden={!isVisible}
            onHide={close}
            onEnterKey={() => importUsers.importUsers(importUsersPayload, close)}
            onEscapeKey={close}
        >
            <div className={`ceva ceva-root wide-users-block ${hasPreviewData ? "ceva-wide" : ""}`}>
                <input
                    ref={fileSelector}
                    type="file"
                    name="csv"
                    style={{ display: "none" }}
                    accept=".xlsx"
                    onChange={loadFile}
                />
                <div className="file-selector">
                    <Button
                        secondary
                        text={t(TK.User_SelectFile, { extension: ".xlsx" })}
                        onClick={triggerDialog}
                    />
                    <span>{fileName && fileName.length && fileName || t(TK.General_NoFileChosen)}</span>
                    {hasImportErrors && (
                        <div>
                            <span className="import-users-csverror">Some errors were found while processing the file. Please, fix them and try again.</span>
                        </div>
                    )}
                    {hasXlsxErrors && (
                        <div>
                            <ul>{xlsxErrors.map(err => <li key={err} className="import-users-csverror">{err}</li>)}</ul>
                        </div>
                    )}
                    <ImportCevaUsersPreview previewData={previewData} />
                </div>
            </div>
        </Modal>
    );
}

export default ImportCevaUsersModal;
