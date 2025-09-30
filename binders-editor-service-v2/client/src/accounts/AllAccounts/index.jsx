import * as React from "react";
import Button from "@binders/ui-kit/lib/elements/button";
import Modal from "@binders/ui-kit/lib/elements/modal";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "./allAccounts.styl";

class AllAccounts extends React.Component {

    constructor(props) {
        super(props);

        this.selectAccount = this.selectAccount.bind(this);
        this.activateSelectedAccount = this.activateSelectedAccount.bind(this);
        this.updateAccountFilter = this.updateAccountFilter.bind(this);

        this.state = {
            accountFilter: "",
            filteredAccounts: props.accounts.filter(acc => acc?.id !== props.activeAccountId),
            activeAccount: props.accounts.find(acc => acc?.id === props.activeAccountId),
            selectedAccountId: undefined,
        }
    }

    selectAccount(accountId) {
        this.setState({
            selectedAccountId: accountId
        });
    }

    renderAccountCircle(thumbnail, cssPrefix, bgColor, rotation) {
        return thumbnail ?
            <img
                className={`${cssPrefix}-thumbnail`}
                src={thumbnail} alt="logo"
                style={{
                    backgroundColor: bgColor ? `#${bgColor}` : "white",
                    transform: !rotation ? undefined : `rotate(${rotation}deg)`,
                }}
            /> :
            <div className={`${cssPrefix}-thumbnail`} />
    }

    renderAccount(account) {
        const isActive = account.id === this.props.activeAccountId;
        const isExpired = !account.accountIsNotExpired;
        const isUnselectable = (isActive && !this.props.isActiveSelectable) || isExpired;
        const isSelected = account.id === this.state.selectedAccountId;
        const thumbnail = account.thumbnail && account.thumbnail.buildRenderUrl({ requestedFormatNames: ["thumbnail", "medium"] });
        const bgColor = account.thumbnail && account.thumbnail.bgColor;
        const rotation = account.thumbnail && account.thumbnail.rotation;
        const cssPrefix = "all-accounts-modal-body-accounts-element";

        let className;

        if (isUnselectable) {
            className = cssPrefix;
        } else {
            className = isSelected ?
                `${cssPrefix} ${cssPrefix}--isSelected` :
                `${cssPrefix} ${cssPrefix}--selectable`;
        }

        const onClick = () => {
            if (!isUnselectable) {
                this.selectAccount(account.id);
            }
        };
        return (
            <div key={account.id} className={className} onClick={onClick}>
                {this.renderAccountCircle(thumbnail, cssPrefix, bgColor, rotation)}
                <div>{account.name}
                    {isActive && ` (${this.props.t(TK.Account_CurrentlyActive)})`}
                    {isExpired && ` (${this.props.t(TK.Account_Expired)})`}
                </div>
            </div>
        );
    }

    renderAccounts() {
        const accounts = this.state.filteredAccounts.map(account => this.renderAccount(account));
        return (
            <div className="all-accounts-modal-body-accounts">
                {this.state.activeAccount && this.renderAccount(this.state.activeAccount)}
                {accounts}
            </div>
        );
    }

    updateAccountFilter(filter) {
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

    activateSelectedAccount() {
        const { selectedAccountId } = this.state;
        const { onSelectAccount } = this.props;
        onSelectAccount(selectedAccountId);
    }

    renderButtons() {
        const enabled = this.state.selectedAccountId !== undefined;
        return [
            <Button isEnabled={enabled} text={this.props.t(TK.General_Ok)} onClick={this.activateSelectedAccount} />
        ];
    }

    renderSearchInput() {
        return <SearchInput placeholder={this.props.t(TK.Account_Search)} onChange={this.updateAccountFilter} />;
    }


    render() {
        const accounts = this.renderAccounts();
        const buttons = this.renderButtons();
        const searchInput = this.renderSearchInput();
        const { t } = this.props;
        return (
            <Modal
                withoutPadding={true}
                buttons={buttons}
                classNames="all-accounts-modal"
                title={t(TK.Account_Select)}
                onHide={this.props.onClose}
                onEnterKey={this.activateSelectedAccount}
                onEscapeKey={this.props.onClose}
            >
                <div className="all-accounts-modal-body" buttons={buttons}>
                    {searchInput}
                    {accounts}
                </div>
            </Modal>
        );
    }
}

export default withTranslation()(AllAccounts);