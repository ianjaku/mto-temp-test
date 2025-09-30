import * as React from "react";
import Table, { ITableProps } from "./Table";
import { prepareDatesFormats, prepareHeaders } from "./utils";

export interface IDataTableProps extends ITableProps {
    dataCallback: (page: number, recordsPerPage: number, sort: number[]) => void;
    customHeaders?: Array<{ label, type } | string>;
    searchable?: boolean;
}

export interface IDataTableState {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    sort: number[];
    page: number;
    recordsPerPage: number;
}

function DataTable(TableComponent) {
    return class extends React.Component<IDataTableProps, IDataTableState> {
        // all headers in normalizedHeaders are marked with type and for date - format field
        private normalizedHeaders: Array<{ label, type, format? }>;
        constructor(props) {
            super(props);
            this.normalizedHeaders = props.customHeaders ? prepareHeaders(props.customHeaders, props.data[0]) : [];
            this.onSearch = this.onSearch.bind(this);
            this.state = {
                data: prepareDatesFormats(this.normalizedHeaders, props.data),
                page: 1,
                recordsPerPage: props.recordsPerPage || 10,
                sort: [],
            };
        }

        public onPageChange = page => {
            this.props.dataCallback(page, this.state.recordsPerPage, this.state.sort);
            this.setState({ page });
        }

        public onSort = sort => {
            this.props.dataCallback(this.state.page, this.state.recordsPerPage, sort);
            this.setState({ sort });
        }

        public onChangeRecordsPerPage = amount => {
            this.props.dataCallback(this.state.page, amount, this.state.sort);
            this.setState({ recordsPerPage: amount });
        }

        public render() {
            const { searchable, ...tableProps } = this.props;
            return (
                <TableComponent
                    {...tableProps}
                    data={this.state.data}
                    normalizedHeaders={this.normalizedHeaders}
                    recordsPerPage={this.state.recordsPerPage}
                    onSort={this.onSort}
                    onPageChange={this.onPageChange}
                    onChangeRecordsPerPage={this.onChangeRecordsPerPage}
                    onSearch={searchable ? this.onSearch : undefined}
                />
            );
        }

        private onSearch(query) {
            const { data } = this.state;
            const { onSearch } = this.props;
            if (typeof onSearch === "function") {
                onSearch(query);
                return undefined;
            }
            if (query.length === 0) {
                this.setState({
                    data: prepareDatesFormats(
                        this.normalizedHeaders,
                        this.props.data,
                    ),
                });
                return;
            }
            const filteredData = data.reduce((out, column) => {
                const hasMatch = column.findIndex(field => (
                    (typeof field === "string") &&
                    field.toLowerCase().indexOf(query.toLowerCase()) >= 0
                )) >= 0;
                if (hasMatch) {
                    out.push(column);
                }
                return out;
            }, []);
            this.setState({ data: filteredData });
        }
    };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default DataTable(Table) as any;
