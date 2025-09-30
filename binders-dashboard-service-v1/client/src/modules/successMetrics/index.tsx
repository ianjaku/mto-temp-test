import * as React from "react";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountSuccessMetrics from "./accountMetrics/AccountSuccessMetrics";
import DocumentMetrics from "./documentMetrics";
import ReadSessions from "./readsessions";
import SuccessMetricPane from "./pane";
import UserMetrics from "./userMetrics";

interface ISuccessMetricsProps {
    accounts: Account[];
}

interface ISuccessMetricsState {
    activeAccount: Account;
}

class SuccessMetrics extends React.Component<ISuccessMetricsProps, ISuccessMetricsState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            activeAccount: undefined
        };
        this.onAccountChange = this.onAccountChange.bind(this);
    }

    private onAccountChange (account)  {
        this.setState({
            activeAccount: account
        });
    }

    private renderPane(children) {
        const { accounts } = this.props;
        const { activeAccount } = this.state;

        return (
            <SuccessMetricPane accounts={accounts} onAccountChange={this.onAccountChange} activeAccount={activeAccount}>
                {activeAccount && children}
            </SuccessMetricPane>
        );
    }

    render(): JSX.Element {
        const { accounts } = this.props;
        const { activeAccount } = this.state;
        return (
            <div className="content">
                <Tabs>
                    <Pane label="Overview">
                        {this.renderPane(<AccountSuccessMetrics activeAccount={activeAccount} accounts={accounts} /> )}
                    </Pane>
                    <Pane label="User metrics">
                        {this.renderPane(<UserMetrics activeAccount={activeAccount} />)}
                    </Pane>
                    <Pane label="Document metrics">
                        {this.renderPane(<DocumentMetrics activeAccount={activeAccount} />)}
                    </Pane>
                    <Pane label="Exports">
                        {this.renderPane(<ReadSessions activeAccount={activeAccount} />)}
                    </Pane>
                </Tabs>

            </div>
        );
    }
}

export default SuccessMetrics;
