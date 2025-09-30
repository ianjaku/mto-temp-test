import * as React from "react";
import { Card } from "../../components/card";
import { cn } from "../../cn";

export const ValidationErrors = (props: { className?: string; errors?: string[]; }) => {
    if (!props.errors?.length) return null;
    const errors = [];
    for (let i = 0; i < props.errors.length; i++) {
        errors.push(<li key={i}>{props.errors[i]}</li>);
    }
    let headerMessage = "";
    if (errors.length > 0) {
        headerMessage = "Please fix the issues below:";
    }
    return <Card className={cn(`
                justify-self-start
                bg-destructive-foreground
                text-destructive
                border-1 border-destructive rounded-sm p-2 mb-4
            `, props.className)}>
        <strong>{headerMessage}</strong>
        <ul>
            {errors}
        </ul>
    </Card>;
}

