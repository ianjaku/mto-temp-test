import React from "react";

export type ITableDataCell = string | {
    uiValue: string | React.JSX.Element;
    value?: string | number;
    exportValue?: string | number;
    exportOnly?: boolean;
}

export type ITableHeader = string | {
    label: string;
    type?: string;
    exportOnly?: boolean;
}

// 1 is ASC, -1 is DESC, 0 is not sorted yet
export enum SORT {
    NOSORT = 0,
    ASC = 1,
    DESC = -1,
}

