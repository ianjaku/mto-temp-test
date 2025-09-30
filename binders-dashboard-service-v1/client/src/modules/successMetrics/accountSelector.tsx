import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AllAccounts from "../../components/AllAccounts";
import Button from "@binders/ui-kit/lib/elements/button";
import "./accountSelector.styl";

interface IAccountSelectorProps {
    activeAccount: Account;
    accounts: Account[];
    onAccountChange: (newActiveAccount: Account) => void;
}

interface IAccountSelectorState {
    showSelector: boolean;
}

class AccountSelector extends React.Component<IAccountSelectorProps, IAccountSelectorState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            showSelector: false
        };
    }

    render(): JSX.Element {
        if (this.state.showSelector) {
            return this.renderSelector();
        }
        if (this.props.activeAccount) {
            return this.renderSingleAccount();
        } else {
            return this.renderAllAccounts();
        }
    }

    private renderAllAccounts() {
        const onClick = this.showAccountSelector.bind(this);
        return (
            <div className="metrics-account-selector">
                <div className="metrics-account-selector-text">
                    Please select an account first
                </div>
                <Button text="Choose account" onClick={onClick}/>
            </div>
        );
    }

    private renderSelector() {
        const { onAccountChange, accounts, activeAccount } = this.props;
        const activeAccountId = activeAccount && activeAccount.id;
        const onClose = this.hideAccountSelector.bind(this);
        const activateAccountId = (aid) => {
            const account = accounts.find(a => a.id === aid);
            if (account) {
                onAccountChange(account);
            }
            onClose();
        };
        return (
            <AllAccounts
                accounts={accounts}
                activeAccountId={activeAccountId}
                activateAccountId={activateAccountId}
                onClose={onClose}
            />
        );
    }

    private hideAccountSelector() {
        this.setState({
            showSelector: false
        });
    }

    private showAccountSelector () {
        this.setState({
            showSelector: true
        });
    }

    private renderSingleAccount() {
        const { activeAccount } = this.props;
        const showSelector = this.showAccountSelector.bind(this);
        return (
            <div className="metrics-account-selector">
                <div className="metrics-account-selector-text">
                    Currently active:
                </div>
                <div className="metrics-account-active-account">{activeAccount.name}</div>
                <Button text="Switch to another account" onClick={showSelector}/>
            </div>
        );
    }
}

export default AccountSelector;