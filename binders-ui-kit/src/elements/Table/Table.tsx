import * as React from "react";
import CircularProgress from "../circularprogress";
import ContextMenu from "../contextmenu";
import DownArrow from "../icons/DownArrow";
import EntriesPerPageDropdown from "../dropdown/EntriesPerPageDropdown";
import MenuItem from "../contextmenu/MenuItem";
import Pagination from "../pagination";
import RoundButton from "../button/RoundButton";
import { SORT } from "./types";
import SearchInput from "../input/SearchInput";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import UpArrow from "../icons/UpArrow";
import cx from "classnames";
import fileDownload from "../icons/FileDownload";
import { filterExportOnlyColumns } from "./utils";
import { isMobileView } from "../../helpers/rwd";
import vars from "../../variables";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./table.styl";

export interface ITableProps extends React.HTMLProps<HTMLTableElement> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    normalizedHeaders?: Array<{ label, type, format?, unique?}>;
    recordsPerPage?: number;
    onSort?: (sort: number[]) => void;
    onPageChange?: (page: number) => void;
    onChangeRecordsPerPage?: (recordsPerPage: number) => void;
    max?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    disableRowFn?: (rowArray: any[]) => boolean;
    expandableRows?: boolean;
    rowExpandRequest?: (id: string) => void;
    expandedRowId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expandedRowContent?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSearch?: (e: any) => void;
    searchPlaceholder?: string;
    onExportData?: (type: "csv" | "excel") => void;
    exportable?: boolean;
    headerSlot?: React.ReactNode;
    sort?: number[];
    loading?: boolean;
    noActionArea?: boolean;
    noHeader?: boolean;
    lastColAlignRight?: boolean;
}

export interface ITableState {
    sort: number[];
    page: number;
    max: number;
    uniqueColumnIndex?: number;
    isExportOpened: boolean;
}

class Table extends React.Component<ITableProps, ITableState> {
    public static defaultProps: Partial<ITableProps> = {
        normalizedHeaders: [],
        onChangeRecordsPerPage: () => {
            return;
        },
        onPageChange: () => {
            return;
        },
        onSort: () => {
            return;
        },
        sort: [],
    };

    static getDerivedStateFromProps(nextProps, prevState) {
        const { data, max } = nextProps;
        if (prevState.max !== (max || data.length)) {
            return {
                ...prevState,
                max: max || data.length,
                page: 1,
            };
        }
        return null;
    }

    private emptySortState: [number];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private exportButtonRef: any;
    private t;
    private shouldShowEntriesDropdown = true;

    constructor(props) {
        super(props);
        this.t = props.t;
        const { sort, normalizedHeaders, data, max } = props;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.emptySortState = normalizedHeaders ? normalizedHeaders.map((_, headerKey) => SORT.NOSORT) : [];
        this.renderRow = this.renderRow.bind(this);
        this.toggleIsExportOpened = this.toggleIsExportOpened.bind(this);
        this.onSelectExportDataType = this.onSelectExportDataType.bind(this);
        this.renderHeaderSlot = this.renderHeaderSlot.bind(this);
        const initialMax = max || data.length;
        this.shouldShowEntriesDropdown = initialMax > props.recordsPerPage && !isMobileView();
        this.state = {
            isExportOpened: false,
            max: initialMax,
            page: 1,
            sort,
        };
    }

    public componentDidMount() {
        const { normalizedHeaders } = this.props;
        const uniqueColumnIndex = normalizedHeaders.findIndex(h => h.unique);
        this.setState({
            uniqueColumnIndex,
        });
    }

    public render() {
        const { className, data, loading, noActionArea, lastColAlignRight } = this.props;

        return !data ?
            this.renderWithChildren() :
            (
                <div>
                    {!noActionArea && <div className="table-action-area">
                        {this.renderHeaderSlot()}
                        {this.renderSearchInput()}
                        {this.renderExportButton()}
                    </div>}
                    <div className="table-wrapper">
                        {data.length === 0 ?
                            this.renderNoResults() :
                            (
                                <>
                                    <table
                                        className={cx(
                                            "table",
                                            className,
                                            { "table--lastColAlignRight": lastColAlignRight },
                                        )}
                                    >
                                        {this.renderHeader()}
                                        {!loading && <tbody>{this.renderRows()}</tbody>}
                                    </table>
                                    {loading && CircularProgress(
                                        "readStatsModal-loader",
                                        {},
                                        14, vars.borderGrayColor
                                    )}
                                </>
                            )}
                    </div>
                    {this.renderFooter()}
                </div>
            );
    }

    private renderWithChildren() {
        const { className, children } = this.props;

        return (
            <table {...this.props} className={cx("table", className)}>
                {children}
            </table>
        );
    }

    private renderHeaderSlot() {
        const { headerSlot } = this.props;
        return (
            <div className="header-slot">
                {headerSlot || null}
            </div>
        );
    }

    private renderSearchInput() {
        const { onSearch, searchPlaceholder } = this.props;
        const placeholder = searchPlaceholder ?? (this.t(TranslationKeys.General_Search) + "...");
        return (typeof onSearch !== "function") ?
            null :
            (
                <SearchInput
                    onChange={onSearch}
                    placeholder={placeholder}
                />
            );
    }

    private renderExportButton() {
        const { onExportData } = this.props;
        const { isExportOpened } = this.state;
        const shouldRender = typeof onExportData === "function";
        return !shouldRender ?
            null :
            (
                <div className="export-button-wrapper" ref={(ref) => this.exportButtonRef = ref}>
                    <RoundButton
                        icon={fileDownload()}
                        onClick={this.toggleIsExportOpened(true)}
                    />
                    <ContextMenu
                        open={isExportOpened}
                        anchorRef={this.exportButtonRef}
                        className="export-context-menu"
                        onClose={this.toggleIsExportOpened(false)}
                    >
                        <MenuItem
                            title={this.t(TranslationKeys.General_ExcelExport)}
                            onClick={this.onSelectExportDataType("excel")}
                        />
                        <MenuItem
                            title={this.t(TranslationKeys.General_CSVExport)}
                            onClick={this.onSelectExportDataType("csv")}
                        />
                    </ContextMenu>
                </div>
            );
    }

    private renderNoResults() {
        return (
            <div className="table-no-data">
                {this.t(TranslationKeys.Exception_NoData)}
            </div>
        );
    }

    private renderHeader() {
        const { sort: sorted } = this.state;
        const { normalizedHeaders, noHeader } = this.props;
        if (noHeader) {
            return null;
        }

        return (
            <thead>
                <tr>
                    {normalizedHeaders.map((header, key) => (
                        <th key={key} onClick={this.toggleSort.bind(this, key)}>
                            {header.label}
                            {this.renderHeaderArrow(sorted[key])}
                        </th>
                    ))}
                </tr>
            </thead>
        );
    }

    private renderRows() {
        const { data } = this.props;
        return filterExportOnlyColumns(data).map(this.renderRow);
    }

    private renderRow(row) {
        const {
            disableRowFn,
            expandableRows,
            expandedRowContent,
            expandedRowId,
            rowExpandRequest,
        } = this.props;

        const { uniqueColumnIndex } = this.state;

        const rowId = row[uniqueColumnIndex];
        const isExpanded = expandableRows && (expandedRowId === rowId);
        const classes = cx({
            "disabled": disableRowFn && disableRowFn(row),
            "expandable": expandableRows,
        });

        const cols = row.map((col, colKey) => {
            return (
                <td key={colKey}>
                    {
                        // eslint-disable-next-line no-prototype-builtins
                        col && col.hasOwnProperty("uiValue") ? col.uiValue : col
                    }
                </td>
            )
        });

        return [
            <tr
                key={`tr-${rowId}`}
                className={classes}
                onClick={expandableRows ? () => rowExpandRequest(rowId) : () => { /* */ }}
            >
                {cols}
            </tr>,
            !isExpanded ?
                undefined :
                (
                    <tr key={`${rowId}-exp`} className="expanded">
                        <td colSpan={cols.length}>
                            {expandedRowContent}
                        </td>
                    </tr>
                ),
        ];
    }

    private renderFooter() {
        const { recordsPerPage } = this.props;
        const { max } = this.state;
        return (
            <div className="table-footer">
                {max <= recordsPerPage ?
                    <ul className="pagination" /> :
                    (
                        <Pagination
                            max={Math.ceil(max / recordsPerPage)}
                            onPageChange={this.onPageChange}
                        />
                    )
                }
                {this.shouldShowEntriesDropdown && (
                    <EntriesPerPageDropdown
                        selectElement={this.onChangeEntriesPerPage}
                        entriesPerPage={recordsPerPage}
                    />
                )}
            </div>
        );
    }

    private toggleSort(key) {
        const { sort: sorted } = this.state;
        const sort = [...this.emptySortState];
        sort[key] = sorted[key] === SORT.ASC ? SORT.DESC : sorted[key] + 1;
        this.props.onSort(sort);
        this.setState({ sort });
    }

    private renderHeaderArrow(direction: SORT) {
        const { ASC, NOSORT } = SORT;
        if (direction === NOSORT) {
            return undefined;
        }
        return direction === ASC ? <UpArrow /> : <DownArrow />;
    }

    private onPageChange = (page: number) => {
        // load more data
        this.props.onPageChange(page);
        this.setState({ page });
    }

    private onChangeEntriesPerPage = amount => {
        this.props.onChangeRecordsPerPage(amount);
    }

    private toggleIsExportOpened(value: boolean) {
        return () => {
            this.setState({ isExportOpened: value });
        }
    }

    private onSelectExportDataType(type: "excel" | "csv"): () => void {
        const { onExportData } = this.props;
        return () => {
            onExportData(type);
            this.setState({ isExportOpened: false });
        };
    }

}

export default withTranslation()(Table);
