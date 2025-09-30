import * as React from "react";
import { Options } from "minisearch";
import { SearchContext } from "./SearchContext";
import { SearchTableProps } from "./types";
import { SortedTable } from "./SortedTable";
import { useSearch } from "./useSearch";

export function ManagedSearchTable<T>({
    data,
    render,
    headers,
    config,
    query,
}: SearchTableProps<T> & { query: string }): JSX.Element {
    const tokenize = (txt: string) => txt.split(/[\W_]+/g);
    const options = {
        fields: config.index,
        idField: config.idField || "id",
        wildcard: "",
        tokenize,
        searchOptions: {
            prefix: false,
        }
    } as Options;
    const { search, results } = useSearch(data, options);

    React.useEffect(() => {
        search(query, { prefix: true, boost: config.boost || {} });
    }, [search, config, query]);

    return (
        <SearchContext.Provider value={{ query }}>
            <SortedTable
                data={results}
                render={render}
                config={config}
                headers={headers}
            />
        </SearchContext.Provider>
    )
}