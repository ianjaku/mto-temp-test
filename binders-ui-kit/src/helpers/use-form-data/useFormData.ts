import { FormEvent, useCallback, useEffect, useState } from "react"

interface BindInputResponse {
    name: string;
    onChange: (val: string) => void;
    value: string;
    id: string;
}

export type FormFieldErrors = Record<string, string[]>

interface UseFormDataResponse<ValueTypes> {
    setValue(key: string, value: string): void;
    setValues(values: Record<string, string>): void;
    values: ValueTypes;
    bindInput(key: string): BindInputResponse;
    bindForm(): {onSubmit: (e: React.FormEvent<HTMLFormElement>) => void};
    submit(e?: FormEvent<unknown>): void;
    isLoading: boolean;
    hasError(key: string): boolean;
    hasAnyErrors(): boolean;
    getError(key: string): string[] | null;
    errors: FormFieldErrors;
}

export const useFormData = <T>(
    {onSubmit, initValues, validate}: {
        onSubmit: (values: T) => unknown,
        validate?: (values: T) => FormFieldErrors,
        initValues: Record<string, string>
    }
): UseFormDataResponse<T> => {
    const [formData, setFormData] = useState({} as T);
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFormFieldErrors] = useState({} as FormFieldErrors);

    const hasError = useCallback((key: string) => (
        fieldErrors[key] != null && (!Array.isArray(fieldErrors[key]) || fieldErrors[key].length > 0)
    ), [fieldErrors]);

    const hasAnyErrors = useCallback(() => (
        Object.keys(fieldErrors).length > 0
    ), [fieldErrors]);

    const getError = useCallback((key: string) => (
        fieldErrors[key] ?? null
    ), [fieldErrors]);

    const validateFields = useCallback(() => {
        if (validate != null) {
            const result = validate(Object.assign({}, formData))
            setFormFieldErrors(result);
            return Object.keys(result).length === 0;
        }
        return true;
    }, [validate, setFormFieldErrors, formData]);

    const setValues = useCallback((values: Record<string, string>) => {
        setFormData(Object.assign({}, formData, values))
        
        if (hasAnyErrors()) {
            validateFields();
        }
    }, [setFormData, formData, validateFields, hasAnyErrors]);

    const setValue = useCallback((key: string, value: string) => (
        setValues({[key]: value})
    ), [setValues]);

    useEffect(() => {
        if (initValues == null) return;
        setValues(initValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initValues])

    const bindInput = useCallback((key: string) => ({
        name: key,
        onChange: (val: string) => setValue(key, val),
        value: formData[key] ?? "",
        id: key,
        hasError: hasError(key)
    }), [formData, setValue, hasError])

    const submit = useCallback(async (e?: FormEvent<unknown>) => {
        e?.preventDefault();

        setIsLoading(true);

        if (!validateFields()) {
            setIsLoading(false);
            return;
        }

        await Promise.resolve(onSubmit(Object.assign({}, formData)));
        setIsLoading(false);
    }, [formData, onSubmit, validateFields]);

    const bindForm = useCallback(() => ({
        onSubmit: (e: FormEvent<unknown>) => submit(e)
    }), [submit])

    return {
        setValues,
        setValue,
        bindInput,
        values: formData,
        submit,
        isLoading,
        bindForm,
        hasError,
        hasAnyErrors,
        errors: fieldErrors,
        getError
    }
}

export const createRequireFieldsValidator = (keys: string[]) => {
    return (values: unknown): FormFieldErrors => {
        return keys.filter(key => values[key] == null || values[key] === "")
            .reduce<FormFieldErrors>(
                (result, key) => (Object.assign(result, {[key]: ["Field is required"]})),
                {}
            )
    }
}
