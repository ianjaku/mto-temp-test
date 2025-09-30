import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import React, { useState } from "react";
import { toast, toastStyles } from "../../components/use-toast";
import {
    validateEmailInput,
    validatePasswordInput,
} from "@binders/client/lib/clients/validation";
import { DropdownRow } from "../forms/dropdown";
import { TextInputRow } from "../forms/textinput";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import UsersActions from "../../actions/users";
import { ValidationErrors } from "../entities/validation";
import { twoColFormStyles } from "../../components/styles";
import { validateDisplayName } from "./formHelpers";

const title = "Create a new user";

export const UserCreate: React.FC = () => {

    const [errors, setErrors] = useState<string[]>([]);
    const [login, setLogin] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");
    const [type, setType] = useState(UserType.Individual);
    const [licenseCount, setLicenseCount] = useState(1);
    const [password, setPassword] = useState<string>("");

    const submitHandler = () => {
        const errors = [
            ...validateEmailInput(login.trim()),
            ...validateDisplayName(displayName),
            ...validatePasswordInput(password.trim()),
        ];
        setErrors(errors);
        if (errors.length > 0) {
            return;
        }
        toast({ className: toastStyles.info, title: "User created", description: `User ${displayName} was created` });
        UsersActions.createUser(login.trim(), displayName, password.trim(), type, licenseCount)
    };

    return (
        <div>
            <ContentTitleRow title={title}>
                <ContentTitleAction icon="" label="Cancel" variant="outline" handler={UsersActions.switchToOverview} />
                <ContentTitleAction icon="floppy-o" label="Save" handler={submitHandler} />
            </ContentTitleRow>
            <ValidationErrors errors={errors} />
            <form className={twoColFormStyles}>
                <TextInputRow changeHandler={v => setLogin(v)}
                    name="email"
                    label="Email"
                    placeholder="User Login"
                    initialValue={login}
                />
                <TextInputRow changeHandler={v => setDisplayName(v)}
                    name="displayName"
                    label="Display name"
                    placeholder="Display name for the user"
                    initialValue={displayName} />
                <DropdownRow changeHandler={(v) => {
                    const resetLicenseCount = (UserType[v] == "Individual");
                    setType(UserType[v] as UserType);
                    if (resetLicenseCount) {
                        setLicenseCount(1);
                    }
                }}
                label="Type"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                options={Object.keys(UserType).filter((k: any) => isNaN(k))} />
                <TextInputRow<number> changeHandler={(v) => {
                    const setDevice = v > 1;
                    setLicenseCount(v);
                    if (setDevice) {
                        setType(UserType.Device);
                    }
                }}
                label="Number of licences"
                name="licencesNo"
                placeholder="Number of license"
                inputType="number"
                initialValue={licenseCount} />
                <TextInputRow changeHandler={v => setPassword(v)}
                    label="Password"
                    name="password"
                    inputType="password"
                    placeholder="Password for the user"
                    initialValue={password}
                />
            </form>
        </div>
    );
}
