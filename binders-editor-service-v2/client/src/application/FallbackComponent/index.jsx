import * as React from "react";
import AllAccounts from "../../accounts/AllAccounts";
import Button from "@binders/ui-kit/lib/elements/button";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { activateAccountId } from "../../accounts/actions";
import autobind from "class-autobind";
import { withRouter } from "react-router-dom";
import { withTranslation } from "@binders/client/lib/react/i18n";

import "./fallback.styl";

class FallbackComponent extends React.Component {

    constructor(props) {
        super(props);
        autobind(this, FallbackComponent.prototype);
        this.state = {
            accountsModalShowing: false,
        };
    }

    goBack() {
        const { history } = this.props;
        history.goBack();
    }

    showAccountsModal() {
        this.setState({
            accountsModalShowing: true,
        });
    }

    hideAccountsModal() {
        this.setState({
            accountsModalShowing: false,
        });
    }

    onSelectAccount(accountId) {
        activateAccountId(accountId);
        this.props.history.push("/browse");
    }

    renderNotFound() {
        const { t } = this.props;
        return (
            <div className="fallback-notFound">
                <img className="fallback-notFoundImage" src="/assets/sherlock.svg" alt="Page not found - 404"/>
                <p className="fallback-notFoundMessage">{t(TK.Exception_404)}</p>
            </div>
        )
    }

    renderError(exceptionThrown) {
        const { t, hideComputerSaysNo } = this.props;
        return (
            <div className="fallback-error">
                <img className="fallback-errorImage" src="/assets/error-robot.svg" alt="Error"/>
                <p className="fallback-errorMessage">
                    {!hideComputerSaysNo && t(TK.Exception_500)}
                    <span className="fallback-errorMessageException">{exceptionThrown}</span>
                </p>
            </div>
        )
    }

    renderExpired() {
        const { t } = this.props;
        return (
            <div className="fallback-expired">
                <img className="fallback-expiredImage" src="/assets/expired-robot.svg" alt="Expired Account"/>
                <p className="fallback-expiredMessageTitle">{t(TK.Account_ExpiredInfo)}</p>
                <p className="fallback-expiredMessageDescription">{t(TK.Account_ExpiredContact, { email: "expired@manual.to" })}</p>
            </div>
        )
    }

    renderGeneralError() {
        const { t } = this.props;
        return (
            <div className="fallback-error">
                <img className="fallback-errorImage" src="/assets/error-robot.svg" alt="Error"/>
                <p className="fallback-errorMessage">{t(TK.Exception_500)}</p>
            </div>
        )
    }

    renderFallbackMessage(exceptionThrown, notFound, expired = false) {
        if (exceptionThrown !== undefined) {
            return this.renderError(exceptionThrown);
        } else if (notFound === true) {
            return this.renderNotFound();
        } else if(expired === true) {
            return this.renderExpired();
        }
        else {
            return this.renderGeneralError()
        }
    }

    renderAllAccountsModal() {
        const { accounts } = this.props;
        return (
            <AllAccounts
                accounts={accounts}
                onClose={this.hideAccountsModal}
                onSelectAccount={this.onSelectAccount}
            />
        );
    }

    render() {

        const { exception, notFound, expired, accountSwitchEnabled, t, user } = this.props;
        return (
            <div>
                <div className="fallback">
                    { this.renderFallbackMessage(exception, notFound, expired) }
                    <Button
                        onClick={accountSwitchEnabled ? this.showAccountsModal : this.goBack}
                        text={accountSwitchEnabled ? t(TK.Account_ExpiredChoose) : t(TK.Account_ExpiredBack)}
                        className="fallback-goback"
                        isEnabled={true}
                        CTA={true}
                    />
                    {accountSwitchEnabled && <Button
                        hrefAnchor="/login"
                        text={t(TK.Login_AsDifferentUser)}
                        className="fallback-goback"
                        isEnabled={true}
                        secondary={true}
                    />
                    }
                    {accountSwitchEnabled && user && <span className="fallback-errorMessageInfo">{t(TK.Login_CurrentlyLoggedInAs, {email: user.login})}</span>}
                    { this.state.accountsModalShowing && this.renderAllAccountsModal()}
                </div>
            </div>
        )
    }
}

export default withTranslation()(withRouter(FallbackComponent));
