import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import React, { useEffect, useState } from "react";
import { toast, toastStyles } from "../../components/use-toast";
import { DropdownRow } from "../forms/dropdown";
import { TextInputRow } from "../forms/textinput";
import { UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import UsersActions from "../../actions/users";
import { ValidationErrors } from "../entities/validation";
import { twoColFormStyles } from "../../components/styles";
import { useFetchUser } from "../../api/hooks";
import { validateDisplayName } from "./formHelpers";
import { validateEmailInput, } from "@binders/client/lib/clients/validation";

interface Props {
    params: {
        userId: string;
    }
}

const title = "Edit user";

export const UserEdit: React.FC<Props> = ({ params }) => {

    const { data: user } = useFetchUser(params.userId);

    const [errors, setErrors] = useState<string[]>([]);
    const [login, setLogin] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");
    const [type, setType] = useState<UserType>();
    const [licenseCount, setLicenseCount] = useState<number>();

    useEffect(() => {
        if (user) {
            setLogin(user.login);
            setDisplayName(user.displayName);
            setType(user.type);
            setLicenseCount(user.licenseCount || 1);
        }
    }, [user]);

    const submitHandler = () => {
        const errors = [
            ...validateEmailInput(login.trim()),
            ...validateDisplayName(displayName),
        ];
        setErrors(errors);
        if (errors.length > 0) {
            return;
        }
        const updatedUser = {
            ...user,
            login: login.trim(),
            displayName,
            type,
            licenseCount,
        }
        toast({ className: toastStyles.info, title: "User updated", description: `User ${displayName} was updated` })
        UsersActions.updateUser(updatedUser);
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
                    disabled={!!user} />
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
            </form>
        </div>
    );
}
