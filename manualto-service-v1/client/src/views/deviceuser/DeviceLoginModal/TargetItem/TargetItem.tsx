import * as React from "react";
import {
    APICreateOrUpdateCredentialForUser,
    APIGetCredentialStatusForUsers
} from "../../../../api/credentials";
import {
    FEATURE_CEVA,
    FEATURE_DEVICE_LOGIN_PASSWORD
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    SelectPasswordErrorCode,
    SetInitialPasswordModal
} from "../SetInitialPasswordModal/SetInitialPasswordModal";
import { useActiveAccountFeatures, useActiveAccountId } from "../../../../stores/hooks/account-hooks";
import { Avatar } from "../Avatar/Avatar";
import { CredentialStatus } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { PasswordModal } from "../PasswordModal/PasswordModal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { fmtDateIso8601TZ } from "@binders/client/lib/util/date";
import { useShowModal } from "@binders/ui-kit/lib/compounds/modals/ModalViewProvider";
import { useStartImpersonation } from "../hooks/useStartImpersonation";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./TargetItem.styl";


export const TargetItem: React.FC<{
    deviceTargetUser: User;
}> = ({ deviceTargetUser }) => {
    const { t } = useTranslation();
    const showLoginModal = useShowModal(PasswordModal);
    const showPasswordSetModal = useShowModal(SetInitialPasswordModal);
    const features = useActiveAccountFeatures();
    const isCeva = features.includes(FEATURE_CEVA);
    const startImpersonation = useStartImpersonation();
    const accountId = useActiveAccountId();

    const onSelectUser = async () => {
        if (!features.includes(FEATURE_DEVICE_LOGIN_PASSWORD)) {
            return await startImpersonation(deviceTargetUser.id);
        }

        const targetUserHasNoPasswordSet = async (userId: string): Promise<boolean> => {
            const response = await APIGetCredentialStatusForUsers(accountId, [userId]);
            return response[userId] === CredentialStatus.NO_PASSWORD;
        }

        const cevaUserFirstLogin = isCeva && (await targetUserHasNoPasswordSet(deviceTargetUser.id));
        if (cevaUserFirstLogin) {
            await showPasswordSetModal({
                displayName: deviceTargetUser.displayName,
                onSubmit: async (password) => {
                    try {
                        await APICreateOrUpdateCredentialForUser(accountId, deviceTargetUser.id, deviceTargetUser.login, password);
                        await startImpersonation(deviceTargetUser.id, password);
                    } catch (e) {
                        if (e?.statusCode === 400) {
                            return SelectPasswordErrorCode.INVALID_PASSWORD;
                        } else if (e?.statusCode === 401) {
                            return SelectPasswordErrorCode.NOT_AUTHORIZED;
                        } else {
                            throw e;
                        }
                    }
                }
            });
        } else {
            await showLoginModal({
                displayName: deviceTargetUser.displayName,
                info: isCeva ? t(TK.Login_AskYourSupervisor) : undefined,
                submitButtonText: t(TK.User_LogIn),
                onSubmit: async (password) => {
                    try {
                        await startImpersonation(deviceTargetUser.id, password);
                        return true;
                    } catch (e) {
                        if (e?.statusCode === 401) {
                            return false;
                        } else {
                            throw e;
                        }
                    }
                }
            });
        }
    }

    const lastOnline = deviceTargetUser.lastOnline && fmtDateIso8601TZ(new Date(deviceTargetUser.lastOnline));
    return (
        <div className="targetItem" onClick={() => onSelectUser()}>
            <Avatar displayName={deviceTargetUser.displayName} />
            <div className="targetItem-details">
                <div className="targetItem-title">
                    {deviceTargetUser.displayName}
                </div>
                {lastOnline && <div className="targetItem-subTitle">
                    Last online: {lastOnline}
                </div>}
            </div>
        </div>
    );
}
