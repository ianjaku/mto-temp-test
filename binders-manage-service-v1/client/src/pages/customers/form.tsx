import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { toastStyles, useToast } from "../../components/use-toast";
import { useCallback, useEffect, useState } from "react";
import { useCreateCustomer, useGetCustomer, useUpdateCustomer } from "../../api/hooks";
import { CustomersActions } from "../../actions/customers";
import { ICustomer } from "@binders/client/lib/clients/accountservice/v1/contract";
import { RouteComponentProps } from "react-router";
import { TextInputRow } from "../forms/textinput";
import { ValidationErrors } from "../entities/validation";
import { twoColFormStyles } from "../../components/styles";
import { validateStringInput } from "@binders/client/lib/clients/validation";

export type CustomerInputState = {
    title: string;
    customer?: ICustomer;
    name: string;
    crmCustomerId?: string,
    doCreateAccount?: boolean;
    showDoCreateAccount?: boolean;
}

type CustomerFormProps = {
    initialValues: CustomerInputState;
    onChange: (change: Partial<CustomerInputState>) => void;
    submitHandler: (values: CustomerInputState) => void;
}

const CustomerForm = ({ initialValues, onChange, submitHandler }: CustomerFormProps) => {
    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = useCallback(() => {
        const errors = [
            ...validateStringInput(initialValues.name),
        ];
        if (initialValues.name.length === 0) {
            errors.push("Customer name cannot be empty");
        }
        setErrors(errors);
        if (errors.length > 0) {
            return;
        }
        submitHandler(initialValues);
    }, [initialValues, submitHandler]);

    const disabled = false;
    if (!initialValues) return <div />
    return (
        <div>
            <ContentTitleRow title={initialValues.title}>
                <ContentTitleAction
                    icon=""
                    label="Cancel"
                    variant="outline"
                    handler={CustomersActions.switchToOverview}
                />
                <ContentTitleAction
                    icon="floppy-o"
                    label="Save"
                    handler={handleSubmit}
                />
            </ContentTitleRow>
            <ValidationErrors errors={errors} />
            <div className={twoColFormStyles}>
                <TextInputRow
                    changeHandler={(val: string) => onChange({ name: val })}
                    label="Name"
                    placeholder="Customer name"
                    disabled={disabled}
                    initialValue={initialValues.name}
                />
                {initialValues.showDoCreateAccount && (
                    <>
                        <label htmlFor="doCreateAccount">
                            Create an account with the same name
                        </label>
                        <input
                            id="doCreateAccount"
                            className="justify-self-start"
                            type="checkbox"
                            checked={initialValues.doCreateAccount || false}
                            onChange={() => onChange({ doCreateAccount: !initialValues.doCreateAccount })}
                        />
                    </>
                )}
            </div>
        </div>
    );
}

export const CustomerCreate = () => {
    const { toast } = useToast();
    const createCustomer = useCreateCustomer({
        onSuccess: (_, props) => toast({ className: toastStyles.info, title: "Customer created", description: `A new customer ${props.name} was created` }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to create customer", description: e.message })
    });
    const [values, setValues] = useState<Partial<CustomerInputState>>({
        title: "Create new customer",
        name: "",
        showDoCreateAccount: true,
    });
    return (
        <CustomerForm
            submitHandler={createCustomer.mutate}
            initialValues={values as CustomerInputState}
            onChange={partials => setValues(prev => ({ ...prev, ...partials }))}
        />
    )
}

export const CustomerEdit = (props: RouteComponentProps<{ customerId: string }, unknown>) => {
    const customerId = props.params.customerId;
    const customer = useGetCustomer(customerId);
    const [values, setValues] = useState<Partial<CustomerInputState>>({
        title: "Edit customer",
        name: "Loading ...",
        customer: customer.data,
        crmCustomerId: customer.data?.crmCustomerId,
    });
    const updateCustomer = useUpdateCustomer();
    useEffect(() => {
        const data = customer.data;
        if (customer.isSuccess && data) {
            setValues(prev => ({ ...prev, customer: data, ...data }));
        }
    }, [setValues, customer.isSuccess, customer.data])
    return (
        <CustomerForm
            submitHandler={updateCustomer.mutate}
            initialValues={values as CustomerInputState}
            onChange={partials => setValues(prev => ({ ...prev, ...partials }))}
        />
    )
}

