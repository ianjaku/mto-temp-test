import * as React from "react";
import { APIDeleteAlert, APIGetAlert } from "../../api/notificationService";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { FC, useEffect, useState } from "react";
import { Alert } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { browserHistory } from "react-router";

export const AlertDelete: FC<{ params: { alertId: string } }> = (props) => {
    const [alert, setAlert] = useState<Alert>(null);

    useEffect(() => {
        if (props.params.alertId == null) {
            throw new Error("Alert ID is required");
        }
        APIGetAlert(props.params.alertId).then(setAlert);
    }, [setAlert, props.params.alertId]);

    const submit = async () => {
        if (alert == null) return;
        await APIDeleteAlert(alert.alertId);
        browserHistory.push("/alerts");
    }

    return (
        <>
            <ContentTitleRow title="Edit alert">
                <ContentTitleAction
                    icon=""
                    label="Cancel"
                    handler={() => browserHistory.push("/alerts/overview")}
                />
                <ContentTitleAction
                    icon="times"
                    label="Delete"
                    handler={submit}
                />
            </ContentTitleRow>
            Are you sure you want to delete the alert with message: {alert?.message}
        </>
    );
}
