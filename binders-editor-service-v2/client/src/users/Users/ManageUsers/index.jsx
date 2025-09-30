import * as React from "react";
import * as validator from "validator";
import { DirtyStateId, useDirtyStateContext } from "../../../shared/DirtyStateContext";
import { fmtDateIso8601TZ, fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import {
    generateInvitationToken,
    loadListUserAccess,
    populateUser,
    updateUser
} from "../../actions";
import { getGroupsForUsers, isDeviceUserTarget, useRemoveDeviceTargets } from "../../../users/query";
import {
    removeUserFromAccount,
    fetchAndDispatchAccountUsers as updateStateAfterDeleteUser
} from "../../tsActions";
import {
    useAccountUsersWD,
    useDeviceTargetUserLinksOrEmpty,
} from "../../../users/hooks";
import { APISendMePasswordResetLink } from "../../api";
import { APIUpdatePasswordByAdmin } from "../../../credential/api";
import AccounStore from "../../../accounts/store";
import AddUserModal from "./AddUserModal";
import Button from "@binders/ui-kit/lib/elements/button";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import {
    EMAIL_DOMAINS_TO_HIDE_IN_TABLE
} from "@binders/client/lib/clients/userservice/v1/constants";
import { FlashMessages } from "../../../logging/FlashMessages";
import Impersonate from "@binders/ui-kit/lib/elements/icons/Impersonate";
import Key from "@binders/ui-kit/lib/elements/icons/Key";
import Link from "@binders/ui-kit/lib/elements/icons/Link";
import Loader from "@binders/ui-kit/lib/elements/loader";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { ResetPasswordModal } from "./ResetPasswordModal";
import Settings from "@binders/ui-kit/lib/elements/icons/Settings";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import UserEditModal from "./userEditModal";
import { WebDataState } from "@binders/client/lib/webdata";
import autobind from "class-autobind";
import colors from "@binders/ui-kit/lib/variables";
import cx from "classnames";
import { exportRowsToSheetsFiles } from "@binders/client/lib/util/xlsx";
import { isDev } from "@binders/client/lib/util/environment";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { startImpersonation } from "@binders/client/lib/util/impersonation";
import { useActiveAccountId } from "../../../accounts/hooks";
import { useMyDetails } from "../../../users/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../users.styl";
import "./manageusers.styl";

const getUsersCounts = (users) => {
    return users.reduce((reduced, user) => {
        const { login, licenseCount: userLicenseCount } = user;
        if (isManualToLogin(login)) {
            return reduced;
        }
        const { userCount, licenseCount } = reduced;
        return {
            userCount: userCount + 1,
            licenseCount: licenseCount + userLicenseCount,
        }
    }, { userCount: 0, licenseCount: 0 })
}

class ManageUsers extends React.Component {

    static getDerivedStateFromProps(nextProps, prevState) {
        const filteredUsers = prevState.query ?
            prevState.filteredUsers :
            nextProps.usersWD.dataOrUndefined || [];
        return {
            ...prevState,
            filteredUsers,
            users: nextProps.usersWD.dataOrUndefined || [],
        };
    }

    constructor(props) {
        super(props);
        autobind(this);

        this.state = {
            userFacingRemoval: undefined,
            isAddModalShown: false,
            inviteMail: "",
            selectedDomain: props.domains[0],
            showBadEmailValidation: false,
            showUsedEmailValidation: false,
            ...getUsersCounts(props.usersWD.dataOrUndefined || []),
            users: props.usersWD.dataOrUndefined || [],
            userToResetPassword: undefined,
            userFacingEdit: undefined,
            showUserAccessList: false,
            userGeneratingInvitationLink: undefined,
        }
    }


    getHeaders(canAccessBackend) {
        const { t } = this.props;

        return [
            t(TK.General_Name).toUpperCase(),
            t(TK.General_Email).toUpperCase(),
            { label: t(TK.General_Created).toUpperCase(), type: "date" },
            { label: t(TK.User_LastOnline).toUpperCase(), type: "date" },
            t(TK.General_Invite).toUpperCase(),
            "",
            "",
            "",
            ...(canAccessBackend ? [""] : []),
        ];
    }

    async deleteUser() {
        const { account, deviceTargetUserLinks, myDetails, removeDeviceTargets } = this.props;
        if (!myDetails) return;
        const { userFacingRemoval } = this.state;
        const deviceUserTargetIds = deviceTargetUserLinks.find(du => du.deviceUserId === userFacingRemoval.id)?.userIds || [];
        await removeUserFromAccount(
            account.id,
            userFacingRemoval.id,
            myDetails.user,
        );
        this.setState({
            userFacingRemoval: undefined,
        })
        const deletedDeviceTargetIds = await removeDeviceTargets.mutateAsync({
            accountId: account.id,
            user: userFacingRemoval,
            myUser: myDetails.user,
            deviceTargetUserIdsOfRemovedUser: deviceUserTargetIds,
        });
        const updatedMembersIds = account.members.filter(memberId => [userFacingRemoval.id, ...deletedDeviceTargetIds].indexOf(memberId) === -1);
        await updateStateAfterDeleteUser(account.id, updatedMembersIds);
    }

    cancelDelete() {
        this.setState({
            userFacingRemoval: undefined,
        });
    }

    showAddUserModal() {
        this.setState({
            isAddModalShown: true,
        });
    }

    hideAddUserModal() {
        this.setState({
            isAddModalShown: false,
        });
    }

    formatLoginForTable(login) {
        if (EMAIL_DOMAINS_TO_HIDE_IN_TABLE.some(d => login.includes(d))) {
            return "";
        }
        return login;
    }

    toUserTableRowArray(user) {
        const { myDetails, t } = this.props;
        const isManualTo = isManualToLogin(user.login);
        const canAccessBackend = myDetails?.canAccessBackend ?? false
        const isMe = myDetails?.user.login === user.login;
        return [
            {
                uiValue: (
                    <div
                        className="userTable-row-displayName">
                        {(user.displayName === user.login) ? "" : user.displayName}
                    </div>
                ),
                value: user.displayName,
                exportValue: user.displayName,
            },
            {
                uiValue: (
                    <span {...(user.bounced ? { className: "userTable-row-error" } : null)}>
                        {this.formatLoginForTable(user.login)}
                    </span>
                ),
                value: user.login,
            },
            user.created ? new Date(user.created) : undefined,
            user.lastOnline ? new Date(user.lastOnline) : undefined,
            this.maybeRenderInvationLink(isManualTo, user),
            this.renderEditUser(user),
            this.maybeRenderResetPassword(user),
            <label title={t(TK.User_RemoveUserFromAccount)} onClick={isMe ? Function.prototype : () => this.setState({ userFacingRemoval: user })}>
                {Delete(
                    isMe ?
                        { fontSize: 19, cursor: "default", color: colors.disabledColor } :
                        { fontSize: 19, cursor: "pointer" },
                    isMe ? "" : colors.accentColor
                )}
            </label>,
            ...(canAccessBackend ?
                [
                    <label
                        title={t(TK.User_Impersonate)}
                        className="impersonate-lbl"
                        onClick={myDetails ? this.getImpersonateFn(isMe, user.id, myDetails.user.id) : undefined}
                    >
                        {Impersonate(
                            isMe ?
                                { fontSize: 19, cursor: "default", color: colors.disabledColor } :
                                { fontSize: 19, cursor: "pointer" },
                            isMe ? "" : colors.accentColor
                        )}
                    </label>,
                ] :
                []),
        ]
    }

    openEditUserModal(user) {
        return async () => {
            const userFacingEdit = await populateUser(user);
            this.setState({ userFacingEdit });
        }
    }

    openUserAccessListModal(user) {
        return () => {
            const { account: { id: accountId } } = this.props;
            loadListUserAccess(accountId, user.id);
            this.setState({ showUserAccessList: true });
        }
    }

    closeUserAccessListModal() {
        this.setState({ showUserAccessList: false });
    }

    getImpersonateFn(isMe, userId, myUserId) {
        return async () => {
            if (isMe) {
                return;
            }
            startImpersonation(AccounStore.getActiveAccountId(), userId, myUserId);
        };
    }

    isManualToRow(rowArray) {
        return isManualToLogin(rowArray[1].value);
    }

    getInvitationLink(inviteToken) {
        const [domain] = this.props.domains;
        const { selectedDomain } = this.state;
        const scheme = isDev() ? "http" : "https";
        return `${scheme}://${domain}/invite/${inviteToken}?domain=${selectedDomain}`;
    }

    buildCopyInviteLink(user) {
        const { id } = user;
        let { invitationToken } = user;
        const { t } = this.props;
        return async () => {
            if (!invitationToken) {
                this.setState({
                    userGeneratingInvitationLink: id,
                });
                invitationToken = await generateInvitationToken(user.id);
                this.setState({
                    userGeneratingInvitationLink: undefined,
                });
            }
            const invitationLink = this.getInvitationLink(invitationToken);
            const textArea = document.createElement("textarea");
            textArea.value = invitationLink;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                const successful = document.execCommand("copy");
                if (successful) {
                    FlashMessages.info(t(TK.User_InvitationLinkCopied));
                    document.body.removeChild(textArea);
                    return;
                }
                FlashMessages.error(t(TK.User_InvitationLinkCopyFailed));
            } catch (err) {
                FlashMessages.error(t(TK.User_InvitationLinkCopyError, { error: err }));
            }
            document.body.removeChild(textArea);
        };
    }

    filterUsers(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const queryTokens = normalizedQuery.split(" ");

        const matches = (str) => !queryTokens.some(qt => !str.includes(qt));

        return user => {
            const name = user.displayName ? user.displayName.toLowerCase() : "";
            if (matches(name)) return true;

            const login = user.login ? user.login.toLowerCase() : "";
            if (matches(login)) return true;

            return false;
        };
    }

    onSearch(query) {
        const users = this.props.usersWD.dataOrUndefined || [];
        const result = !query ? users : users.filter(this.filterUsers(query));
        this.setState({
            query,
            filteredUsers: result,
            userCount: result.filter(u => !isManualToLogin(u.login)).length,
        });
    }

    maybeRenderInvationLink(isFromManual, user) {
        if (this.state.userGeneratingInvitationLink === user.id) {
            return CircularProgress();
        }
        const isException = isFromManual || user.lastOnline || isDeviceUserTarget(user, this.props.deviceTargetUserLinks) || user.isPasswordless;
        return isException ?
            "" :
            (
                <span
                    onClick={this.buildCopyInviteLink(user)}
                    className="invitation-link"
                >
                    {Link({ fontSize: 19 })}
                </span>
            );
    }

    openResetPasswordConfim(user) {
        return () => this.setState({
            userToResetPassword: user,
        });
    }


    cancelResetPassword() {
        this.setState({
            userToResetPassword: undefined,
        });
    }

    async sendPasswordResetEmail() {
        const { t } = this.props;
        const { userToResetPassword } = this.state;
        const { displayName, login } = userToResetPassword;
        await APISendMePasswordResetLink(userToResetPassword.login);
        this.setState({
            userToResetPassword: undefined,
        });
        FlashMessages.success(t(TK.User_ResetPasswordSent, { displayName, login }));
    }

    async updateUserPassword(password) {
        const { t } = this.props;
        const { userToResetPassword } = this.state;
        const { id } = userToResetPassword;
        await APIUpdatePasswordByAdmin(id, password, this.props.account.id);
        this.setState({
            userToResetPassword: undefined,
        });
        FlashMessages.success(t(TK.User_UpdateSuccess));
    }

    async dataToArrayOfArray() {
        const { t } = this.props;
        const { filteredUsers } = this.state;
        const headers = [
            t(TK.General_Name).toUpperCase(),
            t(TK.General_Email).toUpperCase(),
            t(TK.General_Created).toUpperCase(),
            t(TK.User_LastOnline).toUpperCase(),
            t(TK.User_Groups).toUpperCase(),
            t(TK.General_Invite).toUpperCase(),
        ];
        const userIds = (filteredUsers || []).map(u => u.id);
        const usergroupsPerUser = userIds.length && await getGroupsForUsers(userIds, this.props.account.id);

        const getGroupsCsv = (userId) => {
            return (usergroupsPerUser?.[userId] || [])
                .filter(g => !g.isAutoManaged)
                .map(g => g.name).join(";");
        }

        return [
            headers,
            ...filteredUsers.map(user => ([
                user.displayName === user.login ? "" : user.displayName,
                user.login,
                fmtDateIso8601TimeLocalizedTZ(user.created),
                user.lastOnline ?
                    fmtDateIso8601TimeLocalizedTZ(user.lastOnline) :
                    undefined,
                getGroupsCsv(user.id),
                !isManualToLogin(user.login) && !user.lastOnline ?
                    this.getInvitationLink(user.invitationToken) :
                    "",
            ])),
        ]
    }

    async onExportData(type) {
        const data = await this.dataToArrayOfArray();
        const isCsv = (type !== "excel");
        const ext = isCsv ? "csv" : "xlsx";
        const name = `exported_table_${fmtDateIso8601TZ(new Date())}.${ext}`;
        exportRowsToSheetsFiles(
            data,
            "SheetJS",
            name,
            isCsv,
        );
    }

    maybeRenderResetPassword(user) {
        const { t } = this.props;
        const isException = isDeviceUserTarget(user, this.props.deviceTargetUserLinks) || user.isPasswordless;
        return isException ?
            "" :
            (
                <label
                    title={t(TK.User_ResetPasswordCta)}
                    onClick={this.openResetPasswordConfim(user)}
                    className="reset-link">
                    {Key({ fontSize: 19 }, colors.accentColor)}
                </label>
            );
    }

    renderEditUser(user) {
        const { t } = this.props;
        return (
            <label
                title={t(TK.General_Settings)}
                onClick={this.openEditUserModal(user)}
                className="reset-link">
                {Settings({ fontSize: 19 }, colors.accentColor)}
            </label>
        );
    }

    renderRemoveUserModal() {
        const { t } = this.props;
        const { userFacingRemoval } = this.state;

        const modalButtons = [
            <Button key="cancel" text={t(TK.General_Cancel)} secondary onClick={this.cancelDelete} />,
            <Button key="ok" text={t(TK.General_Ok)} onClick={this.deleteUser} />,
        ]
        return !!userFacingRemoval && (
            <Modal
                title={t(TK.User_RemoveUserFromAccount)}
                buttons={modalButtons}
                onHide={this.cancelDelete}
                onEnterKey={this.deleteUser}
                onEscapeKey={this.cancelDelete}
            >
                <p className="user-removal-confirmation">
                    {t(TK.User_RemovalConfirmationFirstLine)}
                    <strong> {t(TK.User_RemovalConfirmationSecondLine, { userFacingRemoval })} </strong>
                    {t(TK.User_RemovalConfirmationThirdLine)}
                </p>
            </Modal>
        );
    }

    renderResetPasswordModal() {
        const { userToResetPassword } = this.state;
        return !!userToResetPassword && (
            <ResetPasswordModal
                sendPasswordResetEmail={this.sendPasswordResetEmail}
                updateUserPassword={this.updateUserPassword}
                onHide={this.cancelResetPassword}
            />
        );
    }

    async cancelEditUser() {
        await this.props.dirtyStateContext.handleDirtyState(DirtyStateId.deviceUserTargets);
        this.setState({ userFacingEdit: undefined });
    }

    async onChangeUserProp(prop, val) {
        const { t, account: { id: accountId } } = this.props;
        const { userFacingEdit } = this.state;
        const updatedUser = {
            ...userFacingEdit,
            [prop]: val,
        };
        if (prop === "login") {
            if (!val) {
                FlashMessages.error(t(TK.User_EmailEmptyError));
                return;
            }
            if (!validator.isEmail(val)) {
                FlashMessages.error(t(TK.User_NotCorrectEmailAddress));
                return;
            }
            if (isManualToLogin(val)) {
                FlashMessages.error(t(TK.User_NotAllowedEmailDomain));
                return;
            }
            const isNewLogin = val !== userFacingEdit.login;
            if (isNewLogin) {
                updatedUser.bounced = false;
            }
        }
        try {
            await updateUser(updatedUser, accountId);
            if (this.state.userFacingEdit !== undefined) {
                this.setState({ userFacingEdit: updatedUser });
            }
            FlashMessages.success(t(TK.User_DetailsUpdatedSuccessfully));
        } catch (ex) {
            if (ex.statusCode === 400) {
                FlashMessages.error(t(TK.User_LoginAlreadyUsed));
            } else {
                FlashMessages.error(t(TK.General_SomethingWentWrong));
            }
        }
    }

    renderEditUserDetailsModal() {
        const { userFacingEdit } = this.state;
        const { account: { id: accountId } } = this.props;
        const forbidsLoginChangeFn = (login) => this.isCurrentUserLogin(login) || isManualToLogin(login);
        return !userFacingEdit ?
            null :
            (
                <UserEditModal
                    onCancelUserEdit={this.cancelEditUser}
                    onChangeUserProp={this.onChangeUserProp}
                    userFacingEdit={userFacingEdit}
                    accountId={accountId}
                    forbidsLoginChangeFn={forbidsLoginChangeFn}
                />
            );
    }

    isCurrentUserLogin(login) {
        const { myDetails } = this.props;
        return myDetails?.user.login === login;
    }

    composeUserCountInfo() {
        const { account, t } = this.props;
        const { userCount, licenseCount } = this.state;
        const { maxNumberOfLicenses } = account;
        const maxNumberOfLicensesExceeded = licenseCount > maxNumberOfLicenses;
        const userCountLbl = t(TK.User_UserCount, { count: userCount });
        let licensesSuffix = "(";
        if (userCount !== licenseCount || maxNumberOfLicensesExceeded) {
            licensesSuffix = `${licensesSuffix}${t(TK.User_LicenseCount, { count: licenseCount })} `;
        }
        licensesSuffix = `${licensesSuffix}${t(TK.User_MaxNumberOfLicensesExceeded, { count: maxNumberOfLicenses })})`;
        return {
            infoLbl: `${userCountLbl} ${licensesSuffix}`,
            maxNumberOfLicensesExceeded,
        }
    }

    renderMaxUserInfo() {
        const {
            infoLbl,
            maxNumberOfLicensesExceeded,
        } = this.composeUserCountInfo();
        return (
            <label
                className={cx(
                    "manage-users-maxusersinfo",
                    {
                        "manage-users-maxusersinfo--limit-exceeded": maxNumberOfLicensesExceeded,
                    }
                )}
            >
                {infoLbl}
            </label>
        )
    }

    render() {
        const { account, myDetails, t, usersWD } = this.props;
        const canAccessBackend = myDetails?.canAccessBackend;
        if (usersWD.state === WebDataState.PENDING) {
            return (
                <Loader />
            )
        }
        const { filteredUsers, licenseCount } = this.state;
        const { maxNumberOfLicenses } = account;
        const maxNumberOfLicensesWithAllowance = maxNumberOfLicenses + Math.round(maxNumberOfLicenses * 0.1);
        const maxNumberOfLicensesWithAllowanceExceeded = licenseCount > maxNumberOfLicensesWithAllowance;
        const userData = filteredUsers.map(this.toUserTableRowArray);
        return (
            <div className="manage-users">
                {this.renderRemoveUserModal()}
                {this.state.isAddModalShown && this.props.myDetails && (
                    <AddUserModal
                        users={this.props.usersWD.dataOrUndefined || []}
                        myDetails={this.props.myDetails}
                        onRequestHide={this.hideAddUserModal}
                    />
                )}
                {this.renderResetPasswordModal()}
                {this.renderEditUserDetailsModal()}

                <div className="manage-users-cta">
                    <Button
                        text={t(TK.User_AddUser)}
                        onClick={this.showAddUserModal}
                        isEnabled={!maxNumberOfLicensesWithAllowanceExceeded}
                    />
                    {this.renderMaxUserInfo()}
                </div>
                <div className="manage-users-overview">
                    <Table
                        customHeaders={this.getHeaders(canAccessBackend)}
                        data={userData}
                        disableRowFn={this.isManualToRow}
                        onSearch={this.onSearch}
                        exportable
                        searchable
                        onExportData={this.onExportData}
                    />
                </div>
            </div>
        );
    }
}

const ManageUsersWithHooks = withHooks(ManageUsers, () => ({
    deviceTargetUserLinks: useDeviceTargetUserLinksOrEmpty(),
    dirtyStateContext: useDirtyStateContext(),
    myDetails: useMyDetails(),
    removeDeviceTargets: useRemoveDeviceTargets(useActiveAccountId()),
    usersWD: useAccountUsersWD(),
}));

export default withTranslation()(ManageUsersWithHooks);
