import * as React from "react";
import {
    FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP,
    ISAMLSSOSettings,
    SSOProvider,
    resolveSSOProviderName
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { PaneSection, TabPane } from "../components";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import { omit, pick, sortBy } from "ramda";
import Button from "@binders/ui-kit/lib/elements/button";
import FileSelector from "@binders/ui-kit/lib/elements/fileselector";
import { FlashMessages } from "../../../logging/FlashMessages";
import { IADGroupMapping } from "@binders/client/lib/clients/model";
import Input from "@binders/ui-kit/lib/elements/input";
import { SSOProviderPicker } from "./SSOProviderPicker";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import { Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import autobind from "class-autobind";
import cx from "classnames";
import { isAfter } from "date-fns";
import { setSSOSettings } from "../../actions";
import { useIsAccountFeatureActive } from "../../hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "../accountsettings.styl";
import "./SSOConfiguration.styl";

interface SSOConfigurationProps {
    mappedGroups: IADGroupMapping[];
    t: TFunction;
    accountId: string;
    settings: ISAMLSSOSettings;
    usergroups: Usergroup[];
    isDirty: boolean;
    setIsDirty: (value: boolean) => void;
    // provided by withHooks
    isUserManagementViaEntraIdGroupActive: boolean;
}

interface SSOConfigurationState {
    isSSOEnabled: boolean;
    provider: SSOProvider | undefined;
    tenantId: string;
    entryPoint: string;
    issuer: string;
    certificateName: string;
    logout: string;
    ssoButtonText: string;
    ADGroups: Record<string, string>;
    certificateFile: File | null;
    validation: Record<string, string>;
    autoRedirect: boolean;
    enterpriseApplicationId: string;
    enterpriseApplicationGroupReadSecret: string;
    certificateExpirationDate?: Date;
    userGroupIdForUserManagement: string;
    isSaving: boolean;
    focusedInput: string | null;
}

class SSOConfiguration extends React.Component<SSOConfigurationProps, SSOConfigurationState> {

    private readonly tooltips: Record<string, Tooltip>;
    private readonly inputRefs: Record<string, HTMLElement>;

    constructor(props: SSOConfigurationProps) {
        super(props);
        this.state = {
            ...this.propsToSSOConfigState(props),
            certificateFile: null,
            certificateExpirationDate: props.settings?.certificateExpirationDate,
            validation: {},
            isSaving: false,
            focusedInput: null,
        };
        this.tooltips = {
            ID: null,
            issuer: null,
            entryPoint: null,
            certificate: null,
            logout: null,
            ssoButtonText: null,
            ssoDisableLocalUsers: null,
            enterpriseApplicationId: null,
            enterpriseApplicationGroupReadSecret: null,
            userGroupIdForUserManagement: null,
        };
        this.inputRefs = {};
        autobind(this);
    }

    propsToSSOConfigState(props: SSOConfigurationProps) {
        return {
            isSSOEnabled: props.settings?.enabled,
            provider: props.settings?.provider,
            tenantId: props.settings?.tenantId,
            entryPoint: props.settings?.entryPoint,
            issuer: props.settings?.issuer,
            certificateName: props.settings?.certificateName,
            logout: props.settings?.logout,
            ssoButtonText: props.settings?.ssoButtonText,
            ADGroups: this.prepareGroups(props),
            autoRedirect: props.settings?.autoRedirect,
            enterpriseApplicationId: props.settings?.enterpriseApplicationId,
            enterpriseApplicationGroupReadSecret: props.settings?.enterpriseApplicationGroupReadSecret,
            userGroupIdForUserManagement: props.settings?.userGroupIdForUserManagement,
        }
    }

    componentDidUpdate(prevProps: Readonly<SSOConfigurationProps>, _prevState: Readonly<SSOConfigurationState>) {
        if (this.props.settings?.certificateExpirationDate !== prevProps.settings?.certificateExpirationDate) {
            this.setState({
                certificateExpirationDate: this.props.settings?.certificateExpirationDate,
            });
        }
        if (this.stringifyProps(this.props) === this.stringifyState(this.state)) {
            if (this.props.isDirty) {
                this.props.setIsDirty(false);
            }
        } else {
            if (!this.props.isDirty) {
                this.props.setIsDirty(true);
                setTimeout(() => {
                    if (this.state.focusedInput) {
                        this.inputRefs[this.state.focusedInput]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                    }
                }, 250);
            }
        }
    }

    stringifyProps(props: SSOConfigurationProps) {
        return JSON.stringify(this.propsToSSOConfigState(props));
    }

    stringifyState(state: SSOConfigurationState) {
        const ssoConfig = {
            ...omit([
                "certificateExpirationDate",
                "certificateFile",
                "focusedInput",
                "hasUnsavedChanges",
                "isSaving",
                "validation",
            ],
            state) };
        const orderedADGroupPairs = Object.entries(ssoConfig.ADGroups)
            .filter(pair => pair[1])
            .sort((left, right) => left[0].localeCompare(right[0]));
        ssoConfig.ADGroups = Object.fromEntries(orderedADGroupPairs);
        return JSON.stringify(ssoConfig);
    }

    prepareGroups(props: SSOConfigurationProps) {
        return sortBy(e => e.groupId, props.mappedGroups)
            .reduce((collector, { groupId, ADGroupId }) => {
                collector[groupId] = ADGroupId;
                return collector;
            }, {} as Record<string, string>);
    }

    toggleSSOConfig() {
        this.setState({
            isSSOEnabled: !this.state.isSSOEnabled,
            validation: {},
        });
    }

    onProviderChange(provider: SSOProvider) {
        this.setState({
            provider,
            validation: {},
            tenantId: null,
            entryPoint: null,
            issuer: null,
            certificateName: null,
            certificateFile: null,
            logout: null,
            ssoButtonText: null,
            ADGroups: {},
            autoRedirect: false,
            enterpriseApplicationId: null,
            enterpriseApplicationGroupReadSecret: null,
            certificateExpirationDate: null,
            userGroupIdForUserManagement: null,
        })
    }

    toggleAutoRedirect() {
        this.setState({
            focusedInput: null,
            autoRedirect: !this.state.autoRedirect
        })
    }

    onTenantIdChange(e) {
        this.setState({
            tenantId: e,
            validation: {},
        });
    }
    onEntryPointChange(e) {
        this.setState({
            entryPoint: e,
            validation: {},
        });
    }
    onIssuerChange(e) {
        this.setState({
            issuer: e,
            validation: {},
        });
    }

    onLogoutChange(e) {
        this.setState({
            logout: e,
            validation: {}
        });
    }

    onCertificateUpload(files) {
        this.setState({
            focusedInput: null,
            certificateFile: files[0],
            certificateName: files[0].name,
            validation: {},
        });
    }

    onEnterpriseApplicationIdChange(e) {
        this.setState({
            enterpriseApplicationId: e?.trim(),
            validation: {}
        });
    }

    onAdGroupChange(id: string) {
        return (value: string) => this.setState({
            ADGroups: { ...this.state.ADGroups, [id]: value }
        });
    }
    validateForm(): Record<string, string> {
        if (!this.state.isSSOEnabled) {
            return {};
        }
        const significantValues = {
            ...pick(["certificateName", "tenantId", "entryPoint", "issuer"], this.state),
            ...(this.props.isUserManagementViaEntraIdGroupActive && this.state.provider !== SSOProvider.OKTA ?
                {
                    userGroupIdForUserManagement: this.state.userGroupIdForUserManagement,
                    enterpriseApplicationGroupReadSecret: this.state.enterpriseApplicationGroupReadSecret,
                } :
                {}),
        };

        return Object.keys(significantValues).reduce((prev, value) => {
            return significantValues[value]?.length > 0 ? prev : { ...prev, [value]: this.props.t(TK.Account_SsoFormNonEmptyVal) }
        }, {});
    }

    cancelChanges() {
        const props = this.props;
        this.setState({
            isSSOEnabled: props.settings?.enabled,
            provider: props.settings?.provider,
            tenantId: props.settings?.tenantId,
            entryPoint: props.settings?.entryPoint,
            issuer: props.settings?.issuer,
            certificateName: props.settings?.certificateName,
            logout: props.settings?.logout,
            ssoButtonText: props.settings?.ssoButtonText,
            ADGroups: this.prepareGroups(props),
            certificateFile: null,
            validation: {},
            autoRedirect: props.settings?.autoRedirect,
            enterpriseApplicationId: props.settings?.enterpriseApplicationId,
            enterpriseApplicationGroupReadSecret: props.settings?.enterpriseApplicationGroupReadSecret,
            certificateExpirationDate: props.settings?.certificateExpirationDate,
            userGroupIdForUserManagement: props.settings?.userGroupIdForUserManagement,
        });
    }

    saveChanges() {
        const formValidation = this.validateForm();
        const { accountId, settings, t } = this.props;
        if (Object.keys(formValidation).length === 0) {
            this.setState({ isSaving: true });
            setSSOSettings(accountId, {
                oldTenantId: settings ? settings.tenantId : undefined,
                tenantId: this.state.tenantId,
                enabled: this.state.isSSOEnabled,
                provider: this.state.provider,
                certificate: this.state.certificateFile,
                issuer: this.state.issuer,
                entryPoint: this.state.entryPoint,
                certificateName: this.state.certificateName,
                ADGroups: this.state.ADGroups,
                logout: this.state.logout,
                ssoButtonText: this.state.ssoButtonText,
                autoRedirect: this.state.autoRedirect,
                enterpriseApplicationId: this.state.enterpriseApplicationId,
                enterpriseApplicationGroupReadSecret: this.state.enterpriseApplicationGroupReadSecret,
                userGroupIdForUserManagement: this.state.userGroupIdForUserManagement,
            })
                .then(() => {
                    this.setState({ certificateFile: null });
                    FlashMessages.success(t(TK.Account_SsoFormSaved));
                })
                .catch((ex) => FlashMessages.error(ex, true))
                .then(() => this.setState({ isSaving: false }));
        } else {
            this.setState({ validation: formValidation });
            FlashMessages.error(t(TK.Account_SsoFormInvalid), true);
        }
    }

    hideTooltip(id: string) {
        return e => hideTooltip(e, this.tooltips[id]);
    }

    showTooltip(position: TooltipPosition, id: string) {
        return e => {
            showTooltip(e, this.tooltips[id], position);
        };
    }

    handleFocus(id: string) {
        this.setState({ focusedInput: id });
    }

    renderUserGroups(usergroups: Usergroup[]) {
        const placeholder = this.props.t(this.state.provider === SSOProvider.OKTA ? TK.Account_SsoGroupName : TK.Account_SsoGroupId);
        return usergroups.map(
            (usergroup) => (
                <div className="media-settings-paper-section-row bordered" key={usergroup.id} >
                    <label className="media-settings-paper-section-inputLabel">{usergroup.name}</label>
                    <Input
                        type="text"
                        name={usergroup.name}
                        placeholder={placeholder}
                        value={this.state.ADGroups[usergroup.id] ?? ""}
                        isValid={true}
                        onChange={this.onAdGroupChange(usergroup.id)}
                        useState={false}
                        setRef={(el) => { this.inputRefs[usergroup.id] = el }}
                        onFocus={() => this.handleFocus(usergroup.id)}
                    />
                </div>
            )
        )
    }

    renderSSOConfig() {
        const { usergroups, t } = this.props;
        const useOkta = this.state.provider === SSOProvider.OKTA;
        const providerName = resolveSSOProviderName(this.state.provider);
        const loginTextPlaceholder = t(TK.Login_WithProvider, { providerName });
        return (
            <>
                <PaneSection label={t(TK.Account_SsoProvider)}>
                    <SSOProviderPicker
                        isSaving={this.state.isSaving}
                        provider={this.state.provider ?? SSOProvider.ENTRA_ID}
                        setProvider={this.onProviderChange}
                    />
                </PaneSection>
                <PaneSection label={t(TK.Account_SsoTitle, { providerName })}>
                    <div className="media-settings-paper-section sso-settings">
                        <Tooltip ref={ref => { this.tooltips["ID"] = ref; }} message={t(useOkta ? TK.Account_SsoIssuerIdTooltip : TK.Account_SsoAdTenantIdTooltip)} />
                        <div className="media-settings-paper-section-row" onMouseEnter={this.showTooltip(TooltipPosition.TOP, "ID")} onMouseLeave={this.hideTooltip("ID")}>
                            <label className="media-settings-paper-section-inputLabel">{t(useOkta ? TK.Account_SsoIssuerId : TK.Account_SsoAdTenantId)}</label>
                            <Input
                                type="text"
                                name="ID"
                                placeholder={t(useOkta ? TK.Account_SsoIssuerId : TK.Account_SsoAdTenantIdPlaceholder)}
                                value={this.state.tenantId}
                                isValid={true}
                                onChange={this.onTenantIdChange}
                                useState={false}
                                setRef={(el) => { this.inputRefs["ID"] = el }}
                                onFocus={() => this.handleFocus("ID")}
                            />
                            {
                                this.state.validation["tenantId"] &&
                                <span className="media-settings-paper-section-inputValidation">
                                    {this.state.validation["tenantId"]}
                                </span>
                            }
                        </div>
                        <Tooltip ref={ref => { this.tooltips["entryPoint"] = ref; }} message={t(TK.Account_SsoEntryTooltip, { providerName })} />
                        <div className="media-settings-paper-section-row" onMouseEnter={this.showTooltip(TooltipPosition.TOP, "entryPoint")} onMouseLeave={this.hideTooltip("entryPoint")}>
                            <label className="media-settings-paper-section-inputLabel">{t(TK.Account_SsoAdEntry)}</label>
                            <Input
                                type="text"
                                name="entryPoint"
                                placeholder={t(TK.Account_SsoAdEntryPlaceholder)}
                                value={this.state.entryPoint}
                                isValid={true}
                                onChange={this.onEntryPointChange}
                                useState={false}
                                setRef={(el) => { this.inputRefs["entryPoint"] = el }}
                                onFocus={() => this.handleFocus("entryPoint")}
                            />
                            {
                                this.state.validation["entryPoint"] &&
                                <span className="media-settings-paper-section-inputValidation">
                                    {this.state.validation["entryPoint"]}
                                </span>
                            }
                        </div>
                        <Tooltip ref={ref => { this.tooltips["issuer"] = ref; }} message={t(useOkta ? TK.Account_SsoApplicationTooltipOkta : TK.Account_SsoApplicationTooltipEntraId)} />
                        <div className="media-settings-paper-section-row" onMouseEnter={this.showTooltip(TooltipPosition.TOP, "issuer")} onMouseLeave={this.hideTooltip("issuer")}>
                            <label className="media-settings-paper-section-inputLabel">{t(TK.Account_SsoAdApplication)}</label>
                            <Input
                                type="text"
                                name="issuer"
                                placeholder={t(useOkta ? TK.Account_SsoApplicationNamePlaceholder : TK.Account_SsoAdApplicationPlaceholder)}
                                value={this.state.issuer}
                                isValid={true}
                                onChange={this.onIssuerChange}
                                useState={false}
                                setRef={(el) => { this.inputRefs["issuer"] = el }}
                                onFocus={() => this.handleFocus("issuer")}
                            />
                            {
                                this.state.validation["issuer"] &&
                                <span className="media-settings-paper-section-inputValidation">
                                    {this.state.validation["issuer"]}
                                </span>
                            }
                        </div>
                        <Tooltip ref={ref => { this.tooltips["certificate"] = ref; }} message={t(TK.Account_SsoUploadCertif_Tooltip, { providerName })} />
                        <div className="media-settings-paper-section-row" onMouseEnter={this.showTooltip(TooltipPosition.TOP, "certificate")} onMouseLeave={this.hideTooltip("certificate")}>
                            <div className="sso-settings-certificate">
                                <FileSelector
                                    name="public_certificate"
                                    onChange={this.onCertificateUpload}
                                    multiple={false}
                                    buttonText={t(TK.Account_SsoUploadCertif)}
                                    accept={[".cer", ".cert"]}
                                    label={this.state.certificateName}
                                />
                                {
                                    this.renderExpirationDate()
                                }
                                {
                                    this.state.validation["certificateName"] &&
                                    <div className="media-settings-paper-section-inputValidation">
                                        {this.state.validation["certificateName"]}
                                    </div>
                                }
                            </div>
                        </div>
                        <div className="media-settings-paper-section-row" onMouseEnter={this.showTooltip(TooltipPosition.TOP, "logout")} onMouseLeave={this.hideTooltip("logout")}>
                            <label className="media-settings-paper-section-inputLabel">{t(TK.General_Logout)}</label>
                            <Input
                                type="text"
                                name="logout"
                                placeholder={t(TK.Account_SsoAdLogoutPlaceholder)}
                                value={this.state.logout}
                                isValid={true}
                                onChange={this.onLogoutChange}
                                useState={false}
                                setRef={(el) => { this.inputRefs["logout"] = el }}
                                onFocus={() => this.handleFocus("logout")}
                            />
                            {
                                this.state.validation["logout"] &&
                                <span className="media-settings-paper-section-inputValidation">
                                    {this.state.validation["logout"]}
                                </span>
                            }
                        </div>
                        <Tooltip
                            ref={ref => { this.tooltips["ssoButtonText"] = ref; }}
                            message={t(TK.Account_SsoButtonTextTooltip, { defaultText: loginTextPlaceholder })}
                        />
                        <div
                            className="media-settings-paper-section-row"
                            onMouseEnter={this.showTooltip(TooltipPosition.TOP, "ssoButtonText")}
                            onMouseLeave={this.hideTooltip("ssoButtonText")}
                        >
                            <label
                                className="media-settings-paper-section-inputLabel"
                            >
                                {t(TK.Account_SsoButtonTextLabel)}
                            </label>
                            <Input
                                type="text"
                                name="ssoButtonText"
                                placeholder={loginTextPlaceholder}
                                value={this.state.ssoButtonText || ""}
                                isValid={true}
                                onChange={v => this.setState({
                                    ssoButtonText: v,
                                    validation: {}
                                })}
                                useState={false}
                                setRef={(el) => { this.inputRefs["ssoButtonText"] = el }}
                                onFocus={() => this.handleFocus("ssoButtonText")}
                            />
                        </div>
                        <Tooltip
                            ref={ref => { this.tooltips["ssoDisableLocalUsers"] = ref; }}
                            message={t(TK.Account_SsoAutoRedirect_Tooltip)}
                        />
                        <div
                            className="media-settings-paper-section-row"
                            onMouseEnter={this.showTooltip(TooltipPosition.TOP, "ssoDisableLocalUsers")}
                            onMouseLeave={this.hideTooltip("ssoDisableLocalUsers")}
                        >
                            <label
                                className="media-settings-paper-section-inputLabel"
                            >
                                {t(TK.Account_SsoAutoRedirect)}
                            </label>
                            <Toggle
                                isToggled={this.state.autoRedirect}
                                onToggle={this.toggleAutoRedirect}
                            />
                        </div>
                        {this.renderEnterpriseApplicationSettings()}
                    </div>
                </PaneSection>
                {this.props.isUserManagementViaEntraIdGroupActive && !useOkta && (
                    <PaneSection label={t(TK.Account_SsoUserMgmtThroughGroup)}>
                        <div className="media-settings-paper-section">
                            <Tooltip ref={ref => { this.tooltips["userGroupIdForUserManagement"] = ref; }} message={t(TK.Account_SsoUserMgmtThroughGroup_GroupID_Tooltip)} />
                            <div
                                className="media-settings-paper-section-row bordered"
                                onMouseEnter={this.showTooltip(TooltipPosition.TOP, "userGroupIdForUserManagement")}
                                onMouseLeave={this.hideTooltip("userGroupIdForUserManagement")}
                            >
                                <label className="media-settings-paper-section-inputLabel">{t(TK.Account_SsoUserMgmtThroughGroup_GroupID)}</label>
                                <Input
                                    type="text"
                                    name="userGroupIdForUserManagement"
                                    placeholder={t(TK.Account_SsoUserMgmtThroughGroup_GroupID)}
                                    value={this.state.userGroupIdForUserManagement ?? ""}
                                    isValid={true}
                                    onChange={v => {
                                        this.setState({
                                            userGroupIdForUserManagement: v?.trim(),
                                            validation: {}
                                        });
                                    }}
                                    useState={false}
                                    setRef={(el) => { this.inputRefs["userGroupIdForUserManagement"] = el }}
                                    onFocus={() => this.handleFocus("userGroupIdForUserManagement")}
                                />
                                {
                                    this.state.validation["userGroupIdForUserManagement"] &&
                                    <span className="media-settings-paper-section-inputValidation">
                                        {this.state.validation["userGroupIdForUserManagement"]}
                                    </span>
                                }
                            </div>
                        </div>
                    </PaneSection>
                )}
                <PaneSection label={t(TK.Account_SsoGroupMapping)} isVerticalAlignHack={true}>
                    <div className="media-settings-paper-section">
                        {
                            usergroups.length > 0 &&
                            this.renderUserGroups(usergroups)
                        }
                    </div>
                </PaneSection>
            </>
        )
    }

    renderEnterpriseApplicationSettings() {
        const { t } = this.props;
        return this.state.provider === SSOProvider.OKTA ?
            null :
            <>
                <Tooltip ref={ref => { this.tooltips["enterpriseApplicationId"] = ref; }} message={t(TK.Account_SsoEnterpriseApplicationIdTooltip)} />
                <div
                    className="media-settings-paper-section-row"
                    onMouseEnter={this.showTooltip(TooltipPosition.TOP, "enterpriseApplicationId")}
                    onMouseLeave={this.hideTooltip("enterpriseApplicationId")}
                >
                    <label
                        className="media-settings-paper-section-inputLabel"
                    >
                        {t(TK.Account_SsoEnterpriseApplicationId)}
                    </label>
                    <Input
                        type="text"
                        name="enterpriseApplicationId"
                        placeholder={t(TK.Account_SsoEnterpriseApplicationIdPlaceholder)}
                        value={this.state.enterpriseApplicationId ?? ""}
                        isValid={true}
                        onChange={this.onEnterpriseApplicationIdChange}
                        useState={false}
                        setRef={(el) => { this.inputRefs["enterpriseApplicationId"] = el }}
                        onFocus={() => this.handleFocus("enterpriseApplicationId")}
                    />
                </div>
                <Tooltip ref={ref => { this.tooltips["enterpriseApplicationGroupReadSecret"] = ref; }} message={t(TK.Account_SsoEnterpriseApplicationGroupReadSecretTooltip)} />
                <div
                    className="media-settings-paper-section-row"
                    onMouseEnter={this.showTooltip(TooltipPosition.TOP, "enterpriseApplicationGroupReadSecret")}
                    onMouseLeave={this.hideTooltip("enterpriseApplicationGroupReadSecret")}
                >
                    <label
                        className="media-settings-paper-section-inputLabel"
                    >
                        {t(TK.Account_SsoEnterpriseApplicationGroupReadSecret)}
                    </label>
                    <Input
                        type="text"
                        name="enterpriseApplicationGroupReadSecret"
                        placeholder={t(TK.Account_SsoEnterpriseApplicationGroupReadSecretPlaceholder)}
                        value={this.state.enterpriseApplicationGroupReadSecret ?? ""}
                        isValid={true}
                        onChange={v => this.setState({
                            enterpriseApplicationGroupReadSecret: v?.trim(),
                            validation: {}
                        })}
                        useState={false}
                        setRef={(el) => { this.inputRefs["enterpriseApplicationGroupReadSecret"] = el }}
                        onFocus={() => this.handleFocus("enterpriseApplicationGroupReadSecret")}
                    />
                    {
                        this.state.validation["enterpriseApplicationGroupReadSecret"] &&
                        <span className="media-settings-paper-section-inputValidation">
                            {this.state.validation["enterpriseApplicationGroupReadSecret"]}
                        </span>
                    }
                </div>
            </>
    }

    renderExpirationDate() {
        if (!this.state.certificateExpirationDate || this.props.settings?.certificateName !== this.state.certificateName) {
            return <div/>;
        }
        const { t } = this.props;
        const expiryDate = this.state.certificateExpirationDate.toDateString();
        if (isAfter(new Date(), this.state.certificateExpirationDate)) {
            return (
                <div className="sso-settings-certificate-expiry sso-settings-certificate-expired">
                    {t(TK.Account_SsoCertificateExpired, { expiryDate })}
                </div>
            )
        } else {
            return (
                <div className="sso-settings-certificate-expiry">
                    {t(TK.Account_SsoCertificateExpires, { expiryDate })}
                </div>
            )
        }
    }

    render() {
        const { t } = this.props;
        const footerVisible = this.props.isDirty || this.state.isSaving;
        return (
            <div className={cx("sso-configuration", { "sso-configuration--footer-visible": footerVisible })}>
                <TabPane>
                    <PaneSection label={t(TK.Account_PrefsSectionSso)}>
                        <div className="row gap-md">
                            <Toggle
                                isToggled={this.state.isSSOEnabled}
                                onToggle={this.toggleSSOConfig}
                            />
                            <label className="media-settings-setting-subtitle">{t(TK.Account_SsoEnable)}</label>
                        </div>
                    </PaneSection>

                    {this.state.isSSOEnabled && this.renderSSOConfig()}
                </TabPane>
                <div className={cx(
                    "sso-configuration-footer",
                    { "sso-configuration-footer--visible": footerVisible }
                )}>
                    {!this.state.isSaving && <Button
                        text={t(TK.General_Cancel)}
                        secondary
                        onClick={this.cancelChanges}
                    />}
                    <Button
                        className={"save-btn"}
                        text={this.state.isSaving ? t(TK.Edit_SaveInProgress) : t(TK.General_Save)}
                        CTA
                        onClick={this.saveChanges}
                        inactiveWithLoader={this.state.isSaving}
                        isEnabled={!this.state.isSaving}
                    />
                </div>
            </div>
        )
    }
}

export default withTranslation()(withHooks(SSOConfiguration, () => ({
    isUserManagementViaEntraIdGroupActive: useIsAccountFeatureActive(FEATURE_MANUALTO_USER_MANAGEMENT_VIA_ENTRA_ID_GROUP),
})));
