import * as React from "react";

export type Header = {
    label: string | React.ReactNode;
}

export type TableProps<T> = {
    data: T[];
    Row: React.FC<T>;
    headers: (string | Header)[];
    idCol: (t: T) => string,
    className?: string;
}

function toHeader(def: string | Header): Header {
    if (typeof def === "string") {
        return {
            label: def,
        }
    }
    return def;
}

export function BareTable<T>({
    data,
    headers,
    idCol,
    Row,
    className,
}: TableProps<T>): JSX.Element {
    const headersMarkup = headers.map((headerDef, i) => {
        const header = toHeader(headerDef);
        return (
            <th key={`btheader-${i}`}>{header.label}</th>
        );
    });

    const rowsMarkup = data.map(props => (
        <Row key={idCol(props)} {...props} />
    ));

    return (
        <table className={className}>
            <thead>
                <tr>
                    {headersMarkup}
                </tr>
            </thead>
            <tbody>
                {rowsMarkup}
            </tbody>
        </table>
    );
}
