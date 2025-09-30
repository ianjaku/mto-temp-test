import * as React from "react";
import { FC, useMemo } from "react";
import { createRequireFieldsValidator, useFormData } from "@binders/ui-kit/lib/helpers/use-form-data/useFormData";
import { APICreateMSSetupRequest } from "../../../../api/accountService";
import { BoxHeader } from "../../../../components/generic-box/box-header/BoxHeader";
import Button from "@binders/ui-kit/lib/elements/button";
import { FormItem } from "./FormItem";
import { GenericBox } from "../../../../components/generic-box/GenericBox";
import { ResolvedMSPurchaseIdToken } from "@binders/client/lib/clients/accountservice/v1/contract";
import { useAzureUserInfo } from "../../../../azure-ad-sso/useAzureUserInfo";
import "./create-setup-request.styl";

interface IFormData {
    firstName: string;
    lastName: string;
    phone: string;
    companyName: string;
    companySite: string;
    email: string;
}

export const CreateSetupRequest: FC<{
    purchaseInfo: ResolvedMSPurchaseIdToken,
    onFinish: () => void
}> = (
    { purchaseInfo, onFinish }
) => {
    const userInfo = useAzureUserInfo();

    const {
        bindInput,
        bindForm,
        submit,
        isLoading
    } = useFormData<IFormData>({
        initValues: useMemo(() => ({
            firstName: userInfo?.givenName ?? "",
            lastName: userInfo?.surname ?? "",
            email: purchaseInfo.purchaserEmail,
            phone: userInfo?.mobilePhone ?? ""
        }), [purchaseInfo, userInfo]),
        validate: createRequireFieldsValidator([
            "firstName",
            "lastName",
            "phone", 
            "companyName",
            "companySite",
            "email"
        ]),
        onSubmit: async (values: IFormData) => {
            await APICreateMSSetupRequest({
                companyName: values.companyName,
                companySite: values.companySite,
                email: values.email,
                firstName: values.firstName,
                lastName: values.lastName,
                phone: values.phone,
                purchaseIdToken: purchaseInfo.purchaseIdToken
            });
            onFinish();
        }
    });

    return (
        <GenericBox>
            <BoxHeader>Welcome {userInfo?.givenName} {userInfo?.surname},</BoxHeader>
            <div className="create-setup">
                <p className="create-setup-text">
                    You have placed an order for {purchaseInfo?.quantity} licenses.
                </p>
                <p className="create-setup-text">
                    We will start provisioning your account after receiving the information below.
                </p>
                <form {...bindForm()} className="create-setup-form">
                    <FormItem
                        label="First name"
                        placeholder="Contact first name"
                        {...bindInput("firstName")}
                    />
                    <FormItem
                        label="Last name"
                        placeholder="Contact last name"
                        {...bindInput("lastName")}
                    />
                    <FormItem
                        label="Organization name"
                        {...bindInput("companyName")}
                    />
                    <FormItem
                        label="Organization website"
                        placeholder="example.com"
                        {...bindInput("companySite")}
                    />
                    <FormItem
                        label="Phone number"
                        {...bindInput("phone")}
                    />
                    <FormItem
                        type="email"
                        label="Email address"
                        placeholder="admin@fruit.be"
                        description="This email will be used as admin login"
                        {...bindInput("email")}
                    />
                    <div className="create-setup-buttons">
                        <Button
                            inactiveWithLoader={isLoading}
                            onClick={() => submit()}
                            text="Submit"
                        />
                    </div>
                </form>
            </div>
        </GenericBox>
    )
}
