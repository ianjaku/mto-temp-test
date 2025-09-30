import * as React from "react";
import { FC } from "react";
import Input from "@binders/ui-kit/lib/elements/input";

export const FormItem: FC<{
    id: string;
    name: string;
    label: string;
    description?: string;
    placeholder?: string;
    type?: string;
    onChange?: (val: string) => void;
    value?: string;
    hasError?: boolean;
}> = (
    { id, name, label, description, placeholder, type = "text", onChange, value, hasError }
) => {
    return (
        <div className="create-setup-row">
            <label htmlFor={id} className="create-setup-label">
                {label}
            </label>
            <Input
                id={id}
                type={type}
                name={name}
                placeholder={placeholder ?? label}
                onChange={val => onChange && onChange(val)}
                value={value}
                className={
                    `create-setup-input ${hasError ? "create-setup-input-error" : ""}`
                }
            />
            {description && <div className="create-setup-description">
                {description}
            </div>}
        </div>
    );
}