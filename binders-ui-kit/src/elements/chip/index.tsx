import * as React from "react";
import MaterialChip from "@material-ui/core/Chip";

export interface IChipProps {
    onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
    onDelete?: (e?: React.MouseEvent<HTMLElement>) => void;
    label: React.ReactNode;
    style?: React.CSSProperties;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (props: IChipProps) => (
    <MaterialChip
        onClick={props.onClick}
        onDelete={props.onDelete}
        label={props.label}
        style={props.style}
    />
);


