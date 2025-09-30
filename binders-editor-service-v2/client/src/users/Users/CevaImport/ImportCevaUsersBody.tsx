import * as React from "react";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import CurrentCevaUsersGroups from "./CurrentCevaUsersGroups";
import { ImportCevaUsersHistory } from "./ImportCevaUsersHistory";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { UserImportAction } from  "@binders/client/lib/clients/userservice/v1/contract";
import "./cevaStyles.styl";

const { useState } = React;

export type ImportCevaUsersBodyProps = {
    userImportActions: UserImportAction[];
    onSendInvitationMails: () => void;
    isSendingInvitationMails: boolean;
    onExport?: () => void;
    onRecordSelected: (openIndices: number[]) => void;
}

export const ImportCevaUsersBody: React.FC<ImportCevaUsersBodyProps> = ({
    userImportActions,
    onSendInvitationMails,
    isSendingInvitationMails,
    onRecordSelected,
}) => {
    const [query, setQuery] = useState("");
    return (
        <div className="ceva ceva-root importCevaUsersBody">
            <Tabs TabsNavSlot={(
                <div className="importCevaUsersBody-search">
                    <SearchInput
                        value={query}
                        onChange={(v) => setQuery(v)}
                        placeholder={"Search ..."}
                    />
                </div>
            )}>
                <Pane label="Current Members">
                    <CurrentCevaUsersGroups
                        query={query}
                    />
                </Pane>
                <Pane label="History">
                    <ImportCevaUsersHistory
                        userImportActions={userImportActions}
                        onSendInvitationMails={onSendInvitationMails}
                        isSendingInvitationMails={isSendingInvitationMails}
                        onRecordSelected={onRecordSelected}
                        query={query}
                    />
                </Pane>
            </Tabs>
        </div>
    )
}

