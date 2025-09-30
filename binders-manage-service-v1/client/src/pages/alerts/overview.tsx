import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { NOT_AVAILABLE_DATE, fmtDate } from "@binders/client/lib/util/date";
import { tableCellStyles, tableRowStyles } from "../../search/Table";
import { useEffect, useState } from "react";
import { APIFindAllAlerts } from "../../api/notificationService";
import { Alert } from "@binders/client/lib/clients/notificationservice/v1/contract";
import FontAwesome from "react-fontawesome";
import { SearchAwareText } from "../../search/SearchAwareText";
import { SearchTable } from "../../search/SearchTable";
import { browserHistory } from "react-router";

export const AlertsOverview = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const fetchAlerts = React.useCallback(async () => {
        const alerts = await APIFindAllAlerts();
        setAlerts(alerts);
    }, [])

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts])

    const data = alerts.map(alert => ({
        ...alert,
        alertStatus: statusForAlert(alert),
    }));

    return (
        <>
            <ContentTitleRow title="Active alerts">
                <ContentTitleAction
                    icon="plus"
                    label="Create"
                    handler={() => browserHistory.push("/alerts/create")}
                />
            </ContentTitleRow>
            <SearchTable
                data={data}
                render={alert => <AlertRow alert={alert} />}
                config={{
                    idField: "alertId",
                    index: ["message", "alertStatus"]
                }}
                headers={[
                    { label: "Message", sort: true, get: a => a.message },
                    { label: "Start Date", sort: true, get: a => a.startDate.toString() },
                    { label: "End Date", sort: true, get: a => a.endDate && a.endDate.toString() },
                    { label: "Status", sort: true, get: statusForAlert },
                    "Actions",
                ]}
            />
        </>
    );
}

const formatDate = (date: Date | string) =>
    date ? fmtDate(new Date(date), "yyyy-MM-dd HH:mm") : NOT_AVAILABLE_DATE

const statusForAlert = (alert: Alert) => {
    const now = new Date().toISOString();
    const endDate = new Date(alert.endDate).toISOString();
    const startDate = new Date(alert.startDate).toISOString();
    if (alert.endDate != null && endDate < now) return "Past";
    if (alert.startDate != null && startDate > now) return "Future";
    return "Active";
}

const AlertRow = ({ alert }: { alert: Alert }) => (
    <tr key={alert.alertId} className={tableRowStyles.base}>
        <td className={tableCellStyles.base}>
            <SearchAwareText>{alert.message}</SearchAwareText>
        </td>
        <td className={tableCellStyles.base}>
            <SearchAwareText>{formatDate(alert.startDate)}</SearchAwareText>
        </td>
        <td className={tableCellStyles.base}>
            <SearchAwareText>{formatDate(alert.endDate)}</SearchAwareText>
        </td>
        <td className={tableCellStyles.base}>
            <SearchAwareText>{statusForAlert(alert)}</SearchAwareText>
        </td>
        <td className={tableCellStyles.actions}>
            <FontAwesome
                name="pencil"
                onClick={() => browserHistory.push(`/alerts/edit/${alert.alertId}`)}
            />
            <FontAwesome
                name="times"
                onClick={() => browserHistory.push(`/alerts/delete/${alert.alertId}`)}
            />
        </td>
    </tr>
);

