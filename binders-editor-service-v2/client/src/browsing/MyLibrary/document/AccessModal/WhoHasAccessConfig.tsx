import * as React from "react";
import AccessBox, { IAccessDataAssignee } from "../../../../shared/access-box";
import {
    IAclRestrictionSet,
    Role
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AccountLicensing } from "@binders/client/lib/clients/accountservice/v1/contract";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import DonutLargeIcon from "@binders/ui-kit/lib/elements/icons/DonutLarge";
import { FlashMessages } from "../../../../logging/FlashMessages";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { MaxPublicCountStats } from "./MaxPublicCountStats";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { UseQueryResult } from "@tanstack/react-query";
import { usePublicDocumentCount } from "../../../../documents/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import { withTranslation } from "@binders/client/lib/react/i18n";

export interface WhoHasAccessConfigProps {
    allData: Array<IAccessDataAssignee>;
    onChangeAccess: (assigneeId: string, oldAclId: string, newRoleName: string, newAclRestrictionSet: IAclRestrictionSet) => void;
    onItemRemove: (assignee: IAccessDataAssignee, isHardRemoval?: boolean) => void;
    onNewItemAdd: (aclItems: IAutocompleteItem[], roleName: string, aclRestrictionSet: IAclRestrictionSet) => void;
    licensing: AccountLicensing;
    t?: TFunction;
    featuresPublicContent: boolean;
    featuresTranslatorRole: boolean;
    featuresDialects: boolean;
    isPublic: boolean;
    isPublicTogglesLoading: boolean;
    onToggleItemPublic: () => void;
    setShowInOverview: () => void;
    showInOverview: boolean;
    isPublicToggleActive: boolean;
    accountId: string;
    accountRoles: Role[];
    onAccessBoxValidationErrorsUpdate?: (errors: string[]) => void;

    // Injected through withHooks()
    publicDocumentCount?: UseQueryResult<number>;
}

interface WhoHasAccessState {
    accessBoxValidationErrors: string[];
}

class WhoHasAccessConfig extends React.Component<WhoHasAccessConfigProps, WhoHasAccessState> {

    constructor(props: WhoHasAccessConfigProps) {
        super(props)

        this.onChangeRoleInTable = this.onChangeRoleInTable.bind(this);
        this.onNewUsersAdd = this.onNewUsersAdd.bind(this);
        this.onDeleteItem = this.onDeleteItem.bind(this);
        this.renderToggleOptions = this.renderToggleOptions.bind(this);
        this.renderPublicToggles = this.renderPublicToggles.bind(this);
        this.state = {
            accessBoxValidationErrors: [],
        };
    }

    onChangeRoleInTable(assignee: IAccessDataAssignee, newRoleName: string, newAclRestrictionSet: IAclRestrictionSet) {
        const item = this.props.allData.find(a => !a.isInheritedAcl && (a.value === assignee.value));
        if (item) {
            this.props.onChangeAccess(item.id, item.aclId, newRoleName, newAclRestrictionSet);
        } else {
            this.onNewUsersAdd(
                [
                    {
                        id: assignee.id,
                        label: assignee.label,
                        rawLabel: assignee.label,
                        value: assignee.value
                    }
                ],
                newRoleName,
                newAclRestrictionSet
            );
        }
    }

    onDeleteItem(itemId) {
        const assignees = this.props.allData.filter(({ id }) => itemId === id);
        let adhocAcls = [];
        if (assignees.length > 1) {
            const inheritedAcls = assignees.filter(({ isInheritedAcl }) => isInheritedAcl);
            adhocAcls = assignees.filter(({ isInheritedAcl }) => !isInheritedAcl);
            if (inheritedAcls.length > 0) {
                this.props.onItemRemove(adhocAcls[0], false);
            }
        } else {
            adhocAcls = assignees;
            if (adhocAcls[0]) {
                this.props.onItemRemove(adhocAcls[0], true);
            }
        }
    }

    onNewUsersAdd(items: IAutocompleteItem[], roleName: string, aclRestrictionSet?: IAclRestrictionSet) {
        this.props.onNewItemAdd(items, roleName, aclRestrictionSet);
    }

    renderMaxPublicCountWarning() {
        const { licensing, t, publicDocumentCount } = this.props;
        const { maxPublicCount } = licensing;
        const isExceedingLimit = publicDocumentCount.data >= maxPublicCount;
        const maxPublicCountIsNotSet = maxPublicCount === null;
        const shouldRenderWarning = isExceedingLimit && !maxPublicCountIsNotSet;

        return !shouldRenderWarning ?
            <div /> :
            (
                <div className="max-public-count-warning">
                    <span>
                        {t(
                            TK.Account_WarningExceedingLimit,
                            {
                                publicDocumentCount: publicDocumentCount?.data,
                                maxPublicCount
                            }
                        )}
                    </span>
                </div>
            );

    }

    renderToggleOptions() {
        const { featuresPublicContent, isPublicTogglesLoading } = this.props;
        return featuresPublicContent && (
            <div className="user-access-toggles-container">
                <div className="user-access-toggles">
                    <div className="toggles-list">
                        {this.renderPublicToggles()}
                    </div>
                    {isPublicTogglesLoading && <div className="toggles-loading"><DonutLargeIcon /></div>}
                </div>
                <MaxPublicCountStats />
            </div>
        );
    }

    renderPublicToggles() {
        const {
            isPublic,
            isPublicToggleActive,
            isPublicTogglesLoading,
            onToggleItemPublic,
            setShowInOverview,
            showInOverview,
            t,
        } = this.props;
        return [
            <div className={`toggle-option ${!isPublicToggleActive && "is-disabled"}`} key="pub">
                <Checkbox
                    onCheck={onToggleItemPublic}
                    checked={isPublic}
                    label={t(TK.Acl_AccessModalIsPublic)}
                    disabled={!isPublicToggleActive || isPublicTogglesLoading}
                />
            </div>,
            isPublic ?
                (
                    <div className="toggle-option" key="adv">
                        <Checkbox
                            onCheck={setShowInOverview}
                            checked={showInOverview}
                            disabled={isPublicTogglesLoading}
                            label={t(TK.Acl_AccessModalShowLanding)}
                        />
                    </div>
                ) :
                null
        ];
    }

    render() {
        const { accountRoles, t, featuresTranslatorRole, featuresDialects } = this.props;
        return (
            <>
                {this.renderToggleOptions()}
                {this.renderMaxPublicCountWarning()}
                <AccessBox
                    accountRoles={accountRoles}
                    onError={FlashMessages.error}
                    changeRoleInTable={this.onChangeRoleInTable}
                    onNewUsersAdd={this.onNewUsersAdd}
                    onDeleteItem={this.onDeleteItem}
                    tableData={this.props.allData}
                    searchTitle={t(TK.Acl_WhoHasAccess)}
                    includeTranslatorPseudoRole={featuresTranslatorRole}
                    onValidationErrorsUpdate={this.props.onAccessBoxValidationErrorsUpdate}
                    featuresDialects={featuresDialects}
                />
            </>
        );
    }
}

const whoHasAccessConfigWithHooks = withHooks(WhoHasAccessConfig, () => ({
    publicDocumentCount: usePublicDocumentCount()
}));
export default withTranslation()(whoHasAccessConfigWithHooks);
