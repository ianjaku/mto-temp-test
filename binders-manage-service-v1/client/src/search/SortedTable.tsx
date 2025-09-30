import * as React from "react";
import { Header, SORTING_MAP, SearchTableProps, Sorting } from "./types";
import { Table } from "./Table";

function flipOrder<T>(order: Sorting<T>["order"]): Sorting<T>["order"] {
    return {
        asc: "desc",
        desc: "asc"
    }[order] as Sorting<T>["order"];
}

function sortByField<T>({ field, order }: Sorting<T>) {
    function get(obj: T, field: Sorting<T>["field"]) {
        if (typeof field === "function") {
            return field(obj);
        }
        return obj[field];
    }
    return function(a: T, b: T) {
        return get(a, field) < get(b, field) ? SORTING_MAP[order] : -1 * SORTING_MAP[order]
    }
}

export function SortedTable<T>({
    data,
    render,
    headers,
    config,
}: SearchTableProps<T>): JSX.Element {
    const initialSorting = config.sorting || {
        field: (headers[0] as Header<T>).get,
        order: "asc",
    } as Sorting<T>;
    const [sorting, setSorting] = React.useState<Sorting<T>>(initialSorting);

    const changeSorting = React.useCallback((field: Sorting<T>["field"]) => {
        if (sorting.field === field) {
            setSorting({ field, order: flipOrder(sorting.order) })
        }
        else {
            setSorting({ field, order: "asc" });
        }
    }, [sorting, setSorting]);

    const sortedData = (data || []).sort(sortByField(sorting));

    return (
        <Table
            data={sortedData}
            Row={render}
            config={config}
            headers={headers}
            changeSorting={changeSorting}
            sorting={sorting}
        />
    )
}