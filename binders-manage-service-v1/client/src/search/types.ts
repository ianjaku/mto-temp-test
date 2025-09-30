export type Header<T> = {
    label: string;
    get: string | ((t: T) => string | number);
    sort?: boolean;
}

export type SearchTableConfig<T> = {
    index: string[];
    idField?: string;
    boost?: { [prop: string]: number };
    sorting?: Sorting<T>;
    hideSearch?: boolean;
}

export type SearchTableProps<T> = {
    data: T[];
    render: (props: T) => JSX.Element;
    headers: (string | Header<T>)[];
    config: SearchTableConfig<T>;
}

export type Sorting<T> = {
    field: string | ((t: T) => string | number);
    order: "asc" | "desc";
}

export const SORTING_MAP = {
    "asc": -1,
    "desc": 1,
}