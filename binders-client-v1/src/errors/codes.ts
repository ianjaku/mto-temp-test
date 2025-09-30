import { TFunction } from "../i18n";
import { TK } from "../react/i18n/translations";

export enum UiErrorCode {
    activeDirectoryNotLinked = "activeDirectoryNotLinked",
    cantLoadContent = "cantLoadContent",
    domainInaccessible = "domainInaccessible",
    general = "general",
    sessionInactivity = "sessionInactivity",
    composerInactivity = "composerInactivity",
    loginFail = "loginFail",
    loginFailNoSso = "loginFailNoSso",
    loginFailUserEmpty = "loginFailUserEmpty",
    loginInvalidCredentials = "loginInvalidCredentials",
    loginToAccess = "loginToAccess",
    noAccessDashboard = "noAccessDashboard",
    noAccessEditor = "noAccessEditor",
    noAccessManage = "noAccessManage",
    noContent = "noContent",
    requestInviteError = "requestInviteError",
    sessionEnd = "sessionEnd",
    tokenExpired = "tokenExpired",
}

const reasons: Record<UiErrorCode, string> = {
    [UiErrorCode.activeDirectoryNotLinked]: TK.Login_ErrorActiveDirectoryNotLinked,
    [UiErrorCode.cantLoadContent]: TK.General_CantLoadContent,
    [UiErrorCode.domainInaccessible]: TK.Acl_NoAccessToDomain,
    [UiErrorCode.general]: TK.General_Error,
    [UiErrorCode.sessionInactivity]: TK.General_SessionEndInactivity,
    [UiErrorCode.composerInactivity]: TK.Redirect_Inactivity,
    [UiErrorCode.loginFailNoSso]: TK.Login_ErrorSsoNotEnabled,
    [UiErrorCode.loginFailUserEmpty]: TK.Login_ErrorUserIsEmpty,
    [UiErrorCode.loginFail]: TK.User_CantLogIn,
    [UiErrorCode.loginInvalidCredentials]: TK.Login_InvalidCredentials,
    [UiErrorCode.loginToAccess]: TK.Acl_LoginToAccess,
    [UiErrorCode.noAccessDashboard]: TK.Exception_403Dashboard,
    [UiErrorCode.noAccessEditor]: TK.Exception_403Editor,
    [UiErrorCode.noContent]: TK.Account_NoPublications,
    [UiErrorCode.requestInviteError]: TK.User_InviteLinkError,
    [UiErrorCode.sessionEnd]: TK.General_SessionEnd,
    [UiErrorCode.tokenExpired]: TK.General_ReqestBlockedDescription,
    [UiErrorCode.noAccessManage]: TK.Exception_403Manage,
}

export function translateUiErrorCode(t: TFunction | ((e: string) => string), errorCode: UiErrorCode | string, fallback?: string): string {
    let txt: string;
    if (reasons[errorCode]) {
        txt = t(reasons[errorCode]);
    } else if (fallback && TK[fallback]) {
        txt = t(fallback);
    } else {
        txt = t(reasons[UiErrorCode.general]);
    }
    return txt;
}
