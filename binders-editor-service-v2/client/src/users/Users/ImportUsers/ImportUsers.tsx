import * as React from "react";
import { buildCsvContent, manualtoUsersToTable } from "../../../hooks/parseManualtoCsv";
import {
    useAccountUserImportActionsOrEmpty,
    useAccountUsersOrEmpty,
    useMyDetails,
} from "../../hooks";
import Button from "@binders/ui-kit/lib/elements/button";
import { FEATURE_CEVA } from "@binders/client/lib/clients/accountservice/v1/contract";
import { ImportCevaUsersBody } from "../CevaImport/ImportCevaUsersBody";
import { ImportCevaUsersModal } from "../CevaImport/ImportCevaUsersModal";
import { ImportManualtoUsersHistory } from "./ImportManualtoUsersHistory";
import { ImportManualtoUsersModal } from "./ImportManualtoUsersModal";
import Loader from "@binders/ui-kit/lib/elements/loader";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UserImportAction } from "@binders/client/lib/clients/userservice/v1/contract";
import cx from "classnames";
import { downloadCsvTextFile } from "./utils";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { useActiveAccountFeatures } from "../../../accounts/hooks";
import { useCevaImportProcess } from "../CevaImport/useCevaUserImport";
import { useGetAccountUsergroupsIncludingAutoManaged } from "../../query";
import { useImportUsers } from "../../../hooks/useImportUsers";
import { useSendInvitationMails } from "../../../hooks/useSendInvitationMails";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./importUsers.styl";

const { useCallback, useMemo, useState } = React;

export type ImportUsersProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: any;
    domains: string[];
}


export const ImportUsers: React.FC<ImportUsersProps> = ({
    account,
    domains,
}) => {
    const { t } = useTranslation();
    const features = useActiveAccountFeatures();
    const [activeUserImportAction, setActiveUserImportAction] = useState<UserImportAction | undefined>();
    const invitations = useSendInvitationMails({ account, domains });
    const [isModalVisible, setIsModalVisible] = useState(false);
    const myDetails = useMyDetails();
    const userImportActions = useAccountUserImportActionsOrEmpty();
    const usergroups = useGetAccountUsergroupsIncludingAutoManaged();
    const users = useAccountUsersOrEmpty();

    const exportToCsv = useCallback(() => {
        const csv = manualtoUsersToTable(activeUserImportAction.userImportResults.filter(r => r.invitationLink));
        downloadCsvTextFile(buildCsvContent(csv));
    }, [activeUserImportAction]);

    const onChangeOpenIndexes = useCallback((openIndexes) => {
        setActiveUserImportAction(userImportActions[openIndexes.pop() || 0])
    }, [userImportActions, setActiveUserImportAction]);

    const { maxNumberOfLicenses } = account;
    const userCount = users?.filter(u => !isManualToLogin(u.login)).length;
    const maxNumberOfLicensesWithAllowance = maxNumberOfLicenses + Math.round(maxNumberOfLicenses * 0.1);
    const maxNumberOfLicensesWithAllowanceExceeded = userCount > maxNumberOfLicensesWithAllowance;

    const isCevaEnabled = features.includes(FEATURE_CEVA);

    const ImportUsersBody = isCevaEnabled ? ImportCevaUsersBody : ImportManualtoUsersHistory;
    const cevaImportHook = useCevaImportProcess({ account, myDetails });
    const standardImportHook = useImportUsers({ account, domains, myDetails, usergroups, users });
    const modal = useMemo(() => isCevaEnabled ?
        (
            <ImportCevaUsersModal
                importUsers={cevaImportHook}
                isVisible={isModalVisible}
                setIsVisible={setIsModalVisible}
                usergroups={usergroups}
            />
        ) :
        (
            <ImportManualtoUsersModal
                importUsers={standardImportHook}
                isVisible={isModalVisible}
                setIsVisible={setIsModalVisible}
                usergroups={usergroups}
            />
        ), [isCevaEnabled, cevaImportHook, standardImportHook, isModalVisible, usergroups]);

    if (usergroups.isLoading) {
        return <Loader />
    }
    return (
        <div className={cx("import-users", { "import-users--ceva": isCevaEnabled })}>
            {(userCount > maxNumberOfLicenses) ?
                (
                    <label className="import-users-limit-exceeded-warning">
                        {t(TK.User_MaxNumberOfLicenses, { count: userCount, maxNumberOfLicenses })}
                    </label>
                ) :
                <></>}
            <div className="import-users-cta">
                <Button
                    isEnabled={!maxNumberOfLicensesWithAllowanceExceeded}
                    onClick={() => setIsModalVisible(val => !val)}
                    text={t(TK.User_NewUserImport)}
                />
            </div>
            <div className="import-users-overview">
                <ImportUsersBody
                    userImportActions={userImportActions}
                    isSendingInvitationMails={invitations.isSendingInvitationMails}
                    onRecordSelected={onChangeOpenIndexes}
                    onExport={isCevaEnabled ? undefined : exportToCsv}
                    onSendInvitationMails={() => invitations.sendInvitationMails(activeUserImportAction.userImportResults)}
                />
            </div>
            {modal}
        </div>
    );
}

export default ImportUsers;
