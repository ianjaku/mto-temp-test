import * as React from "react";
import { APIGetAlert, APIUpdateAlert } from "../../api/notificationService";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { FC, useEffect, useState } from "react";
import { Alert } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { AlertForm } from "./form";
import { ValidationErrors } from "../entities/validation";
import { browserHistory } from "react-router";
import { validateCreateAlertParams } from "./helpers";

export const AlertEdit: FC<{ params: { alertId: string } }> = (props) => {
    const [alert, setAlert] = useState<Alert>(null);
    const [errorMessages, setErrorMessages] = useState<string[]>([]);

    useEffect(() => {
        if (props.params.alertId == null) {
            throw new Error("Alert ID is required");
        }
        APIGetAlert(props.params.alertId).then(setAlert);
    }, [setAlert, props.params.alertId]);

    const submit = async () => {
        const errors = validateCreateAlertParams(alert);
        setErrorMessages(errors);
        if (errors.length > 0) return;
        await APIUpdateAlert(alert);
        browserHistory.push("/alerts");
    }

    return (
        <>
            <ContentTitleRow title="Edit alert">
                <ContentTitleAction
                    icon=""
                    label="Cancel"
                    variant="outline"
                    handler={() => browserHistory.push("/alerts/overview")}
                />
                <ContentTitleAction
                    icon="floppy-o"
                    label="Save"
                    handler={submit}
                />
            </ContentTitleRow>
            <ValidationErrors errors={errorMessages} />
            {alert && (
                <AlertForm
                    initialValues={alert}
                    onChange={(change) => setAlert({ ...alert, ...change })}
                />
            )}
        </>
    );
}
