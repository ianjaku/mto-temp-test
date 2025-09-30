import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountSelector from "./accountSelector";

interface ISuccessMetricPaneProps {
    activeAccount: Account;
    accounts: Account[];
    onAccountChange: (newActiveAccount: Account) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class SuccessMetricPane extends React.Component<ISuccessMetricPaneProps, any> {
    render(): JSX.Element {
        const { accounts, activeAccount, children, onAccountChange } = this.props;
        return (
            <div>
                <AccountSelector
                    activeAccount={activeAccount}
                    accounts={accounts}
                    onAccountChange={onAccountChange}
                />
                {children}
            </div>
        );
    }
}

export default SuccessMetricPane;