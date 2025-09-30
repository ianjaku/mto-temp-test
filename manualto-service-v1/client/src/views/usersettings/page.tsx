import * as React from "react";
import { AccountFeatures, IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { User, UserPreferences } from "@binders/client/lib/clients/userservice/v1/contract";
import { getInterfaceLanguage, switchInterfaceLanguage } from "@binders/client/lib/i18n";
import { updateReaderLanguages, updateUserPreferences } from "../../stores/actions/user";
import {
    useActiveAccountFeatures,
    useActiveAccountId,
    useActiveAccountSettings,
} from "../../stores/hooks/account-hooks";
import { useCurrentUser, useCurrentUserPreferences } from "../../stores/hooks/user-hooks";
import { Div100Vh } from "../../utils/div100vh";
import Loader from "../components/loader";
import NavigationBar from "./navigation";
import ReaderHeader from "../header/header";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { loadAmIEditorElsewhere } from "../../stores/actions/account";
import { loadReaderItems } from "../../binders/binder-loader";
import { updateUserPreferences as remoteUpdateUserPreferences } from "../../binders/loader";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./page.styl";

class UserSettingsPage extends React.Component<{
    accountId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: any;
    user?: User | null;
    accountFeatures?: AccountFeatures | null;
    accountSettings?: IAccountSettings | null;
    userPreferences?: UserPreferences | null,
    t: TFunction;
}> {

    constructor(props) {
        super(props);
        this.updateReaderLanguages = this.updateReaderLanguages.bind(this);
        this.updateInterfaceLanguage = this.updateInterfaceLanguage.bind(this);
        this.clearUserInterfaceLanguage = this.clearUserInterfaceLanguage.bind(this);
    }

    componentDidMount() {
        const userId = this.props.user?.id;
        const accountId = this.props.accountId;
        if (userId == null || accountId == null) return;
        loadAmIEditorElsewhere(accountId, userId);
    }

    updateReaderLanguages(readerLanguages) {
        if (this.props.user?.id) {
            const userId = this.props.user?.id;
            remoteUpdateUserPreferences(userId, { readerLanguages });
        }
        updateReaderLanguages(readerLanguages);
        loadReaderItems(readerLanguages);
    }

    updateInterfaceLanguage(interfaceLanguage) {
        if (this.props.user?.id) {
            const userId = this.props.user?.id;
            remoteUpdateUserPreferences(userId, { interfaceLanguage });
        }
        updateUserPreferences({ interfaceLanguage });
        switchInterfaceLanguage(interfaceLanguage);
    }

    clearUserInterfaceLanguage() {
        const { accountSettings, accountFeatures } = this.props;
        if (this.props.user?.id) {
            const userId = this.props.user?.id;
            remoteUpdateUserPreferences(userId, { interfaceLanguage: "" });
        }
        updateUserPreferences({ interfaceLanguage: "" });
        const interfaceLanguage = getInterfaceLanguage(
            accountFeatures,
            accountSettings,
            { userId: undefined, defaultAnalyticsRange: undefined, interfaceLanguage: undefined },
        );
        switchInterfaceLanguage(interfaceLanguage);
    }

    renderContent() {
        const {
            accountFeatures,
            accountId,
            children,
            user,
            userPreferences: { readerLanguages, interfaceLanguage } = {},
        } = this.props;
        if (!user) return null;
        const content = children && React.Children.map(children, child => React.cloneElement(child as React.ReactElement, {
            onUpdateReaderLanguages: this.updateReaderLanguages.bind(this),
            onUpdateInterfaceLanguage: this.updateInterfaceLanguage.bind(this),
            onClearUserInterfaceLanguage: this.clearUserInterfaceLanguage.bind(this),
            readerLanguages,
            interfaceLanguage,
            accountFeatures,
            userDetails: user,
            accountId: accountId,
        }));
        return (
            <div className="content-pane">
                {content}
            </div>
        );
    }

    render() {
        const { userPreferences, accountId, user, accountFeatures, router, t } = this.props;
        return !userPreferences ?
            <Loader text={t(TranslationKeys.User_LoadingSettings)} /> :
            (
                <Div100Vh className="story-browser-layout" asMinHeight={false}>
                    <ReaderHeader
                        logo={window.bindersBranding.logo}
                        router={router}
                        accountId={accountId}
                        userId={user?.id}
                    />
                    <div className="content-page">
                        <div className="navigation-bar">
                            <NavigationBar collapsed={false} router={router} accountFeatures={accountFeatures} />
                        </div>
                        {this.renderContent()}
                    </div>
                </Div100Vh>
            );
    }
}

const UserSettingsPageWithHooks = withHooks(UserSettingsPage, () => ({
    accountFeatures: useActiveAccountFeatures(),
    accountSettings: useActiveAccountSettings(),
    user: useCurrentUser(),
    userPreferences: useCurrentUserPreferences(),
    accountId: useActiveAccountId(),
}))

export default withTranslation()(UserSettingsPageWithHooks);
