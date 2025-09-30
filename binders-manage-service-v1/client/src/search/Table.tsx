
import * as React from "react";
import { Header, SearchTableConfig, Sorting } from "./types";
import { TableHeader } from "./TableHeader";
import { getId } from "./utils";

export const tableCellStyles = {
    base: "px-2 py-1",
    actions: "inline-flex gap-2 cursor-pointer",
    header: "text-sm px-2 py-1 whitespace-nowrap",
}

export const tableRowStyles = {
    base: "bg-white border-b border-gray-200 hover:bg-gray-50",
}

function toHeader<T>(def: string | Header<T>): Header<T> {
    if (typeof def === "string") {
        return {
            get: def.toLowerCase(),
            label: def,
        }
    }
    return def;
}

export type TableProps<T> = {
    data: T[];
    Row: React.FC<T>;
    config: SearchTableConfig<T>;
    headers: (string | Header<T>)[];
    sorting?: Sorting<T>,
    changeSorting?: (field: Sorting<T>["field"]) => void;
}

export function Table<T>({
    changeSorting,
    config,
    data,
    headers,
    sorting,
    Row,
}: TableProps<T>): JSX.Element {
    const headersMarkup = headers.map(headerDef => {
        const header = toHeader(headerDef);
        return (
            <TableHeader
                key={header.label}
                header={header}
                sorting={sorting}
                changeSorting={changeSorting}
            />
        );
    });

    const rowsMarkup = data.map(props => (
        <Row key={getId(props as Record<string, string>, config as SearchTableConfig<Record<string, string>>)} {...props} />
    ));

    return (
        <div className="flex flex-col overflow-auto">
            <table>
                <thead className="border-b border-gray-300 rounded-t-md">
                    <tr>{headersMarkup}</tr>
                </thead>
                <tbody>{rowsMarkup}</tbody>
            </table>
        </div>
    );
}
