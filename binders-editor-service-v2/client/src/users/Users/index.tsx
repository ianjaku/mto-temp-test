import * as React from "react";
import {
    FEATURE_CEVA,
    FEATURE_GROUP_OWNERS
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import {
    accountUserImportActions,
    accountUsers,
    accountWhitelistedEmails
} from "../actions";
import {
    useRibbonsBottomHeight,
    useRibbonsTopHeight
} from "@binders/ui-kit/lib/compounds/ribbons/hooks";
import AccountStore from "../../accounts/store";
import { Container } from "flux/utils";
import FallbackComponent from "../../application/FallbackComponent";
import GroupOwners from "./GroupOwners/GroupOwners";
import { GroupOwnersContextProvider } from "./GroupOwners/GroupOwnersContext";
import ImportUsers from "./ImportUsers";
import ManageUsers from "./ManageUsers";
import { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Usergroups from "./Usergroups";
import { WebData } from "@binders/client/lib/webdata";
import { WebDataComponent } from "@binders/ui-kit/lib/elements/webdata";
import WhitelistedEmails from "./WhitelistedEmails";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";

type UsersProps = RouteComponentProps & {
    ribbonsBottomHeight: number;
    ribbonsTopHeight: number;
    t;
};

class Users extends WebDataComponent<unknown, UsersProps> {

    static getStores() {
        return [
            AccountStore,
        ]
    }

    static calculateState(_prevState) {
        return {
            data: WebData.compose({
                accounts: AccountStore.myAccounts(),
                domains: AccountStore.getDomains(),
                features: AccountStore.getAccountFeatures(),
            }),
        };
    }

    constructor(props: UsersProps) {
        super(props);
    }

    componentDidMount() {
        const activeAccountId = AccountStore.getActiveAccountId();
        const activeAccount = AccountStore.getActiveAccount();
        const { amIAdmin, canIAccessImportUsersMgmt } = activeAccount;
        if (amIAdmin) {
            accountUsers(activeAccountId);
            accountWhitelistedEmails(activeAccountId);
        }
        if (canIAccessImportUsersMgmt) {
            accountUserImportActions(activeAccountId);
        }
    }

    renderSuccess(data) {
        const { t } = this.props;
        const { domains, features } = data;
        const accountId = AccountStore.getActiveAccountId();
        const account = AccountStore.getAccount(accountId);
        const isCevaEnabled = features.includes(FEATURE_CEVA);

        const showManageUsers = account.amIAdmin;
        const showWhitelistedEmails = account.amIAdmin;
        const showImportUsers = account.canIAccessImportUsersMgmt;
        const showUsergroups = account.canIAccessUsergroupsMgmt;
        const showGroupOwners = account.amIAdmin && features.includes(FEATURE_GROUP_OWNERS);

        return (
            <div
                className="users"
                style={{
                    marginTop: `${this.props.ribbonsTopHeight}px`,
                    marginBottom: `${this.props.ribbonsBottomHeight}px`,
                }}
            >
                <Tabs>
                    {showManageUsers && (
                        <Pane label={t(TK.User_ManageUsers)}>
                            <ManageUsers
                                account={account}
                                domains={domains}
                            />
                        </Pane>
                    )}
                    {showWhitelistedEmails && (
                        <Pane label={t(TK.User_WhitelistedEmails)}>
                            <WhitelistedEmails
                                domains={domains}
                                accountId={accountId}
                            />
                        </Pane>
                    )}
                    {showGroupOwners && (
                        <Pane label={t(TK.User_GroupOwners_TabTitle)}>
                            <GroupOwnersContextProvider>
                                <GroupOwners />
                            </GroupOwnersContextProvider>
                        </Pane>
                    )}
                    {showImportUsers && (
                        <Pane label={isCevaEnabled ? t(TK.User_ImportUsersCeva) : t(TK.User_ImportUsers)}>
                            <ImportUsers
                                account={account}
                                domains={domains}
                            />
                        </Pane>
                    )}
                    {showUsergroups && (
                        <Pane label={t(TK.User_UserGroups)}>
                            <Usergroups
                                accountId={accountId}
                            />
                        </Pane>
                    )}
                </Tabs>
            </div>
        )
    }

    renderFailure(error) {
        return <FallbackComponent msg={error.toString()} />
    }

    render() {
        return this.renderWebData(this.state.data);
    }
}

const container = Container.create(fixES5FluxContainer(Users), { withProps: true })
const containerWithHooks = withHooks(container, () => ({
    ribbonsTopHeight: useRibbonsTopHeight(),
    ribbonsBottomHeight: useRibbonsBottomHeight(),
}))
export default withTranslation()(containerWithHooks);
