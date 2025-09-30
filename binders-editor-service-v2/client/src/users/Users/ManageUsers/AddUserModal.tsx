import * as React from "react";
import * as validator from "validator";
import {
    useAccountRoles,
    useActiveAccount,
    useActiveAccountFeatures,
    useCurrentDomain
} from "../../../accounts/hooks";
import { useCallback, useMemo, useState } from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import {
    FEATURE_ADD_USERS_IN_EDITOR
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { FlashMessages } from "../../../logging/FlashMessages";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    buildRoleTranslationKey
} from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import circularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import { inviteUserToAccount } from "../../actions";
import { useAccountAcls } from "../../../authorization/hooks";
import { useCreateUserWithCredentials } from "../../query";
import { useMyDetails } from "../../hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";

interface Props {
    users: User[];
    onRequestHide: () => void;
}

type Mode = "invite" | "add";

const AddUserModal: React.FC<Props> = (props) => {
    const { t } = useTranslation();
    const account = useActiveAccount();
    const myDetails = useMyDetails();

    const [mode, setMode] = useState<Mode>("invite")

    const [userProps, setUserProps] = useState({
        login: "",
        password: "",
        name: "",
    });

    const buildOnChangeUserProp = (
        propName: string,
        effect?: () => void,
    ) => (val: string) => {
        setUserProps({ ...userProps, [propName]: val });
        if (effect) {
            effect();
        }
    }

    const [selectedRoleName, setSelectedRoleName] = useState("no_perm");
    const domain = useCurrentDomain();
    const { data: accountAcls, isFetching } = useAccountAcls();
    const accountRoles = useAccountRoles();
    const addUser = useCreateUserWithCredentials(props.onRequestHide);

    const user: User = myDetails?.user;

    const validate = useCallback(() => {
        const isNewUser = !(props.users.some(user => user.login === userProps["login"]));
        let errors = {
            ...(validator.isEmail(userProps["login"]) ? {} : { "login": t(TK.User_NotCorrectEmailAddress) }),
            ...(isNewUser ? {} : { "login": t(TK.User_LoginAlreadyUsed) }),
            ...(!userProps["login"] ? { "login": `${t(TK.General_Provide)}: ${t(TK.User_UserEmail)}` } : {}),
        };
        if (mode === "add") {
            errors = {
                ...errors,
                ...(userProps["password"].length < 6 ? { "password": t(TK.User_MinPasswordLengthError, { minPasswordLength: 6 }) } : {}),
                ...(!userProps["password"] ? { "password": `${t(TK.General_Provide)}: ${t(TK.User_Password)}` } : {}),
                ...(!userProps["name"] ? { "name": `${t(TK.General_Provide)}: ${t(TK.General_Name)}` } : {}),
            };
        }
        return errors;
    }, [mode, props.users, t, userProps]);

    const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

    const onDone = async () => {
        const errors = validate();
        if (Object.keys(errors).length) {
            setValidationErrors(errors);
            return;
        }
        if (mode === "invite") {
            if (!user) return;
            FlashMessages.info(t(TK.User_SendingInvitation, { email: userProps["login"] }));
            await inviteUserToAccount(
                accountAcls,
                account.id,
                userProps["login"],
                selectedRoleName,
                domain,
                accountRoles,
                user,
            );
        } else {
            await addUser.mutate({
                login: userProps["login"],
                password: userProps["password"],
                name: userProps["name"],
                roleName: selectedRoleName,
                acls: accountAcls,
            });
        }
        props.onRequestHide();
    }

    const onChangeRole = (_e, value) => {
        setSelectedRoleName(value);
    }
    const onChangeMode = (_e, mode: Mode) => {
        setMode(mode);
        setValidationErrors({});
        setUserProps({ login: "", password: "", name: "" });
    }

    const accountFeatures = useActiveAccountFeatures();

    const addUsersFeatureEnabled = useMemo(() => accountFeatures.includes(FEATURE_ADD_USERS_IN_EDITOR), [accountFeatures]);

    const modalButton = <Button key="done" isEnabled={!isFetching} text={t(TK.General_Done)} onClick={onDone} />;

    const progress = circularProgress("", { marginTop: "12px" });

    return (
        <Modal
            title={t(TK.User_AddUser)}
            buttons={[...(isFetching ? [progress] : []), modalButton]}
            onHide={props.onRequestHide}
            onEnterKey={onDone}
            onEscapeKey={props.onRequestHide}
            withoutPadding
        >
            {
                <div className="addUserModal">
                    <RadioButtonGroup
                        name="mode"
                        value={mode}
                        onChange={onChangeMode}
                    >
                        {addUsersFeatureEnabled && (
                            <RadioButton
                                key="invite"
                                value="invite"
                                label={t(TK.User_AddModeInvite)}
                                disabled={isFetching}
                                className="addUserModal-modeRadio"
                            />
                        )}

                        {mode === "invite" && (
                            <div className="addUserModal-invite">
                                <Input
                                    type="text"
                                    name="email"
                                    placeholder={t(TK.User_UserEmail)}
                                    value={userProps["login"]}
                                    isValid={!validationErrors["login"]}
                                    disabled={isFetching}
                                    onChange={buildOnChangeUserProp("login", () => {
                                        setValidationErrors({ ...validationErrors, login: "" });
                                    })}
                                />
                            </div>
                        )}

                        {addUsersFeatureEnabled && (
                            <RadioButton
                                key="add"
                                value="add"
                                label={t(TK.User_AddModeAdd)}
                                disabled={isFetching}
                                className="addUserModal-modeRadio"
                            />
                        )}

                        {mode === "add" && (
                            <div className="addUserModal-add">
                                <label className="addUserModal-add-inputlbl">
                                    {t(TK.User_Login)}
                                </label>
                                <Input
                                    type="text"
                                    name="login"
                                    placeholder={t(TK.User_Login)}
                                    value={userProps["login"]}
                                    disabled={isFetching}
                                    onChange={buildOnChangeUserProp("login", () => {
                                        setValidationErrors({ ...validationErrors, login: "" });
                                    })}
                                    isValid={!validationErrors["login"]}
                                />
                                <label className="addUserModal-add-inputlbl">
                                    {t(TK.User_CreatePassword)}
                                </label>
                                <Input
                                    type="password"
                                    name="password"
                                    placeholder={t(TK.User_Password)}
                                    value={userProps["password"]}
                                    disabled={isFetching}
                                    onChange={buildOnChangeUserProp("password", () => {
                                        setValidationErrors({ ...validationErrors, password: "" });
                                    })}
                                    isValid={!validationErrors["password"]}
                                />
                                <label className="addUserModal-add-inputinfo">
                                    {t(TK.User_MinPasswordLengthError, { minPasswordLength: 6 })}
                                </label>
                                <label className="addUserModal-add-inputlbl">
                                    {t(TK.General_Name)}
                                </label>
                                <Input
                                    type="text"
                                    name="name"
                                    placeholder={t(TK.General_Name)}
                                    value={userProps["name"]}
                                    disabled={isFetching}
                                    onChange={buildOnChangeUserProp("name", () => {
                                        setValidationErrors({ ...validationErrors, name: "" });
                                    })}
                                    isValid={!validationErrors["name"]}
                                />
                            </div>
                        )}

                        <div className="addUserModal-permissions">
                            <label className="addUserModal-permissions-title">
                                {t(TK.General_Permissions)}
                            </label>
                            <RadioButtonGroup
                                className="addUserModal-permissions-radioGroup"
                                name="permissions"
                                value={selectedRoleName}
                                onChange={onChangeRole}
                            >
                                <RadioButton
                                    key="rol-0"
                                    value="no_perm"
                                    disabled={isFetching}
                                    label={t(TK.General_NoPermissions)}
                                />
                                {(accountRoles?.filter(r => !r.isInvisible) || []).map((r) => (
                                    <RadioButton
                                        key={r.roleId}
                                        value={r.name}
                                        disabled={isFetching}
                                        label={t(TK.User_RadioButtonDescription, {
                                            description: t(TK[buildRoleTranslationKey(`Description${r.name}`)]),
                                            accountName: account.name
                                        })}
                                    />
                                ))}
                            </RadioButtonGroup>
                        </div>
                    </RadioButtonGroup>
                    <div className="addUserModal-errors">
                        {Object.values(validationErrors).map((error, i) => (
                            <label key={`valerr${i}`} className="addUserModal-errors-error">
                                {error}
                            </label>
                        ))}
                    </div>
                </div>
            }
        </Modal>
    );
}

export default AddUserModal;
