import * as React from "react";
import LineChartWithRanges, { IRangeDefinition } from "@binders/ui-kit/lib/elements/linechart/withRanges";
import { MetricMax, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import colors from "@binders/ui-kit/lib/variables";
import { loadUsersCountData } from "../../../apiclient/tracking";
import "./userMetrics.styl";

interface IUserCountProps {
    activeAccount: Account;
}

interface IUserCountState {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[];
    loadingData: boolean;
}

class UserCount extends React.Component<IUserCountProps, IUserCountState> {

    constructor(props: IUserCountProps) {
        super(props);

        this.buildUserCountData = this.buildUserCountData.bind(this);
        this.getRangeDefinitions = this.getRangeDefinitions.bind(this);
        this.state = {
            data: [],
            loadingData: false,
        };
    }

    public componentDidMount(): void {
        this.buildUserCountData();
    }

    public componentDidUpdate(prevProps: IUserCountProps): void {
        const { activeAccount: prevActiveAccount } = prevProps;
        const { activeAccount } = this.props;
        const hasNewAccount = prevActiveAccount.id !== activeAccount.id;
        if (hasNewAccount) {
            this.buildUserCountData();
        }
    }

    public render(): JSX.Element {
        const { data, loadingData } = this.state;
        const hasData = data && data.length > 0;
        const ranges: IRangeDefinition[] = this.getRangeDefinitions();
        const noDataMessage = loadingData ? "Loading data" : "No data";
        return !hasData ?
            <div className="no-data-message">{noDataMessage}</div> :
            (
                <div>
                    <LineChartWithRanges
                        title="Number of Users"
                        ranges={ranges}
                        defaultRange="year"
                        lineColor={colors.accentColor}
                        renderAsBars={true}
                        fontSize={10}
                        hatchLastBar={true}
                    />
                    <label className="usercount-info">Starting May 2024 user statistics don't include manual.to users count</label>
                    <label className="usercount-info">User creation dates are used for this statistic,
                        not the date the user got added to the account (which we currently don't store)</label>
                </div>
            );
    }

    private async buildUserCountData() {
        const { activeAccount } = this.props;
        this.setState({ data: [], loadingData: true });
        let data = [];
        try {
            data = await loadUsersCountData(activeAccount.id);
        } finally {
            const metrics = data.map(el => ({
                date: el.date,
                value: el.count
            }));
            this.setState({ data: metrics, loadingData: false });
        }
    }

    private getRangeDefinitions(): IRangeDefinition[] {
        const { data } = this.state;
        return getRangeDefinitionsFromStats(data, MetricMax);
    }
}

export default UserCount;
