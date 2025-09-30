import * as React from "react";
import LineChartWithRanges, { IRangeDefinition } from "@binders/ui-kit/lib/elements/linechart/withRanges";
import { Metric, MetricSum, getRangeDefinitionsFromStats } from "../../../shared/dateRangeBuilder";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import colors from "@binders/ui-kit/lib/variables";
import { loadLoginData } from "../../../apiclient/tracking";

interface IUserLoginsProps {
    activeAccount: Account;
}

interface IUserLoginsState {
    data: Metric[];
    loadingData: boolean;
    error: Error;
}

class UserLogins extends React.Component<IUserLoginsProps, IUserLoginsState> {

    constructor(props: IUserLoginsProps) {
        super(props);

        this.buildLoginData = this.buildLoginData.bind(this);
        this.getRangeDefinitions = this.getRangeDefinitions.bind(this);
        this.state = {
            data: [],
            loadingData: false,
            error: undefined
        };
    }

    public componentDidMount(): void {
        this.buildLoginData();
    }

    public componentDidUpdate(prevProps: IUserLoginsProps): void {
        const { activeAccount: prevActiveAccount } = prevProps;
        const { activeAccount } = this.props;
        const hasNewAccount = prevActiveAccount.id !== activeAccount.id;
        if (hasNewAccount) {
            this.buildLoginData();
        }
    }

    public render(): JSX.Element {
        const { data, error, loadingData } = this.state;
        const hasData = data.length > 0 && !data.every(d => d.value === 0);
        const ranges: IRangeDefinition[] = this.getRangeDefinitions();
        let message;
        if (loadingData) {
            message = "Loading data";
        } else if (error) {
            message = error.message || error;
        } else {
            message = "No user logins so far...";
        }
        return !hasData ?
            <div className="no-data-message">{message}</div> :
            (
                <LineChartWithRanges
                    title="User Logins"
                    ranges={ranges}
                    defaultRange="year"
                    lineColor={colors.accentColor}
                    renderAsBars={true}
                    fontSize={10}
                    hatchLastBar={true}
                />
            );
    }

    private async buildLoginData() {
        const { activeAccount } = this.props;
        this.setState({ data: [], loadingData: true });
        let data = [];
        try {
            data = await loadLoginData(activeAccount.id);
        } catch (err) {
            return this.setState({ data, error: err, loadingData: false })
        }
        const metrics = data.map(el => ({
            date: el.date,
            value: el.logins
        }));
        this.setState({ data: metrics, loadingData: false, error: undefined });
    }

    private getRangeDefinitions(): IRangeDefinition[] {
        const { data } = this.state;
        return getRangeDefinitionsFromStats(data, MetricSum);
    }
}

export default UserLogins;