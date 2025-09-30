import * as React from "react";
import {
    AccountFeatures,
    FEATURE_PUBLICCONTENT
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    IUserActionSummary,
    UserReadSessionsFilter
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { APISearchUserReadSessions } from "../../../analytics/api";
import CircularProgress from "@binders/ui-kit/lib/elements/circularprogress";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import { FlashMessages } from "../../../logging/FlashMessages";
import { ITableDataCell } from "@binders/ui-kit/lib/elements/Table";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { extractUserTagsColumns } from "../../../analytics/helpers";
import { fmtDateIso8601TimeLocalizedTZ } from "@binders/client/lib/util/date";
import { secondsToUserReadableFormat } from "@binders/client/lib/util/time";
import { sub } from "date-fns";
import vars from "@binders/ui-kit/lib/variables";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./ReadStatsModal.styl";

export interface IReadStatsModalProps {
    accountId: string;
    onHide: () => void;
    accountFeatures: AccountFeatures | undefined;
    item: { id: string, kind: "collection" | "document" };
    t: TFunction;
}

enum RangeType {
    DAYS = "days",
    WEEKS = "weeks",
    MONTHS = "months",
    YEARS = "years",
}

/**
 * Converts the internal {@link RangeType} to <code>date-fns</code> {@link Duration}
 * @param rangeType a {@link RangeType} value
 */
const rangeTypeToDurationType = (rangeType: RangeType): keyof Duration => rangeType;

export interface IReadStatsModalState {
    stats: IUserActionSummary[] | null;
    loading: boolean;
    filter: {
        rangeType: RangeType,
        rangeCount: number
    };
    tableData?: ITableDataCell[][];
    tableHeaders?: Array<{ label, type, format?, defaultSort?, exportOnly?} | string>;
}
class ReadStatsModal extends React.Component<IReadStatsModalProps, IReadStatsModalState> {

    constructor(props: IReadStatsModalProps) {
        super(props);
        this.state = {
            stats: undefined,
            loading: false,
            filter: {
                rangeType: RangeType.WEEKS,
                rangeCount: 1
            }
        };
        this.updateTableData = this.updateTableData.bind(this);
        this.updateTableHeaders = this.updateTableHeaders.bind(this);
    }

    async updateStats() {
        const { item, accountId, t } = this.props;
        this.setState({
            loading: true
        });
        const { rangeType, rangeCount } = this.state.filter;
        const startDate = sub(Date.now(), { [rangeTypeToDurationType(rangeType)]: rangeCount });

        const filterForAPI: UserReadSessionsFilter = {
            accountId: accountId,
            itemIds: [item.id],
            userIds: [],
            userGroupIds: [],
            recursive: true,
            startRange: {
                rangeStart: startDate
            },
            shouldIncludeParentPaths: true,
        };

        try {
            const userActionStatisticsReport = await APISearchUserReadSessions(filterForAPI);
            this.setState({
                stats: userActionStatisticsReport.userActions,
            });
        } catch (ex) {
            FlashMessages.error(t(TK.Analytics_ErrorRetrievingStatistics));
        } finally {
            this.setState({
                loading: false
            })
        }
    }

    buildStateFromProps() {
        return {
            stats: undefined,
        }
    }

    async componentDidMount() {
        await this.updateStats();
        await this.updateTableData();
        await this.updateTableHeaders();
    }

    async componentDidUpdate(prevProps: IReadStatsModalProps, prevState: IReadStatsModalState) {
        const { stats } = this.state;
        const { stats: prevStats } = prevState;
        const { accountFeatures, item } = this.props;
        const { accountFeatures: prevAccountFeatures, item: prevItem } = prevProps;
        if (stats !== prevStats || item !== prevItem || accountFeatures !== prevAccountFeatures) {
            this.updateTableData();
        }
        if (stats !== prevStats || item !== prevItem) {
            this.updateTableHeaders();
        }
    }

    async updateTableHeaders() {
        const { t, item } = this.props;
        const { stats } = this.state;
        const isCollection = item.kind === "collection";
        const numberOfAncestorColumns = 10;
        const ancestorHeader = Array(numberOfAncestorColumns).fill("collection ")
            .map((el, i) => `${el}${i + 1}`);
        const userTagNames = stats && extractUserTagsColumns(stats);
        const tableHeaders = [
            ...(isCollection ? [t(TK.DocManagement_Doc)] : []),
            t(TK.User_UserName),
            { label: t(TK.User_Login), exportOnly: true, type: "string" },
            t(TK.User_ActionTime),
            t(TK.User_ActionDuration),
            ...(ancestorHeader.map(header => ({ label: header, type: "string", exportOnly: true }))),
            ...(userTagNames || []).map(v => ({ label: v, type: "string", exportOnly: true })),
        ]
        this.setState({
            tableHeaders,
        })
    }

    async updateTableData() {
        const { t, accountFeatures, item } = this.props;
        const { stats } = this.state;
        const isCollection = item.kind === "collection";
        const tableData = stats && stats.map(row => {
            const timestamp = fmtDateIso8601TimeLocalizedTZ(row.timestamp);
            const duration = secondsToUserReadableFormat(row.duration, t);

            let userName;
            if (row.userDisplayName === "public") {
                userName = accountFeatures && accountFeatures.includes(FEATURE_PUBLICCONTENT) ? row.userDisplayName : t(TK.General_NotApplicable);
            } else {
                userName = row.userDisplayName || row.userEmail;
            }
            const documentTitle = this.limitStrLength(row.title, 20);
            const documentTitleLink = row.url ?
                <a className="link" target="_blank" href={row.url}>{documentTitle}</a> :
                documentTitle;

            const userTagNames = stats && extractUserTagsColumns(stats);

            const userTagDataCells = userTagNames.reduce((reduced, userTagName) => {
                const val = row.userTags.find(tag => tag.name === userTagName)?.value;
                if (!val) {
                    return reduced;
                }
                return reduced.concat({ uiValue: val, value: val, exportValue: val, exportOnly: true });
            }, [] as ITableDataCell[]);

            return ([
                ...(isCollection ? [{ uiValue: documentTitleLink, value: documentTitle, exportValue: row.title }] : []),
                userName,
                { exportOnly: true, exportValue: row.userEmail },
                { uiValue: timestamp, value: row.timestamp.getTime(), exportValue: timestamp },
                {
                    value: row.duration,
                    uiValue: duration,
                    exportValue: row.duration
                },
                ...(row.ancestors ? row.ancestors.map(ancestor => ({ exportValue: ancestor, exportOnly: true })) : []),
                ...userTagDataCells,
            ]);
        });
        this.setState({
            tableData,
        })
    }

    sinceRangeCountLimit(type: RangeType) {
        if (type === RangeType.DAYS) {
            return 60;
        }
        if (type === RangeType.WEEKS) {
            return 20;
        }
        if (type === RangeType.MONTHS) {
            return 24;
        }
        return 3;
    }

    buildCountElements(length: number) {
        return Array.from({ length }, (v, i) => ({
            id: i + 1,
            label: (i + 1).toString()
        }));
    }

    onRangeCountChange(newValue: string | number) {
        const val = typeof newValue === "string" ? parseInt(newValue) : newValue;
        this.setState({
            filter: {
                ...this.state.filter,
                rangeCount: val
            }
        }, () => this.updateStats())
    }

    onRangeTypeChange(newValue: RangeType) {
        let count = this.state.filter.rangeCount;
        if (count > this.sinceRangeCountLimit(newValue)) {
            count = this.sinceRangeCountLimit(newValue);
        }
        this.setState({
            filter: {
                rangeCount: count,
                rangeType: newValue
            }
        }, () => this.updateStats())
    }

    renderSinceFilter() {
        const { t } = this.props;

        return (
            <div className="readStatsModal-since" style={{ display: "flex" }}>
                <Dropdown
                    className="readStatsModal-since-dropdown readStatsModal-since-dropdown--thin"
                    type="test"
                    selectedElementId={this.state.filter.rangeCount}
                    elements={this.buildCountElements(this.sinceRangeCountLimit(this.state.filter.rangeType))}
                    onSelectElement={val => this.onRangeCountChange(val)}
                    maxRows={8}
                    showBorders={true}
                    maxHeight={200}
                />
                <Dropdown
                    className="readStatsModal-since-dropdown"
                    type="test"
                    selectedElementId={this.state.filter.rangeType}
                    onSelectElement={val => this.onRangeTypeChange(val)}
                    elements={[
                        {
                            id: RangeType.DAYS,
                            label: t(TK.General_Day, { count: 1 })
                        },
                        {
                            id: RangeType.WEEKS,
                            label: t(TK.General_Week, { count: 1 })
                        },
                        {
                            id: RangeType.MONTHS,
                            label: t(TK.General_Month, { count: 1 })
                        },
                        {
                            id: RangeType.YEARS,
                            label: t(TK.General_Year, { count: 1 })
                        }
                    ]}
                />
            </div>
        )
    }

    render() {
        const { onHide, t } = this.props;
        const { loading, tableData, tableHeaders } = this.state;
        return (
            <Modal
                title={t(TK.Analytics_ReadSessions)}
                onHide={onHide}
                classNames="readStatsModal"
                onEnterKey={onHide}
                onEscapeKey={onHide}
            >
                {tableData ?
                    <Table
                        headerSlot={this.renderSinceFilter()}
                        recordsPerPage={5}
                        searchable
                        exportable
                        filtered
                        loading={loading}
                        customHeaders={tableHeaders}
                        data={tableData}
                    /> :
                    CircularProgress("readStatsModal-loader", {}, 14, vars.borderGrayColor)}
            </Modal>
        );
    }

    private limitStrLength(str: string, maxLength: number) {
        if (str.length <= maxLength) return str;
        return str.slice(0, maxLength) + "..."
    }
}

export default withTranslation()(ReadStatsModal);