import * as React from "react";
import { CevaUser, User } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    fetchAndDispatchAccountUsers,
    removeUserFromOwnedUsergroup
} from "../../tsActions";
import { useDeviceTargetUserLinksOrEmpty, useMyDetails } from "../../hooks";
import { useOnUpdatePasswordForUser, useRemoveDeviceTargets } from "../../query";
import { APISetPassword } from "../../../credential/api";
import Button from "@binders/ui-kit/lib/elements/button";
import { CredentialStatus } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { CsvParsedRow } from "../../../hooks/types";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import { FlashMessages } from "../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Key from "@binders/ui-kit/lib/elements/icons/Key";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UserImportResult } from "@binders/client/lib/clients/userservice/v1/contract";
import { getCevaTagValue } from "./cevaUtils";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { useActiveAccount } from "../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

const { useCallback, useMemo, useState } = React;

export type ImportCevaUsersTableProps = {
    data: CsvParsedRow<CevaUser>[];
    showActions?: boolean;
}

function renderCell(row: CsvParsedRow<CevaUser>, key: keyof CevaUser) {
    if (row.type === "error") return <></>;
    if (row.errors[key]) {
        return <span className="import-users-csverror">{row.errors[key]}</span>
    }
    return <span>{row.cell[key]}</span>
}

type UsersManageRowType = User & {
    credentialStatus: CredentialStatus | null;
    userGroupId: string;
}

export const UsersManageRow: React.FC<User> = (row: UsersManageRowType) => {
    const { t } = useTranslation();
    const account = useActiveAccount();
    const myDetails = useMyDetails();
    const deviceTargetUserLinks = useDeviceTargetUserLinksOrEmpty();
    const [isConfirming, setIsConfirming] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");

    const onCloseModal = useCallback(() => {
        setIsResettingPassword(false);
        setPassword("");
        setRepeatPassword("");
    }, []);

    const resetPasswordFn = useCallback(async (password): Promise<void> => {
        try {
            await APISetPassword(account.id, row.id, row.login, password);
            FlashMessages.success(t(TK.User_PasswordUpdateForUserConfirmation, { displayName: row.displayName }));
            onCloseModal();
        } catch (e) {
            FlashMessages.error(t(TK.User_PasswordUpdateForUserFailure, { error: e.message }));
            throw e;
        }
    }, [account, row, t, onCloseModal]);

    const resetPassword = useOnUpdatePasswordForUser(
        row.id,
        password => resetPasswordFn(password));
    const removeDeviceTargets = useRemoveDeviceTargets(account.id);

    const deleteUser = useCallback(async () => {
        try {
            const userFacingRemoval = row;
            const deviceUserTargetIds = deviceTargetUserLinks.find(du => du.deviceUserId === userFacingRemoval.id)?.userIds;
            await removeUserFromOwnedUsergroup(
                account.id,
                userFacingRemoval.userGroupId,
                userFacingRemoval.id,
                myDetails?.user,
            );
            const deletedDeviceTargetIds = await removeDeviceTargets.mutateAsync({
                accountId: account.id,
                user: userFacingRemoval,
                myUser: myDetails?.user,
                deviceTargetUserIdsOfRemovedUser: deviceUserTargetIds,
            });
            const updatedMembersIds = account.members.filter(memberId => [userFacingRemoval.id, ...deletedDeviceTargetIds].indexOf(memberId) === -1);
            fetchAndDispatchAccountUsers(account.id, updatedMembersIds);
            setIsConfirming(false);
        } catch (e) {
            FlashMessages.error(t(TK.User_RemoveFail));
            throw e;
        }
    }, [account, deviceTargetUserLinks, myDetails, removeDeviceTargets, row, t]);

    const passwordButtons = useMemo(() => {
        return [
            <Button
                text={t(TK.General_Cancel)}
                onClick={onCloseModal}
                secondary
            />,
            <Button
                text={t(TK.General_Reset)}
                onClick={() => resetPassword.mutate(password)}
                isEnabled={password.length && repeatPassword.length && password === repeatPassword}
                CTA
            />,
        ]
    }, [password, repeatPassword, t, resetPassword, onCloseModal]);

    const credentialStatus = useMemo(
        () => [CredentialStatus.NO_PASSWORD, CredentialStatus.PASSWORD_SET].includes(row.credentialStatus) ? row.credentialStatus : null,
        [row]
    );

    const changePasswordButton = useMemo(() => {
        const hasEmployeeId = !!getCevaTagValue(row, "employeeId");
        const isManualToUser = isManualToLogin(row.login);
        const hasCredentialStatus = [CredentialStatus.NO_PASSWORD, CredentialStatus.PASSWORD_SET].includes(credentialStatus);
        const hasNoPasswordSet = credentialStatus === CredentialStatus.NO_PASSWORD;

        if (!hasEmployeeId || !hasCredentialStatus || isManualToUser) return null;
        return (
            <button
                title={t(hasNoPasswordSet ? TK.User_SetPassword : TK.User_ResetPasswordFormTitle)}
                onClick={() => setIsResettingPassword(true)}>
                {Key({ fontSize: 14 }, "", hasNoPasswordSet ? "gray" : "black")}
            </button>
        );
    }, [t, credentialStatus, setIsResettingPassword, row]);

    return (
        <tr key={row.id}>
            <td>
                <span>{`${row.displayName}`}</span>
            </td>
            <td><span>{getCevaTagValue(row, "organization")}</span></td>
            <td><span>{getCevaTagValue(row, "service")}</span></td>
            <td><span>{getCevaTagValue(row, "employeeId")}</span></td>
            <td className="actions">
                {changePasswordButton}
                <button className="danger" onClick={() => setIsConfirming(true)}>{Delete({ fontSize: 14 })}</button>
                <Modal
                    hidden={!isResettingPassword}
                    title={t(credentialStatus === "NO_PASSWORD" ? TK.User_SetPasswordForUser : TK.User_ResetPasswordForUser, { displayName: row.displayName })}
                    onHide={onCloseModal}
                    onEnterKey={() => resetPassword.mutate(password)}
                    onEscapeKey={onCloseModal}
                    buttons={passwordButtons}
                >
                    <div className="wide-users-block">
                        <div className="reset-password-dialog">
                            <Input
                                type="text"
                                name="password"
                                placeholder={`${t(TK.User_NewPassword)} *`}
                                value={password}
                                onChange={setPassword}
                                useState={false}
                                autoComplete="new-password"
                                aria-autocomplete="none"
                                hideFromAnalytics
                            />
                            <p>* {t(TK.User_MinPasswordLengthError, { minPasswordLength: 6 })}</p>
                            <Input
                                type="text"
                                name="repeatPassword"
                                placeholder={`${t(TK.User_RepeatPassword)} *`}
                                value={repeatPassword}
                                onChange={setRepeatPassword}
                                useState={false}
                                autoComplete="new-password"
                                aria-autocomplete="none"
                                hideFromAnalytics
                            />
                        </div>
                    </div>
                </Modal>
                <Modal
                    hidden={!isConfirming}
                    title={t(TK.User_RemoveUserFromUsergroup)}
                    onHide={() => setIsConfirming(false)}
                    onEnterKey={deleteUser}
                    onEscapeKey={() => setIsConfirming(false)}
                    buttons={[
                        <Button
                            text={t(TK.General_Cancel)}
                            onClick={() => setIsConfirming(false)}
                            secondary
                        />,
                        <Button
                            text={t(TK.General_Ok)}
                            onClick={deleteUser}
                            CTA
                        />,
                    ]}
                >
                    <div className="wide-users-block">
                        <p>{t(TK.User_DeviceRemoveMessage)}</p>
                        <p>{t(TK.General_ConfirmProceed)}</p>
                    </div>
                </Modal>
            </td>
        </tr>
    )
}

export const ImportUsersIgnoredRow: React.FC<UserImportResult> = (row: UserImportResult) => {
    return (
        <tr key={row.user.id}>
            <td>
                <span>{row.user.displayName}</span>
            </td>
        </tr>
    )
}

export const ImportUsersHistoryRow: React.FC<UserImportResult> = (row: UserImportResult) => {
    return (
        <tr key={row.user.id}>
            <td>
                <span>{row.user.displayName}</span>
            </td>
            <td><span>{getCevaTagValue(row.user, "organization")}</span></td>
            <td><span>{getCevaTagValue(row.user, "service")}</span></td>
            <td><span>{getCevaTagValue(row.user, "employeeId")}</span></td>
        </tr>
    )
}

export const ImportUsersPreviewRow: React.FC<CsvParsedRow<CevaUser>> = (row: CsvParsedRow<CevaUser>) => {
    if (row.type === "error") {
        return (
            <tr><td colSpan={3}>{row.error}</td></tr>
        )
    }
    return (
        <tr key={row.cell.employeeId}>
            <td>
                {row.errors.firstName || row.errors.lastName ?
                    <span className="import-users-csverror">{row.errors.firstName || row.errors.lastName}</span> :
                    <span>{`${row.cell.firstName} ${row.cell.lastName}`}</span>
                }
            </td>
            <td>{renderCell(row, "organization")}</td>
            <td>{renderCell(row, "service")}</td>
            <td>{renderCell(row, "employeeId")}</td>
        </tr>
    )
}

