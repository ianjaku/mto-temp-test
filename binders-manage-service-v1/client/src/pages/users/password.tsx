import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import React, { useCallback } from "react";
import { TextInputRow } from "../forms/textinput";
import UsersActions from "../../actions/users";
import { ValidationErrors } from "../entities/validation";
import { twoColFormStyles } from "../../components/styles";
import { useFetchUser } from "../../api/hooks";
import { validatePasswordInput } from "@binders/client/lib/clients/validation";

interface Props {
    params: {
        userId: string;
    }
}

export const UserPassword: React.FC<Props> = ({ params }) => {

    const { data: user } = useFetchUser(params.userId);

    const [oldPassword, setOldPassword] = React.useState<string>("");
    const [newPassword, setNewPassword] = React.useState<string>("");
    const [errors, setErrors] = React.useState<string[]>([]);

    const updatePassword = useCallback(() => {
        const errors = validatePasswordInput(newPassword);
        setErrors(errors);
        if (errors.length > 0) {
            return;
        }
        UsersActions.updatePassword(user.id, user.login, oldPassword, newPassword);
    }, [newPassword, oldPassword, user]);

    return (
        <>
            <ContentTitleRow title={`Update password for ${user?.displayName.length > 0 ? user?.displayName : user?.login}`}>
                <ContentTitleAction icon="" label="Cancel" variant="outline" handler={UsersActions.switchToOverview} />
                {user && (
                    <ContentTitleAction icon="floppy-o" label="Save" handler={updatePassword} />
                )}
            </ContentTitleRow>
            <ValidationErrors errors={errors} />
            <form className={twoColFormStyles}>
                <TextInputRow changeHandler={v => setOldPassword(v)}
                    label="Old password"
                    inputType="password"
                    placeholder="Old password for the user"
                    initialValue={oldPassword} />
                <TextInputRow changeHandler={v => setNewPassword(v)}
                    label="New password"
                    inputType="password"
                    placeholder="New password for the user"
                    initialValue={newPassword} />
            </form>
        </>
    );
}