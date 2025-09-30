import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import { ImportUsersHistoryRow, ImportUsersIgnoredRow } from "./ImportCevaUsersTable";
import { groupBy, toPairs } from "ramda";
import { BareTable } from "./BareTable";
import { UserImportAction } from "@binders/client/lib/clients/userservice/v1/contract";
import { getCevaTagValue } from "./cevaUtils";

const { useMemo } = React;

type CevaImportActionGroupsProps = {
    userImportAction: UserImportAction;
}

const CevaImportActionGroups: React.FC<CevaImportActionGroupsProps> = ({ userImportAction }) => {

    const services = useMemo(
        () => toPairs(groupBy(u => getCevaTagValue(u.user, "department"), userImportAction.userImportResults))
            .map(([name, userImportResults]) => ({ name, userImportResults }))
            .sort((a, b) => a.name < b.name ? -1 : 1),
        [userImportAction],
    );

    return (
        <div className="ceva cevaGroupSet">
            <AccordionGroup>
                {services.map(
                    service => service.name.trim().length ?
                        (
                            <Accordion key={service.name} header={service.name}>
                                <BareTable
                                    data={service.userImportResults || []}
                                    className="import-users-table"
                                    Row={ImportUsersHistoryRow}
                                    idCol={t => t.user?.id || ""}
                                    headers={[
                                        "Name",
                                        "Organization",
                                        "Service",
                                        "MW Number",
                                    ]}
                                />
                            </Accordion>
                        ) :
                        (
                            <Accordion key="ignored" header={<i>Ignored users</i>}>
                                <BareTable
                                    data={service.userImportResults || []}
                                    className="import-users-table"
                                    Row={ImportUsersIgnoredRow}
                                    idCol={t => t.user?.id || ""}
                                    headers={[
                                        "Name",
                                    ]}
                                />
                            </Accordion>
                        )
                )}
            </AccordionGroup>
        </div>
    )
}

export default CevaImportActionGroups;