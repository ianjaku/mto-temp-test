import * as React from "react";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import { FC, useCallback, useEffect, useState } from "react";
import { toastStyles, useToast } from "../../components/use-toast";
import { useCreateAccount, useGetAccount, useListCustomers, useUpdateAccount } from "../../api/hooks";
import { validateISODate, validateMaybePositiveNumber, validateStringInput } from "@binders/client/lib/clients/validation";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountsActions } from "../../actions/accounts";
import { Combobox } from "../../components/combobox";
import DatePicker from "react-datepicker";
import { DropdownRow } from "../forms/dropdown";
import { RouteComponentProps } from "react-router";
import { TextInputRow } from "../forms/textinput";
import { ValidationErrors } from "../entities/validation";
import { add } from "date-fns";
import { browserHistory } from "react-router";
import { cn } from "../../cn";
import { inputStyles } from "../../components/input";
import { twoColFormStyles } from "../../components/styles";
import "react-datepicker/dist/react-datepicker.css";

export type AccountInputState = {
    title: string;
    account?: Account;
    name: string;
    subscriptionType: string;
    expirationDate: Date;
    readerExpirationDate: Date;
    maxNumberOfLicenses?: number;
    maxPublicCount?: number;
    htmlHeadContent?: string;
    customerId?: string;
    requiresReload: boolean;
    selectedCustomerId?: string;
    selectedCustomerName?: string;
}

type AccountFormProps = {
    initialValues: AccountInputState;
    onChange: (change: Partial<AccountInputState>) => void;
    submitHandler: (values: AccountInputState) => void;
}

const AccountForm: FC<AccountFormProps> = ({ initialValues, onChange, submitHandler }) => {
    const disabled = false;
    const subscriptionOptions = { "trial": "Trial", "standard": "Standard" };
    const [errors, setErrors] = useState<string[]>([]);
    const customerList = useListCustomers();
    const customerOptions = customerList.data?.map(c => ({ value: c.id, label: c.name })) ?? [];

    const handleSubmit = useCallback(() => {
        const { expirationDate, readerExpirationDate } = initialValues;
        const isoExpiration = expirationDate.toISOString();
        const isoReaderExpiration = (readerExpirationDate || expirationDate).toISOString();
        const validationErrors = [
            ...validateStringInput(initialValues.name),
            ...validateISODate(isoExpiration),
            ...validateISODate(isoReaderExpiration),
            ...validateMaybePositiveNumber(initialValues.maxNumberOfLicenses),
            ...validateMaybePositiveNumber(initialValues.maxPublicCount),
        ];
        if (initialValues.name.length === 0) {
            validationErrors.push("Account name cannot be empty");
        }
        setErrors(validationErrors);
        if (validationErrors.length > 0) {
            return;
        }
        submitHandler(initialValues);
    }, [initialValues, submitHandler]);

    function onSelectCustomerId(selectedCustomerId: string) {
        onChange({ selectedCustomerId, selectedCustomerName: "" })
    }

    function onChangeCustomerName(selectedCustomerName: string) {
        onChange({ selectedCustomerName })
    }

    if (!initialValues) return <div />;

    return <>
        <ContentTitleRow title={initialValues.title}>
            <ContentTitleAction
                icon=""
                label="Cancel"
                variant="outline"
                handler={AccountsActions.switchToOverview}
            />
            <ContentTitleAction
                icon="floppy-o"
                label="Save"
                handler={handleSubmit}
            />
        </ContentTitleRow>
        <div className="flex flex-col gap-4">
            <ValidationErrors errors={errors || []} />
            <div className={twoColFormStyles}>
                <TextInputRow
                    changeHandler={(val: string) => onChange({ name: val })}
                    label="Name"
                    placeholder="Account name"
                    disabled={disabled}
                    initialValue={initialValues.name}
                />
                <DropdownRow
                    changeHandler={val => onChange({ subscriptionType: val })}
                    label="Subscription"
                    options={subscriptionOptions}
                    initialValue={initialValues.subscriptionType}
                />
                <>
                    <div className="">Editor Expires</div>
                    <div className={cn(inputStyles.base, "w-full bg-white")}>
                        <DatePicker
                            selected={initialValues.expirationDate}
                            onChange={val => onChange({ expirationDate: val })}
                            peekNextMonth
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                        />
                    </div>
                </>
                <>
                    <div className="">Reader Expires</div>
                    <div className={cn(inputStyles.base, "w-full bg-white")}>
                        <DatePicker
                            selected={initialValues.readerExpirationDate}
                            onChange={val => onChange({ readerExpirationDate: val })}
                            peekNextMonth
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                        />
                    </div>
                </>
                <TextInputRow<number>
                    changeHandler={(val: number) => onChange({ maxNumberOfLicenses: val })}
                    label="Maximum number of licenses"
                    placeholder="Maximum number of licenses"
                    disabled={disabled}
                    inputType="number"
                    initialValue={initialValues.maxNumberOfLicenses}
                />
                <TextInputRow<number>
                    changeHandler={(val: number) => onChange({ maxPublicCount: val })}
                    label="Maximum number of public documents"
                    placeholder="Maximum number of public documents"
                    disabled={disabled}
                    inputType="number"
                    initialValue={initialValues.maxPublicCount ?? 0}
                />
                <label>Customer</label>
                <div className="flex justify-self-start">
                    <Combobox
                        placeholder="Customer"
                        options={customerOptions}
                        onChange={onSelectCustomerId}
                        onChangeFilter={onChangeCustomerName}
                        selectedValue={initialValues.selectedCustomerId}
                    />
                </div>
                <TextInputRow
                    changeHandler={(val: string) => onChange({ htmlHeadContent: val })}
                    labelClassName="max-w-[30ch] self-start"
                    label="Additional HTML Head Content (eg for Google Analytics)"
                    placeholder="Additional HTML Head Content"
                    inputType="text-multiline"
                    initialValue={initialValues.htmlHeadContent}
                />
            </div>
        </div>
    </>
}

export const AccountCreate = () => {
    const now = new Date();
    const [values, setValues] = useState<Partial<AccountInputState>>({
        title: "Create new account",
        name: "",
        subscriptionType: "standard",
        expirationDate: add(now, { weeks: 2 }),
        readerExpirationDate: add(now, { weeks: 2 }),
        requiresReload: false,
    });
    const { toast } = useToast();
    const createAccount = useCreateAccount({
        onSuccess: (res, props) => {
            toast({ className: toastStyles.info, title: "Account created", description: `Account ${props.name} was created` });
            browserHistory.push(`/accounts/${res.id}`);
        },
        onError: e => toast({ className: toastStyles.error, title: "Failed to create account", description: e.message })
    });
    return (
        <AccountForm
            submitHandler={createAccount.mutate}
            initialValues={values as AccountInputState}
            onChange={partials => setValues(prev => ({ ...prev, ...partials }))}
        />
    )
}

export const AccountEdit = (props: RouteComponentProps<{ accountId: string }, unknown>) => {
    const now = new Date();
    const account = useGetAccount(props.params.accountId);
    const [values, setValues] = useState<Partial<AccountInputState>>({
        title: "Edit account",
        name: "Loading ...",
        subscriptionType: "standard",
        expirationDate: add(now, { weeks: 2 }),
        readerExpirationDate: add(now, { weeks: 2 }),
        requiresReload: false,
    });
    const { toast } = useToast();
    const updateAccount = useUpdateAccount({
        onSuccess: (_, props) => toast({ className: toastStyles.info, title: "Account updated", description: `Account ${props.name} was updated` }),
        onError: e => toast({ className: toastStyles.error, title: "Failed to update account", description: e.message })
    });
    useEffect(() => {
        const data = account.data;
        if (account.isSuccess && data) {
            setValues({
                ...data,
                account: data,
                expirationDate: new Date(data.expirationDate),
                readerExpirationDate: new Date(data.readerExpirationDate),
            })
        }
    }, [setValues, account.isSuccess, account.data])
    return (
        <AccountForm
            submitHandler={updateAccount.mutate}
            initialValues={values as AccountInputState}
            onChange={partials => setValues(prev => ({ ...prev, ...partials }))}
        />
    )
}


