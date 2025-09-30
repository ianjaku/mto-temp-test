import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import AddCircle from "@binders/ui-kit/lib/elements/icons/AddCircle";
import { BareTable } from "./BareTable";
import { ImportCevaUsersAddNew } from "./ImportCevaUsersAddNew";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UsersManageRow } from "./ImportCevaUsersTable";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { containsInValues } from "../ImportUsers/utils";
import useCurrentCevaUsersGroups from "./useCurrentCevaUsersGroups";
import "./cevaStyles.styl";

const { useMemo, useState } = React;

interface Props {
    query?: string;
}

const CurrentCevaUsersGroups: React.FC<Props> = ({ query }) => {
    const { usergroups, isLoading } = useCurrentCevaUsersGroups();
    const [isAddNewUserModalVisible, setIsAddNewUserModalVisible] = useState(false);
    const [newUserDepartment, setNewUserDepartment] = useState("");

    const filteredUserGroups = useMemo(() => {
        if (!query) {
            return usergroups;
        }
        return usergroups
            .map(usergroup => ({
                ...usergroup,
                members: usergroup.members.filter((u: User) => {
                    return usergroup.group.name.toLowerCase().includes(query.toLowerCase()) ||
                        containsInValues(query, u as unknown as Record<string, unknown>)
                })
            })).filter(({ members }) => members.length);
    }, [query, usergroups]);

    return isLoading ?
        circularProgress() :
        (
            <div className="currentCevaUsersGroups">
                <AccordionGroup>
                    {filteredUserGroups.map(usergroup => {
                        return (
                            <Accordion
                                key={usergroup.group.name}
                                header={<label>{usergroup.group.name}</label>}
                                className="import-users-results-accordion"
                                noGaps={true}
                            >
                                <BareTable
                                    data={usergroup.members || []}
                                    className="import-users-table"
                                    Row={UsersManageRow}
                                    idCol={u => u.id || ""}
                                    headers={[
                                        "Name",
                                        "Organization",
                                        "Service",
                                        "MW Number",
                                        {
                                            label: (
                                                <button
                                                    onClick={() => {
                                                        setIsAddNewUserModalVisible(true);
                                                        setNewUserDepartment(usergroup.group.name);
                                                    }}>
                                                    {AddCircle()}
                                                </button>
                                            )
                                        },
                                    ]}
                                />
                            </Accordion>
                        );
                    })}
                </AccordionGroup>
                <ImportCevaUsersAddNew
                    close={() => setIsAddNewUserModalVisible(false)}
                    department={newUserDepartment}
                    isVisible={isAddNewUserModalVisible}
                />
            </div>
        )
}

export default CurrentCevaUsersGroups;
