import * as React from "react";
import { insertWhitelistedEmail, setWhitelistedEmailActive } from "../../actions";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import DropDown from "@binders/ui-kit/lib/elements/dropdown";
import Input from "@binders/ui-kit/lib/elements/input";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import autobind from "class-autobind";
import { useAccountWhitelistedEmailsOrEmpty } from "../../hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "../users.styl";

class WhitelistedEmails extends React.Component {

    constructor(props) {
        super(props);
        autobind(this, WhitelistedEmails.prototype);
        this.state = {
            isAddingWhitelistedEmail: false,
            whitelistEmailPattern: "",
            whitelistEmailDomainId: "",
            whitelistedEmails: props.whitelistedEmails,
        }
    }

    getWhitelistedEmailDomainOptions() {
        const { domains } = this.props;
        return domains.map(domain => ({
            id: domain,
            label: domain,
        }));
    }

    updateWhitelistEmailPattern(whitelistEmailPattern) {
        this.setState({ whitelistEmailPattern });
    }

    updateWhitelistEmailDomainId(whitelistEmailDomainId) {
        this.setState({ whitelistEmailDomainId });
    }

    async saveNewWhitelistedEmail() {
        const { accountId, domains } = this.props;
        const { whitelistEmailDomainId, whitelistEmailPattern, whitelistedEmails } = this.state;
        const domainId = domains.length === 1 ? domains[0] : whitelistEmailDomainId;
        const newWhitelistedEmail = await insertWhitelistedEmail(
            accountId,
            domainId,
            whitelistEmailPattern,
        );
        this.setState({
            updateWhitelistEmailDomainId: "",
            updateWhitelistEmailPattern: "",
            isAddingWhitelistedEmail: false,
            whitelistedEmails: [...whitelistedEmails, newWhitelistedEmail],
        });
    }

    toWhitelistedEmailTableRowArray(whitelistedEmail) {
        const { pattern, domain, id, active } = whitelistedEmail;
        const { accountId } = this.props;
        const buildToggleEmail = () => ((checked) => setWhitelistedEmailActive(id, checked, accountId));
        return [
            pattern,
            domain,
            <Checkbox
                checked={active}
                onCheck={buildToggleEmail()}
            />
        ]
    }

    toggleIsAddingWhitelistedEmail() {
        const isAddingWhitelistedEmail = !this.state.isAddingWhitelistedEmail;
        this.setState({ isAddingWhitelistedEmail });
    }

    renderAddWhiteListedEmailModal() {
        const { domains, t } = this.props;
        const { whitelistEmailDomainId, whitelistEmailPattern } = this.state;

        return (
            <Modal
                title={t(TK.User_NewPattern)}
                buttons={[<Button key="add" text={t(TK.General_Add)} onClick={this.saveNewWhitelistedEmail} />]}
                hidden={!this.state.isAddingWhitelistedEmail}
                onHide={this.toggleIsAddingWhitelistedEmail}
                onEnterKey={this.saveNewWhitelistedEmail}
                onEscapeKey={this.toggleIsAddingWhitelistedEmail}
            >
                <div className="whitelisted-emails-modal-body">
                    <Input
                        placeholder={t(TK.User_EmailPattern)}
                        onChange={this.updateWhitelistEmailPattern}
                        value={whitelistEmailPattern}
                    />
                    {domains.length > 1 && (
                        <DropDown
                            type={t(TK.General_Domain)}
                            elements={this.getWhitelistedEmailDomainOptions()}
                            selectedElementId={whitelistEmailDomainId}
                            onSelectElement={this.updateWhitelistEmailDomainId}
                        />
                    )}
                </div>
            </Modal>
        );

    }

    render() {
        const { t } = this.props;
        const { whitelistedEmails } = this.props;

        const headers = [
            t(TK.General_Pattern).toUpperCase(),
            t(TK.General_Domain).toUpperCase(),
            t(TK.General_Enabled).toUpperCase(),
        ];
        const whitelistedEmailData = whitelistedEmails.map(this.toWhitelistedEmailTableRowArray);
        return (
            <div className="whitelisted-emails">
                {this.renderAddWhiteListedEmailModal()}
                <div className="whitelisted-emails-cta">
                    <Button
                        text={t(TK.User_NewWhitelistedEmail)}
                        onClick={this.toggleIsAddingWhitelistedEmail}
                    />
                </div>
                <div className="whitelisted-emails-overview">
                    <Table
                        customHeaders={headers}
                        data={whitelistedEmailData}
                        searchable
                    />
                </div>
            </div>
        );
    }

}

const WhitelistedEmailsWithHooks = withHooks(WhitelistedEmails, () => ({
    whitelistedEmails: useAccountWhitelistedEmailsOrEmpty(),
}))
export default withTranslation()(WhitelistedEmailsWithHooks);
