import * as React from "react";
import {
    FEATURE_DEVICE_USER_IMPERSONATION,
    FEATURE_USERTOKEN_LOGIN
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import { fmtDateIso8601TimeLocalizedTZ, fmtNow } from "@binders/client/lib/util/date";
import { APISearchUserReadSessions } from "../../../analytics/api";
import Button from "@binders/ui-kit/lib/elements/button";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import CopyButton from "@binders/ui-kit/lib/elements/button/CopyButton";
import DeviceUserSettings from "./DeviceUserSettings/DeviceUserSettings";
import { FC } from "react";
import { FlashMessages } from "../../../logging/FlashMessages";
import Icon from "@binders/ui-kit/lib/elements/icons";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import {
    TRANSLATOR_PSEUDO_NAME
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserReadSessionsFilter } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { exportRowsToSheetsFiles } from "@binders/client/lib/util/xlsx";
import { getUiRoleName } from "../../../authorization/tsHelpers";
import { loadListUserAccess } from "../../actions";
import { secondsToUserReadableFormat } from "@binders/client/lib/util/time";
import { useGetGroupsForUser } from "../../query";
import { useIsAccountFeatureActive } from "../../../accounts/hooks";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@binders/client/lib/react/i18n";
import vars from "@binders/ui-kit/lib/variables";

export type OnChangeUserPropFn = (prop: keyof User, val: User[keyof User]) => Promise<void>;
export type ForbidsLoginChangeFn = (login: string) => boolean;
export interface IUserEditModalProps {
    onChangeUserProp: OnChangeUserPropFn,
    userFacingEdit: User,
    accountId: string,
    onCancelUserEdit: (e?: React.MouseEvent) => void,
    forbidsLoginChangeFn: ForbidsLoginChangeFn
}

const UserEditModal: FC<IUserEditModalProps> = ({
    onChangeUserProp,
    userFacingEdit,
    accountId,
    onCancelUserEdit,
    forbidsLoginChangeFn,
}) => {
    const { t } = useTranslation();
    const deviceUsersFeatureEnabled = useIsAccountFeatureActive(FEATURE_DEVICE_USER_IMPERSONATION);
    const userId = userFacingEdit.id ?? "public";

    return (
        <Modal
            classNames="editModal"
            title={t(TK.User_UserDetails)}
            buttons={ModalButtons(onCancelUserEdit)}
            onHide={onCancelUserEdit}
            onEscapeKey={onCancelUserEdit}
        >
            <div className="editModal-body">
                <Tabs>
                    <UserDataPane
                        label={t(TK.User_UserData)}
                        userFacingEdit={userFacingEdit}
                        onChangeUserProp={onChangeUserProp}
                        forbidsLoginChangeFn={forbidsLoginChangeFn}
                    />
                    <GroupsPaneContent
                        label={t(TK.User_Usergroups)}
                        userId={userId}
                        accountId={accountId}
                    />
                    <UserAcessListPane
                        label={t(TK.Acl_AccessTitle)}
                        userId={userId}
                        accountId={accountId}
                    />
                    <UserReadSessions
                        accountId={accountId}
                        label={t(TK.Analytics_ReadSessions)}
                        userId={userId}
                    />
                    {deviceUsersFeatureEnabled ?
                        <DeviceUserTab
                            label={t(TK.User_Device)}
                            user={userFacingEdit}
                            onChangeUserProp={onChangeUserProp}
                        /> :
                        null}
                </Tabs>
            </div>
        </Modal>
    );
}

const ModalButtons = (onCancelUserEdit: (e?: React.MouseEvent) => void) => {
    const { t } = useTranslation();
    return [
        <Button key="close" text={t(TK.General_Close)} secondary onClick={onCancelUserEdit} />,
    ];
}

const GroupsPaneContent = (props: {
    /**
    * label property is needed for Tabs component to display the tab label
    */
    label: string;
    userId: string;
    accountId: string;
}) => {
    const { t } = useTranslation();
    const groupsForUser = useGetGroupsForUser(props.userId, props.accountId);
    const groupsForUserTableData = groupsForUser.data?.map(ug => [ug.name]) ?? [];
    return (
        <Pane label={props.label}>
            {groupsForUserTableData.length === 0 ?
                <label>{t(TK.User_NotInGroup)}</label> :
                <Table
                    recordsPerPage={5}
                    customHeaders={[""]}
                    data={groupsForUserTableData}
                />}
        </Pane>
    );
};

const UserDataPane = (props: {
    /**
    * label property is needed for Tabs component to display the tab label
    */
    label: string;
    userFacingEdit: User;
    onChangeUserProp: OnChangeUserPropFn;
    forbidsLoginChangeFn: ForbidsLoginChangeFn;
}) => {
    const { label, userFacingEdit, onChangeUserProp, forbidsLoginChangeFn } = props;
    const { t } = useTranslation();
    const tokensFeatureEnabled = useIsAccountFeatureActive(FEATURE_USERTOKEN_LOGIN);
    const { id, login, displayName } = userFacingEdit;
    const onCopyUserId = () => {
        const el = document.createElement("textarea");
        el.value = id;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        FlashMessages.info(t(TK.General_TextCopiedToClipboard));
    }
    const userId = tokensFeatureEnabled ?
        (
            <div className="editModal-body-row">
                <span className="editModal-body-label">Id</span>
                <Input
                    type="text"
                    name="userId"
                    value={id}
                    disabled={true}
                />
                <CopyButton onClick={onCopyUserId} tooltip={t(TK.General_Copy)} />
            </div>
        ) :
        undefined;

    const invokeOnlyOnChange = (initialValue: string, prop: keyof User) =>
        (e: React.FocusEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            if (initialValue !== newValue) {
                onChangeUserProp(prop, newValue);
            }
        };

    return (
        <Pane label={label}>
            {userId}
            <div className="editModal-body-row">
                <span className="editModal-body-label">{t(TK.General_Email)}</span>
                <Input
                    type="text"
                    name="email"
                    value={login}
                    onBlur={invokeOnlyOnChange(login, "login")}
                    disabled={forbidsLoginChangeFn(login)}
                    useState={true}
                />
            </div>
            <div className="editModal-body-row">
                <span className="editModal-body-label">{t(TK.User_DisplayName)}</span>
                <Input
                    type="text"
                    name="displayName"
                    value={displayName}
                    onBlur={invokeOnlyOnChange(displayName, "displayName")}
                    useState={true}
                />
            </div>
            <div
                className="editModal-body-row"
                style={({
                    display: userFacingEdit.licenseCount === 1 ? "none" : "initial"
                })}
            >
                <span className="editModal-body-label">{t(TK.User_LicensesNumber)}</span>
                <Input
                    type="text"
                    value={userFacingEdit.licenseCount}
                    disabled={true}
                />
            </div>
        </Pane>
    );
};

const UserAcessListPane = (props: {
    /**
    * label property is needed for Tabs component to display the tab label
    */
    label: string;
    accountId: string;
    userId: string;
}) => {
    const { label, accountId, userId } = props;
    const { t } = useTranslation();

    const userAccessList = useQuery({
        queryFn: async () => {
            try {
                const userAccessList = await loadListUserAccess(accountId, userId);
                return userAccessList;
            } catch (ex) {
                FlashMessages.error(t(TK.Analytics_ErrorRetrievingStatistics));
                return [];
            }
        },
        queryKey: ["userEditModal", "UserAccessList", accountId, userId]
    });

    const isTranslatorPresent = useMemo(() => {
        let isTranslatorPresent = false;
        let i = 0;
        if (userAccessList.data) {
            while ((!isTranslatorPresent && i < (userAccessList.data.length))) {
                const access = userAccessList.data[i];
                const role = getUiRoleName({ name: access.role }, access.restrictionSet);
                if (role === TRANSLATOR_PSEUDO_NAME) {
                    isTranslatorPresent = true;
                } else {
                    i++;
                }
            }
        }
        return isTranslatorPresent;
    }, [userAccessList.data]);

    const data = useMemo(
        () => userAccessList.data?.map(access => {
            const role = getUiRoleName({ name: access.role }, access.restrictionSet);
            const isTranslatorRole = role === TRANSLATOR_PSEUDO_NAME;
            return [
                (
                    <div className="user-access-title-wrapper">
                        <div className="user-access-title">
                            <a href={access.itemLink}>{access.itemTitle}</a>
                            {access.itemKind === "collection" ?
                                (
                                    <Icon name="folder_open" />
                                ) :
                                ""}
                        </div>
                    </div>
                ),
                role,
                // eslint-disable-next-line no-nested-ternary
                ...(isTranslatorRole ? [access.restrictionSet.languageCodes[0]] : (isTranslatorPresent ? [""] : [])),
                access.groups,
            ];
        }),
        [isTranslatorPresent, userAccessList.data]
    );

    const customHeaders = [
        t(TK.General_Title),
        t(TK.Acl_Role),
        ...(isTranslatorPresent ? ["LANGUAGE"] : []),
        t(TK.User_Groups),
    ];

    return (
        <Pane label={label}>
            {userAccessList.data ?
                <Table
                    recordsPerPage={5}
                    customHeaders={customHeaders}
                    className="user-access"
                    data={data}
                    searchable
                /> :
                StyledCircularProgress}
        </Pane>
    );
};

const DeviceUserTab = (props: {
    /**
    * label property is needed for Tabs component to display the tab label
    */
    label: string;
    user: User;
    onChangeUserProp: OnChangeUserPropFn;
}) => {
    const { label, user, onChangeUserProp } = props;
    return (
        <Pane label={label}>
            <DeviceUserSettings
                user={user}
                onChangeUserProp={onChangeUserProp}
            />
        </Pane>
    );
}

const UserReadSessions = (props: {
    /**
    * label property is needed for Tabs component to display the tab label
    */
    label: string;
    accountId: string;
    userId: string;
}) => {
    const { accountId, label, userId } = props;
    const { t } = useTranslation();
    const stats = useQuery({
        queryFn: async () => {
            const filterForAPI: UserReadSessionsFilter = {
                accountId: accountId,
                itemIds: [],
                userIds: [userId],
                userGroupIds: [],
                recursive: false,
                startRange: {
                    rangeStart: new Date("1980-01-01")
                },
            };
            try {
                const userActionStatisticsReport = await APISearchUserReadSessions(filterForAPI);
                return userActionStatisticsReport.userActions;
            } catch (ex) {
                FlashMessages.error(t(TK.Analytics_ErrorRetrievingStatistics));
                return [];
            }
        },
        queryKey: ["userEditModal", "UserReadSessions", accountId, userId],
    });

    const onExportData = (data) => {
        return (type) => {
            const arrayOfData = data;
            const isCsv = (type !== "excel");
            const ext = isCsv ? "csv" : "xlsx";
            const name = `exported_table_read_sessions${fmtNow("dd-MM-yyyy")}.${ext}`;
            exportRowsToSheetsFiles(
                arrayOfData,
                "SheetJS",
                name,
                isCsv,
            );
        }
    }

    const data = useMemo(
        () => stats.data?.map(row => {
            const timestamp = row.timestamp ? fmtDateIso8601TimeLocalizedTZ(row.timestamp) : "";
            const duration = secondsToUserReadableFormat(row.duration, t);
            return ([
                {
                    uiValue: row.url ? <a href={row.url} target="_blank" rel="noopener noreferrer">{row.title}</a> : row.title,
                    value: row.title,
                    exportValue: row.title,
                },
                {
                    uiValue: timestamp,
                    value: row.timestamp?.getTime() ?? "",
                    exportValue: timestamp
                },
                {
                    uiValue: duration,
                    value: row.duration,
                    exportValue: row.duration,
                },
            ]);
        }),
        [stats.data, t],
    );

    return (
        <Pane label={label}>
            {stats.data ?
                <Table
                    recordsPerPage={5}
                    searchable
                    exportable
                    onExportData={onExportData(data)}
                    customHeaders={[
                        t(TK.User_ActionItem),
                        t(TK.User_ActionTime),
                        t(TK.User_ActionDuration),
                    ]}
                    data={data}
                /> :
                StyledCircularProgress}
        </Pane>
    )
};

const StyledCircularProgress = CircularProgress("editModal-loader", {}, 14, vars.borderGrayColor)

export default UserEditModal;
