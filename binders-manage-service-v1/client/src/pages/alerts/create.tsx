import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { APICreateAlert } from "../../api/notificationService";
import { AlertForm } from "./form";
import { ValidationErrors } from "../entities/validation";
import { browserHistory } from "react-router";
import { useState } from "react";
import { validateCreateAlertParams } from "./helpers";

const defaults = {
    message: "",
    adminsOnly: false,
    cooldownHours: -1,
    startDate: new Date(),
    endDate: null,
    accountIds: [],
    buttonText: "",
    buttonLink: ""
}

export const AlertCreate = () => {
    const [values, setValues] = useState(defaults);
    const [errorMessages, setErrorMessages] = useState<string[]>([]);

    const submit = async () => {
        const errors = validateCreateAlertParams(values);
        setErrorMessages(errors);
        if (errors.length > 0) return;
        await APICreateAlert(values);
        browserHistory.push("/alerts");
    }

    return <>
        <ContentTitleRow title="Create a new alert">
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
        <div className="mb-[20px]">
            <ValidationErrors errors={errorMessages} />
        </div>
        <AlertForm
            initialValues={defaults}
            onChange={(change) => setValues({ ...values, ...change })}
        />
    </>
}
