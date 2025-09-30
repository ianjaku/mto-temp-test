import * as React from "react";
import * as ReactDomServer from "react-dom/server";
import Table, { ITableProps } from "./Table";
import { filterExportOnlyColumns, prepareDatesFormats, prepareHeaders, sortFunctions } from "./utils";
import { fmtDateIso8601TZ, fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { SORT } from "./types";
import { equals } from "ramda";
import { exportRowsToSheetsFiles } from "@binders/client/lib/util/xlsx";
import { isDate } from "date-fns";

export interface IDataTableState {
    sort: number[];
    page: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
    recordsPerPage: number;
    filterEnabled: boolean;
    filtered?: boolean;
}
// to override type in interface
interface ISimpleTableProps extends ITableProps {
    customHeaders?: Array<{ label, type, format?, defaultSort?, exportOnly?} | string>;
    filtered?: boolean;
    searchable?: boolean;
    exportable?: boolean;
    defaultSort?: { columnIndex: number, order: SORT };
    onExportData?: (type: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportDataTransformFn?: (data: any) => any;
}

function SimpleTable(TableComponent) {
    return class extends React.Component<ISimpleTableProps, IDataTableState> {
        public static defaultProps: Partial<ISimpleTableProps> = {
            data: [],
            filtered: false,
            onChangeRecordsPerPage: () => {
                return;
            },
            onPageChange: () => {
                return;
            },
            onSort: () => {
                return;
            },
            searchable: false,
        };

        private normalizedHeaders: Array<{ label, type, format?}>;
        private exportHeaders: Array<{ label, type, format?}>;

        constructor(props) {
            super(props);
            const { customHeaders, defaultSort, data, recordsPerPage } = this.props;
            const renderableHeaders = customHeaders.filter(header => typeof header === "string" || !header.exportOnly);
            this.normalizedHeaders = customHeaders ? prepareHeaders(renderableHeaders, data[0]) : [];
            this.exportHeaders = customHeaders ? prepareHeaders(customHeaders, data[0]) : [];
            this.onSearch = this.onSearch.bind(this);
            this.onExportData = this.onExportData.bind(this);
            const sort = Array(this.normalizedHeaders.length).fill(SORT.NOSORT);
            if (defaultSort) {
                const { columnIndex, order } = defaultSort;
                sort[columnIndex] = order;
            }
            this.state = {
                data,
                filterEnabled: false,
                filtered: props.filtered,
                page: 1,
                recordsPerPage: recordsPerPage || 10,
                sort,
            };
        }

        componentDidMount() {
            const { data, filtered } = this.props;
            this.setState({
                data,
                filtered,
                page: 1,
            });
        }

        componentDidUpdate(prevProps, prevState) {
            const { data: prevData } = prevProps;
            const { data, filtered } = this.props;
            const { page } = this.state;
            const { filterEnabled: prevFilterEnabled } = prevState;
            if (!prevFilterEnabled && !equals(prevData, data)) {
                this.setState({
                    data,
                    filtered,
                    page: (filtered || data.length <= this.state.recordsPerPage) ? 1 : page,
                });
            }
        }

        public onPageChange = page => {
            this.props.onPageChange(page);
            this.setState({ page });
        }

        public onSort = sort => {
            this.props.onSort(sort);
            this.setState({ sort });
        }


        public getSortedData(filterExportOnly = false) {
            let data = [...this.state.data];
            const { customHeaders } = this.props;
            const sort = [...this.state.sort];
            for (let headKey = 0; headKey < customHeaders.length; headKey++) {
                // eslint-disable-next-line no-prototype-builtins
                if (customHeaders[headKey] && customHeaders[headKey].hasOwnProperty("exportOnly")) {
                    // you cant sort by exportOnly column ( not visible on UI )
                    // fix sort map on the fly then
                    sort.splice(headKey, 0, 0);
                    continue;
                }
                if (sort[headKey] !== SORT.NOSORT) {
                    const header = this.exportHeaders[headKey];
                    const sortFn = header && sortFunctions[header.type] || (() => -1);
                    data = data.sort((c, d) => {
                        // eslint-disable-next-line no-prototype-builtins
                        const item1 = c[headKey] && c[headKey].hasOwnProperty("value") ? c[headKey].value : c[headKey];
                        // eslint-disable-next-line no-prototype-builtins
                        const item2 = d[headKey] && d[headKey].hasOwnProperty("value") ? d[headKey].value : d[headKey];
                        return sortFn(sort[headKey], item1, item2);
                    });

                }
            }
            const result = prepareDatesFormats(this.normalizedHeaders, data);
            return filterExportOnly ? filterExportOnlyColumns(result) : result;
        }

        public onChangeRecordsPerPage = amount => {
            this.props.onChangeRecordsPerPage(amount);
            this.setState({ recordsPerPage: amount, page: 1 });
        }

        public render() {
            const { exportable, searchable, ...tableProps } = this.props;
            const { page, recordsPerPage, sort } = this.state;

            const start = recordsPerPage * (page - 1);
            const end = recordsPerPage * (page - 1) + recordsPerPage;
            return (
                <TableComponent
                    {...tableProps}
                    normalizedHeaders={this.normalizedHeaders}
                    max={this.state.data.length}
                    recordsPerPage={recordsPerPage}
                    onSort={this.onSort}
                    onPageChange={this.onPageChange}
                    onChangeRecordsPerPage={this.onChangeRecordsPerPage}
                    data={this.getSortedData(true).slice(start, end)}
                    onSearch={searchable ? this.onSearch : undefined}
                    onExportData={exportable ? this.onExportData : undefined}
                    sort={sort}
                />
            );
        }

        private onSearch(query) {
            const { data, onSearch } = this.props;
            if (typeof onSearch === "function") {
                onSearch(query);
                this.setState({ page: 1, sort: [] });
                return undefined;
            }
            const q = query.length > 0 ? query.toLowerCase() : false;
            const filteredData = data.reduce((out, column) => {
                const hasMatch = column.findIndex((field) => {
                    let fieldString = field && field.value ?
                        field.value :
                        field;
                    if (React.isValidElement(fieldString)) {
                        // you can pass react element to the table
                        // so if we detect one
                        // try to get html from it and strip html tags to have only the text
                        fieldString = ReactDomServer.renderToStaticMarkup(fieldString).replace(/(<([^>]+)>)/ig, "")
                    }
                    return fieldString && fieldString.toString().toLowerCase().indexOf(q) >= 0;
                }) >= 0;
                if (hasMatch || !q) {
                    out.push(column);
                }
                return out;
            }, []);
            this.setState({
                data: filteredData,
                filterEnabled: !!q,
                page: 1,
                sort: [],
            });
        }

        private onExportData(type: string): void {
            const { onExportData } = this.props;
            if (typeof onExportData === "function") {
                return onExportData(type);
            }
            const data = this.buildExportData();
            const isCsv = (type !== "excel");
            const ext = isCsv ? "csv" : "xlsx";
            const name = `exported_table_${fmtDateIso8601TZ(new Date())}.${ext}`;
            exportRowsToSheetsFiles(
                data,
                "SheetJS",
                name,
                isCsv,
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private buildExportData(): Array<Array<any>> {
            const { exportDataTransformFn } = this.props;
            const data = this.getSortedData();
            const exportData = exportDataTransformFn ? exportDataTransformFn(data) : data;
            return [
                this.exportHeaders.map(h => h.label),
                ...exportData.map(row => row.map(field => {
                    const properField = field?.exportValue ?? field;
                    return isDate(properField) ? fmtDateIso8601TimeLocalizedTZ(properField) : properField;
                }),
                ),
            ];
        }
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default SimpleTable(Table) as any;
