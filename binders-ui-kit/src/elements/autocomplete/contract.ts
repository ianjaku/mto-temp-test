import * as React from "react";

export interface ChipComponentProps {
    label: string;
    value: string;
    isNew?: boolean;
    onDelete: (value, label, isNew) => void;
    classes?: Record<string, string>;
    className?: string;
    deleteIcon?: React.ReactNode,
    style?: Record<string, string>;
    color?: string;
}