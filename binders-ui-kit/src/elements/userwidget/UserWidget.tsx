import {
    FaIconCog,
    FaIconEdit,
    FaIconSignInAlt,
    FaIconSignOutAlt
} from "@binders/client/lib/react/icons/font-awesome";
import React, { useCallback, useMemo } from "react";
import { getImpersonationInfo, stopImpersonation } from "@binders/client/lib/util/impersonation";
import {
    TranslationKeys as TK
} from "@binders/client/lib/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { useShouldDisplayName } from "./hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./UserWidget.styl";

interface UserWidgetProps {
    accountId?: string;
    domain?: string;
    goToEditor?: () => void;
    goToSettings?: () => void;
    pathPrefix?: string;
    renderLogoutButton?: boolean;
    user?: User;
    isPublic?: boolean;
}

export const UserWidget: React.FC<UserWidgetProps> = (props) => {
    return (
        <div className="userWidget">
            {props.isPublic ?
                <LoginButton pathPrefix={props.pathPrefix}/> :
                <UserWidgetContainer {...props} />
            }
        </div>
    );
};

const LoginButton: React.FC<Pick<UserWidgetProps, "pathPrefix">> = ({ pathPrefix }) => {
    const { t } = useTranslation();
    const goToLogin = useCallback(() => {
        window.location.href = `${pathPrefix || ""}/login`;
    }, [pathPrefix]);
    const shouldDisplayName = useShouldDisplayName();
    return (
        <div className="loginButton" onClick={goToLogin}>
            <FaIconSignInAlt/>
            {shouldDisplayName && t(TK.User_LoginAlt)}
        </div>
    );
};

const UserWidgetContainer: React.FC<UserWidgetProps> = ({
    accountId,
    domain,
    goToEditor,
    goToSettings,
    pathPrefix,
    renderLogoutButton,
    user,
}) => {
    const { t } = useTranslation();

    const logout = useCallback(() => {
        const impersonationInfo = getImpersonationInfo();
        if (impersonationInfo?.isDeviceUserTarget) {
            stopImpersonation(domain);
            return;
        }
        const queryParams: string[] = [];
        if (accountId) {
            queryParams.push(`accountId=${accountId}`);
        }
        if (domain) {
            queryParams.push(`domain=${domain}`);
        }
        const suffix = queryParams.length ? `?${queryParams.join("&")}` : "";
        window.location.href = `${pathPrefix || ""}/logout${suffix}`;
    }, [accountId, domain, pathPrefix]);

    const shouldDisplayName = useShouldDisplayName();

    const displayName = useMemo(() => {
        if (shouldDisplayName && user?.displayName) {
            return user.displayName;
        }
        return "";
    }, [user, shouldDisplayName]);

    return (
        <div className="userWidget-container">
            <span className="userWidget-container-username" data-private-nocookie>
                {displayName}
            </span>
            {goToSettings &&
                <div onClick={goToSettings} title={t(TK.Navigation_ToSettings)}>
                    <span className="usersettingsButton">
                        <FaIconCog/>
                        {" "}
                    </span>
                </div>
            }
            {goToEditor && (
                <div onClick={goToEditor} title={t(TK.Navigation_ToEditor)}>
                    <span className="usersettingsButton">
                        <FaIconEdit/>
                        {" "}
                    </span>
                </div>
            )}
            {renderLogoutButton !== false &&
                <div onClick={logout} title={t(TK.General_Logout)}>
                    <span className={`logoutButton ${goToSettings == null ? "logoutExtraPadding" : ""}`}>
                        <FaIconSignOutAlt/>
                        {" "}
                    </span>
                </div>
            }
        </div>
    );
};
