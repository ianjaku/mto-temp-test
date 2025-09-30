import * as React from "react";
import { TFunction, useTranslation } from "@binders/client/lib/react/i18n";
import { extractUserTagsColumns, toTableData, toTableHeaders } from "../../helpers";
import { IUserActionFilter } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { SORT } from "@binders/ui-kit/lib/elements/Table";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { useUserActions } from "../../hooks";

const AccountAnalyticsBody: React.FC<{
    userActionsFilter: Omit<IUserActionFilter, "accountId">;
}> = ({
    userActionsFilter,
}) => {
    const { t } = useTranslation();
    const { data, isLoading, isError } = useUserActions(userActionsFilter);

    const accountAnalytics = React.useMemo(() => {
        if (!data) {
            return null;
        }
        const { userActions, exception } = data;
        const userTagNames = extractUserTagsColumns(userActions);
        const hasUsergroupsColumn = userActions.some(userAction => userAction.userGroupNames.length);
        const userActionsTableHeaders = toTableHeaders(t, userTagNames, hasUsergroupsColumn);
        const userActionsTableData = toTableData(t, userActions, userTagNames, hasUsergroupsColumn);
        return {
            userActions,
            userActionsTableData,
            userActionsTableHeaders,
            userTagNames,
            exception,
        };
    }, [t, data]);

    if (isLoading) {
        return (
            <span className="account-analytics-infomessage">
                {t(TK.User_ActionLoading)}...
            </span>
        );
    }

    if (isError) {
        return (
            <span className="account-analytics-errormessage">
                {t(TK.Analytics_LoadFail)}
            </span>
        );
    }

    if (accountAnalytics.exception) {
        return (
            <span className="account-analytics-infomessage">
                {buildExceptionMessage(t, accountAnalytics.exception)}
            </span>
        );
    }

    if (!(accountAnalytics.userActions?.length)) {
        return (
            <span className="account-analytics-infomessage">
                {t(TK.User_ActionNonForFilter)}.
            </span>
        );
    }

    return (
        <div className="account-analytics-table-wrapper">
            <Table
                customHeaders={accountAnalytics.userActionsTableHeaders}
                data={accountAnalytics.userActionsTableData}
                exportDataTransformFn={toExplicitColumnsContent}
                searchable
                exportable
                defaultSort={{ columnIndex: 4, order: SORT.DESC }}
            />
        </div>
    );
}

function toExplicitColumnsContent(tableData) {
    return tableData.map(tableRowWithRef => {
        const tableRow = [...tableRowWithRef];
        if (tableRow[1] === "-" && tableRow[0] !== "public") {
            tableRow[1] = tableRow[0];
        }
        return tableRow;
    });
}

function buildExceptionMessage(t: TFunction, exception: string): string {
    const { type, total, limit } = JSON.parse(exception);
    return type === "limit" ?
        t(TK.User_ActionLimitExceeded, { total, limit }) :
        t(TK.General_UnknownError)
}

export default AccountAnalyticsBody;