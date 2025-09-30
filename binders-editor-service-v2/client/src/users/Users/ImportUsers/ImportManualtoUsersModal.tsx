import * as React from "react";
import { UseImportUsers, UserImportPayload } from "../../../hooks/useImportUsers";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import DropDown from "@binders/ui-kit/lib/elements/dropdown";
import { FlashMessages } from "../../../logging/FlashMessages";
import { ImportManualtoUsersPreview } from "./ImportManualtoUsersPreview";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UseQueryResult } from "@tanstack/react-query";
import { Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import i18n from "@binders/client/lib/react/i18n";
import { useCsvFileUpload } from "../../../hooks/useCsvFileUpload";
import { useManualtoUserImport } from "../../../hooks/useManualtoUserImport";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useEffect, useMemo, useRef } = React;

export type ImportManualtoUsersModalProps = {
    importUsers: UseImportUsers<UserImportPayload>;
    isVisible: boolean;
    setIsVisible: (val: boolean) => void;
    usergroups: UseQueryResult<Usergroup[]>;
}

export const ImportManualtoUsersModal: React.FC<ImportManualtoUsersModalProps> = ({
    importUsers,
    isVisible,
    setIsVisible,
    usergroups,
}) => {
    const fileSelector = useRef<HTMLInputElement>();
    const { t } = useTranslation();
    const {
        errors: csvErrors, fileName, hasErrors: hasCsvErrors, loadFile, reset: resetFileUpload, rows, triggerDialog,
    } = useCsvFileUpload({ fileInputRef: fileSelector });
    const {
        hasErrors: hasImportErrors,
        importUsersPayload, parse, previewData, replaceInGroup, selectedUsergroupId,
        setReplaceInGroup, setSelectedUsergroupId, reset: resetUserImport,
    } = useManualtoUserImport();

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

    const usergroupsOptions = useMemo(() => {
        return usergroups.isSuccess ?
            usergroups.data
                .filter(group => !group.isAutoManaged)
                .map(group => ({
                    id: group.id,
                    label: group.name,
                })) :
            [];
    }, [usergroups.isSuccess, usergroups.data]);

    if (!isVisible) {
        return <></>;
    }

    if (usergroups.isError) {
        FlashMessages.error(TK.General_Error)
        return null;
    }
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
                <Button
                    isEnabled={!hasCsvErrors && !hasImportErrors}
                    text={t(TK.General_Import)}
                    onClick={() => importUsers.importUsers(importUsersPayload, close)}
                    inactiveWithLoader={importUsers.isImportingUsers}
                />
            ]}
            hidden={!isVisible}
            onHide={close}
            onEnterKey={() => importUsers.importUsers(importUsersPayload, close)}
            onEscapeKey={close}
        >
            <div className="wide-users-block">
                <input
                    ref={fileSelector}
                    type="file"
                    name="csv"
                    style={{ display: "none" }}
                    accept=".csv"
                    onChange={loadFile}
                />
                <p>{t(TK.User_SelectCSVMessage)}</p>
                <h3>{t(TK.User_SelectCSVNote)}</h3>
                <p>
                    <a
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://help.manual.to/launch/AWf1AjMepxPvH0YhBIWQ/AXKn-jieHBzAAE49Xziu?lang=${i18n.language}`}>
                        {t(TK.User_MoreCSVConstructionInfo)}
                    </a>
                </p>
                <div className="file-selector">
                    <Button
                        secondary
                        text={t(TK.User_SelectFile, { extension: ".csv" })}
                        onClick={triggerDialog}
                    />
                    <span className="info">{fileName ?? t(TK.General_FileChosen)}</span>
                </div>
                {hasImportErrors && (
                    <div>
                        <span className="import-users-csverror">{t(TK.User_CSVGeneralError)}</span>
                    </div>
                )}
                {hasCsvErrors && (
                    <div>
                        <ul>{csvErrors.map(err => <li key={err} className="import-users-csverror">{err}</li>)}</ul>
                    </div>
                )}
                {previewData && <ImportManualtoUsersPreview previewData={previewData} />}
                <span className="import-users-label">
                    {t(TK.User_SelectUsergroup)}
                </span>
                <DropDown
                    type={t(TK.User_NoUserGroup)}
                    elements={usergroupsOptions}
                    selectedElementId={selectedUsergroupId}
                    onSelectElement={setSelectedUsergroupId}
                    style={{ zIndex: 10 }}
                    unselectable={true}
                />
                <Checkbox
                    onCheck={() => setReplaceInGroup((replaceInGroup) => !replaceInGroup)}
                    disabled={false}
                    label={t(TK.User_ReplaceMembers)}
                    className="replace-members-checkbox"
                    checked={replaceInGroup}
                />
            </div>
        </Modal>
    );
}

export default ImportManualtoUsersModal;
