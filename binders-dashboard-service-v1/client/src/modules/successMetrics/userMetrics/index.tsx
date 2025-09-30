import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import UserCount from "./userCount";
import UserLogins from "./logins";
import "./userMetrics.styl";

interface IUserMetricsProps {
    activeAccount: Account;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IUserMetricsState {

}

class UserMetrics extends React.Component<IUserMetricsProps, IUserMetricsState> {

    render(): JSX.Element {
        const { activeAccount } = this.props;
        return (
            <div>
                <div className="stats-section">
                    <UserLogins activeAccount={activeAccount} />
                </div>
                <div className="stats-section">
                    <UserCount activeAccount={activeAccount} />
                </div>
            </div>
        );
    }
}

export default UserMetrics;