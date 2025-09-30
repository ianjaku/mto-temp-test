import * as React from "react";
import { Header, Sorting } from "./types";
import { cn } from "../cn";
import { tableCellStyles } from "./Table";

export type TableHeaderProps<T> = {
    header: Header<T>;
    sorting?: Sorting<T>,
    changeSorting?: (field: Sorting<T>["field"]) => void;
}

export function TableHeader<T>({
    header,
    sorting = { field: "id", order: "asc" },
    changeSorting,
}: TableHeaderProps<T>): JSX.Element {
    const isActive = header.get === sorting.field;
    const isAsc = sorting.order === "asc";
    let iconClass = "fa-minus";
    if (isActive) {
        iconClass = isAsc ? "fa-chevron-up" : "fa-chevron-down";
    }
    return (
        <th key={header.label} className={tableCellStyles.header}>
            {
                header.sort ?
                    (
                        <div className={cn(
                            "flex flex-row items-center gap-2 p-1 cursor-pointer",
                            isActive ? "text-accent" : "",
                        )} onClick={() => changeSorting(header.get)}>
                            <span>{header.label}</span>
                            <span className={`fa ${iconClass}`} />
                        </div>
                    ) :
                    header.label
            }
        </th>
    );
}
