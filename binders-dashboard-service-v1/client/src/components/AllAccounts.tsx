import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import "./allAccounts.styl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type History = any;

export interface IAllAccountsProps {
    accounts: Account[];
    activeAccountId: string;
    activateAccountId: (accountId: string) => void;
    history?: History;
    onClose: () => void;
}

export interface IAllAccountsState {
    accountFilter: string;
    filter: string;
    filteredAccounts: Account[];
    activeAccount: Account;
    selectedAccountId: string;
}

class AllAccounts extends React.Component<IAllAccountsProps, IAllAccountsState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.state = {
            filter: undefined,
            accountFilter: "",
            filteredAccounts: props.accounts.filter(acc => acc.id !== props.activeAccountId),
            activeAccount: props.accounts.find(acc => acc.id === props.activeAccountId),
            selectedAccountId: undefined,
        };
        this.selectAccount = this.selectAccount.bind(this);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    selectAccount(accountId, cb?) {
        this.setState({
            selectedAccountId: accountId
        }, cb);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    renderAccount(account): JSX.Element {
        const isActive = account.id === this.props.activeAccountId;
        const isSelected = account.id === this.state.selectedAccountId;
        const thumbnail = account && account.thumbnail && account.thumbnail.thumbnail;
        const bgColor = account && account.thumbnail && account.thumbnail.bgColor;
        const cssPrefix = "all-accounts-modal-body-accounts-element";

        let className;
        if (isActive) {
            className = cssPrefix;
        } else {
            className = isSelected ?
                `${cssPrefix} ${cssPrefix}--isSelected` :
                `${cssPrefix} ${cssPrefix}--selectable`;
        }
        const onClick = () => {
            if (!isActive) {
                this.selectAccount(account.id);
            }
        };
        const activate = this.activateSelectedAccount.bind(this);
        const onDoubleClick = () => {
            if (isActive) {
                return activate();
            } else {
                return this.selectAccount(account.id, activate);
            }
        }

        return (
            <div key={account.id} className={className} onClick={onClick} onDoubleClick={onDoubleClick}>
                {thumbnail ?
                    (<img className={`${cssPrefix}-thumbnail`} src={thumbnail} style={{ backgroundColor: bgColor ? `#${bgColor}` : "white" }} alt="logo" />) :
                    (<div className={`${cssPrefix}-thumbnail`} />)
                }
                <div>{account.name}
                    {isActive && " (currently active)"}
                </div>
            </div>
        );
    }

    renderAccounts(): JSX.Element {
        const accounts = this.state.filteredAccounts.map(account => this.renderAccount(account));
        return (
            <div className="all-accounts-modal-body-accounts">
                {this.state.activeAccount && this.renderAccount(this.state.activeAccount)}
                {accounts}
            </div>
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    updateAccountFilter(filter): void {
        const filteredAccounts = filter ?
            this.props.accounts
                .filter(acc => acc.id !== this.props.activeAccountId)
                .filter(acc => acc.name.toLowerCase().indexOf(filter.toLowerCase()) > -1) :
            this.props.accounts;
        this.setState({
            filter,
            filteredAccounts
        });
    }

    activateSelectedAccount(): void {
        const { activateAccountId } = this.props;
        const { selectedAccountId } = this.state;
        activateAccountId(selectedAccountId);
        if (this.props.history) {
            this.props.history.push("/browse");
        }
    }

    renderButtons(): JSX.Element[] {
        const enabled = this.state.selectedAccountId !== undefined;
        return [
            <Button isEnabled={enabled} text="OK" onClick={this.activateSelectedAccount.bind(this)} />
        ];
    }

    renderSearchInput(): JSX.Element {
        return <SearchInput placeholder="Search Account" onChange={this.updateAccountFilter.bind(this)} />;
    }


    render(): JSX.Element {
        const accounts = this.renderAccounts();
        const buttons = this.renderButtons();
        const searchInput = this.renderSearchInput();
        const activate = this.activateSelectedAccount.bind(this);
        const onKeyDown = ({ keyCode }) => {
            if (keyCode === 13) {
                activate();
            }
        }
        return (
            <Modal
                withoutPadding={true}
                buttons={buttons}
                classNames="all-accounts-modal"
                title="Select account"
                onHide={this.props.onClose}
            >
                <div className="all-accounts-modal-body" onKeyDown={onKeyDown} tabIndex={1}>
                    {searchInput}
                    {accounts}
                </div>
            </Modal>
        );
    }
}

export default AllAccounts;