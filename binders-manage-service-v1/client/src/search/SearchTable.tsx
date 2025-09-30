import * as React from "react";
import { ManagedSearchTable } from "./ManagedSearchTable";
import { Search } from "../components/search";
import { SearchTableProps } from "./types";

export function SearchTable<T>({
    data,
    render,
    headers,
    config,
}: SearchTableProps<T>): JSX.Element {
    const [query, setQuery] = React.useState("");
    return (
        <>
            <Search id={config.index.join()} value={query} setValue={setQuery} />
            <ManagedSearchTable
                config={config}
                data={data}
                headers={headers}
                query={query}
                render={render}
            />
        </>
    )
}
