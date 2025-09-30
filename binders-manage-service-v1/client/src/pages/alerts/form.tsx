import * as React from "react";
import { FC, useState } from "react";
import { CreateAlertParams } from "@binders/client/lib/clients/notificationservice/v1/contract";
import { DropdownRow } from "../forms/dropdown";
import { TextAreaRow } from "../forms/textarea";
import { TextInputRow } from "../forms/textinput";
import { twoColFormStyles } from "../../components/styles";

export const AlertForm: FC<{
    initialValues: CreateAlertParams;
    onChange: (change: Partial<CreateAlertParams>) => void;
}> = ({ initialValues, onChange }) => {
    const [message, setMessage] = useState(initialValues.message);
    const [accountIdsText, setAccountIdsText] = useState(initialValues.accountIds.join("\n"));

    const withoutSeconds = (date: string | Date) => {
        if (date == null) return "";
        const strDate = new Date(date).toISOString();
        const regex = /[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/gi
        const result = regex.exec(strDate);
        if (result == null) return strDate;
        return result[0];
    }

    return (
        <div className={twoColFormStyles}>
            <TextAreaRow
                label="Message"
                tag="some-tag?"
                placeholder="Dear user, we messed up :("
                value={message}
                changeHandler={(value) => {
                    setMessage(value);
                    onChange({ message: value });
                }}
            />
            <DropdownRow
                label="Who will see it?"
                options={{
                    "all": "All users",
                    "admins": "Admins only"
                }}
                initialValue={initialValues.adminsOnly ? "admins" : "all"}
                changeHandler={(value) => onChange({ adminsOnly: value === "admins" })}
            />
            <TextInputRow
                label="cooldown in hours"
                subLabel="Leave empty to only shown once"
                initialValue={initialValues.cooldownHours === -1 ? "" : initialValues.cooldownHours.toString()}
                changeHandler={(str) => {
                    str = str.toString().replace(/[^0-9]/g, "");
                    if (str === "") {
                        onChange({ cooldownHours: -1 });
                    } else {
                        onChange({ cooldownHours: parseInt(str) });
                    }
                }}
            />
            <TextInputRow
                label="Start showing at"
                inputType="datetime-local"
                initialValue={withoutSeconds(initialValues.startDate)}
                changeHandler={(value) => onChange({ startDate: new Date(value) })}
            />
            <TextInputRow
                label="Stop showing at"
                inputType="datetime-local"
                initialValue={withoutSeconds(initialValues.endDate)}
                changeHandler={(value) => onChange({ endDate: new Date(value) })}
            />
            <TextAreaRow
                label="Account id's"
                subLabel="Leave empty to show to all accounts"
                tag="some-tag?"
                placeholder={`aid-first-account-id
aid-second-account-id
                `}
                value={accountIdsText}
                changeHandler={(value) => {
                    setAccountIdsText(value);
                    onChange({
                        accountIds: value.trim()
                            .split("\n")
                            .map(v => v.trim())
                            .filter((id) => id !== "")
                    })
                }}
            />
            <TextInputRow
                label="Button text"
                subLabel="Leave empty to not show a button"
                initialValue={initialValues.buttonText}
                changeHandler={(str) => onChange({ buttonText: str.toString() })}
            />
            <TextInputRow
                label="Button link"
                subLabel="Leave empty to not show a button"
                initialValue={initialValues.buttonLink ?? ""}
                changeHandler={(str) => onChange({ buttonLink: str.toString() })}
            />
        </div>
    )
}
