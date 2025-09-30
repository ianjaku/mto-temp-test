import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import useCurrentCevaUsersGroups, { CurrentCevaUsersGroup } from "./useCurrentCevaUsersGroups";
import { APIImportCevaUsers } from "../../api";
import Button from "@binders/ui-kit/lib/elements/button";
import { CevaUser } from "@binders/client/lib/clients/userservice/v1/contract";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { FlashMessages } from "../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { queryClient } from "../../../application";
import { useActiveAccountId } from "../../../accounts/hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { userServiceName } from "../../query";
import "./cevaStyles.styl";

const { useCallback, useEffect, useMemo, useState } = React;

export type ImportCevaUsersAddNewProps = {
    close: () => void;
    isVisible: boolean;
    department?: string;
}

export const ImportCevaUsersAddNew: React.FC<ImportCevaUsersAddNewProps> = ({ close, department, isVisible, }) => {
    const { t } = useTranslation();
    const accountId = useActiveAccountId();
    const [cevaUser, setCevaUser] = useState<Partial<CevaUser>>({});
    const [isAddingNewUser, setIsAddingNewUser] = useState(false);

    const isValidNewUser = useMemo(
        () =>
            cevaUser.service?.length > 0 &&
            cevaUser.department?.length > 0 &&
            cevaUser.employeeId?.length > 0 &&
            cevaUser.lastName?.length > 0 &&
            cevaUser.firstName?.length > 0,
        [cevaUser],
    );

    useEffect(() => setCevaUser(prev => ({ ...prev, department })), [department]);

    const { isLoading: isLoadingUsergroups, usergroups } = useCurrentCevaUsersGroups();

    const addNewUser = useCallback(async () => {
        setIsAddingNewUser(true);
        try {
            if (!isValidNewUser) {
                FlashMessages.error(t(TK.Exception_SomethingWrong));
                throw new Error("Invalid ceva user");
            }
            await APIImportCevaUsers(accountId, [cevaUser as CevaUser], false);
            await queryClient.invalidateQueries([userServiceName, CurrentCevaUsersGroup, "multiGetGroupMembers"]);
            FlashMessages.success(t(TK.User_CSVSuccess));
            captureFrontendEvent(EditorEvent.UserManagementImportCevaUsers, { count: 1 });
            close();
            setCevaUser({});
        } catch (error) {
            FlashMessages.error(error);
        } finally {
            setIsAddingNewUser(false);
        }
    }, [accountId, cevaUser, close, t, isValidNewUser]);

    if (!isVisible) return <></>;

    return (
        <Modal
            title={t(TK.User_NewUserImport)}
            buttons={[
                <Button
                    isEnabled={isValidNewUser && !isAddingNewUser && !isLoadingUsergroups}
                    text={t(TK.General_Submit)}
                    onClick={addNewUser}
                    inactiveWithLoader={isAddingNewUser}
                />,
            ]}
            hidden={!isVisible}
            onHide={close}
            onEnterKey={addNewUser}
            onEscapeKey={close}
        >
            <div className="ceva-user-form">
                <label htmlFor="department">Department</label>
                <Dropdown
                    onSelectElement={id => setCevaUser(prev => ({ ...prev, department: id }))}
                    elements={usergroups.map(ug => ({ id: ug.group.name, label: ug.group.name }))}
                    selectedElementId={cevaUser.department}
                    type="Department"
                    showBorders={false}
                    width={200}
                />
                <label htmlFor="employeeId">Employee ID</label>
                <Input
                    name="employeeId"
                    onChange={employeeId => setCevaUser(prev => ({ ...prev, employeeId }))}
                    placeholder={"Employee ID ..."}
                />
                <label htmlFor="firstName">{t(TK.User_FirstName)}</label>
                <Input
                    name="firstName"
                    onChange={firstName => setCevaUser(prev => ({ ...prev, firstName }))}
                    placeholder={"First Name ..."}
                />
                <label htmlFor="lastName">{t(TK.User_LastName)}</label>
                <Input
                    name="lastName"
                    onChange={lastName => setCevaUser(prev => ({ ...prev, lastName }))}
                    placeholder={"Last Name ..."}
                />
                <label htmlFor="organization">Organization</label>
                <Input
                    name="organization"
                    onChange={organization => setCevaUser(prev => ({ ...prev, organization }))}
                    placeholder={"Organization ..."}
                />
                <label htmlFor="service">Service</label>
                <Input
                    name="service"
                    onChange={service => setCevaUser(prev => ({ ...prev, service }))}
                    placeholder={"Service ..."}
                />
            </div>
        </Modal>
    );
}

export default ImportCevaUsersAddNew;
