import * as React from "react";
import {
    AssigneeType,
    IAclRestrictionSet,
    Role,
    TRANSLATOR_PSEUDO_NAME
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import Dropdown, { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";
import { SectionCollapsedHeight, maybeAnimateSection, sectionIsExpanded } from "./helpers";
import {
    buildUIRoles,
    convertToUiAssignee,
    maybeNormalizePseudoRole,
    validateUserInput
} from "./RoleInput/helpers";
import { getAllLanguageCodes, toLanguageLabel } from "@binders/client/lib/languages/helper";
import { AbsolutePositioningContext, } from "../Layout/absolutePositioningContext";
import AccessSearchBar from "./AccessSearchBar";
import AddBtn from "./AddBtn";
import ArrowBtn from "./ArrowBtn";
import CloseButton from "@binders/ui-kit/lib/elements/button/Close";
import FilterableDropdown from "@binders/ui-kit/lib/elements/dropdown/FilterableDropdown";
import GroupIcon from "@binders/ui-kit/lib/elements/icons/Group";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import { UIRole } from "./RoleInput";
import UserInput from "../user-input/UserInput";
import autobind from "class-autobind";
import {
    buildRoleTranslationKey
} from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import cx from "classnames";
import debounce from "lodash.debounce";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { scorePermission } from "@binders/client/lib/clients/authorizationservice/v1/util";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./accessBox.styl";


enum AccessBoxSection {
    ExistingAcls = "ExistingAcls",
    NewAcls = "NewAcls",
}
const accessBoxSections = [AccessBoxSection.ExistingAcls, AccessBoxSection.NewAcls];

export interface IAccessDataAssignee {
    aclId: string;
    label: string;
    id: string;
    isInheritedAcl: boolean;
    roleName: string;
    uiRoleName: string;
    type: AssigneeType;
    value: string;
    aclRestrictionSet?: IAclRestrictionSet;
    aclKey: string;
}

export interface IAccessBoxProps {
    accountRoles: Role[];
    tableData: IAccessDataAssignee[];
    searchTitle: string;
    onDeleteItem: (id) => void;
    onNewUsersAdd: (users: IAutocompleteItem[], roleName: string, aclRestrictionSet: IAclRestrictionSet) => void;
    changeRoleInTable: (assignee: IAccessDataAssignee, roleName: string, aclRestrictionSet: IAclRestrictionSet) => void;
    onError?: (message: string) => void;
    includeTranslatorPseudoRole?: boolean;
    onValidationErrorsUpdate: (errors: string[]) => void;
    featuresDialects?: boolean;
    t: TFunction;
}

export interface IAccessBoxState {
    selectedRole?: UIRole;
    searchTerm: string;
    filtered: boolean;
    uiRoles?: UIRole[];
    accessDataAssignees?: IAccessDataAssignee[];
    selectedUserItems: IAutocompleteItem[];
    expandedSections: AccessBoxSection[];
    existingAclsSectionHeight: number | "auto";
    newAclsSectionHeight: number | "auto";
}

class AccessBox extends React.Component<IAccessBoxProps, IAccessBoxState> {
    private readonly debouncedSetSearchTerm: (searchTerm: string) => void;
    private readonly t: TFunction;
    private autocompleteInputRef?: HTMLTextAreaElement;

    constructor(props: IAccessBoxProps) {
        super(props);
        this.t = props.t;
        autobind(this, AccessBox.prototype);
        this.debouncedSetSearchTerm = debounce(this.setSearchTerm, 500);
        const isMobile = isMobileView();
        this.state = {
            searchTerm: "",
            filtered: false,
            selectedUserItems: [],
            expandedSections: isMobile ? [AccessBoxSection.ExistingAcls] : [AccessBoxSection.ExistingAcls, AccessBoxSection.NewAcls],
            existingAclsSectionHeight: "auto",
            newAclsSectionHeight: isMobile ? SectionCollapsedHeight : "auto",
        };
    }

    public async componentWillUnmount() {
        const { selectedRole, selectedUserItems } = this.state;
        if (selectedRole && selectedUserItems.length > 0) {
            await this.buildOnSaveSelectedUserItems(true)();
        }
    }

    public componentDidMount() {
        const { tableData, accountRoles } = this.props;
        const { searchTerm } = this.state;
        this.populateUIData(tableData, accountRoles, searchTerm);
    }

    public componentDidUpdate(prevProps, prevState) {
        const { tableData, accountRoles } = this.props;
        const { tableData: prevTableData, accountRoles: prevAccountRoles } = prevProps;
        const { searchTerm, selectedRole, expandedSections } = this.state;
        const { searchTerm: prevSearchTerm, selectedRole: prevSelectedRole, expandedSections: prevExpandedSections } = prevState;
        const accountRolesChanged = JSON.stringify(accountRoles) !== JSON.stringify(prevAccountRoles);
        const tableDataChanged = JSON.stringify(tableData) !== JSON.stringify(prevTableData);
        const searchTermChanged = searchTerm !== prevSearchTerm;
        const selectedRoleChanged = selectedRole !== prevSelectedRole;

        if (expandedSections !== prevExpandedSections) {
            maybeAnimateSection(
                expandedSections.includes(AccessBoxSection.ExistingAcls),
                prevExpandedSections.includes(AccessBoxSection.ExistingAcls),
                (h) => this.setState({ existingAclsSectionHeight: h }),
            );
            maybeAnimateSection(
                expandedSections.includes(AccessBoxSection.NewAcls),
                prevExpandedSections.includes(AccessBoxSection.NewAcls),
                (h) => this.setState({ newAclsSectionHeight: h }),
                () => this.autocompleteInputRef && this.autocompleteInputRef.focus(),
            );
        }

        if (accountRolesChanged || tableDataChanged || searchTermChanged) {
            this.populateUIData(tableData, accountRoles, searchTerm);
        }
        if (selectedRoleChanged) {
            this.validateAddNewForm();
        }
    }


    private buildAccessDataAssignees(tableData: IAccessDataAssignee[], searchTerm?: string): IAccessDataAssignee[] {
        return this.deleteRedundancyAcls(tableData)
            .filter(this.getSearchTermAssigneeFilter(searchTerm))
            .map(assignee => convertToUiAssignee(assignee, this.t));
    }

    private populateUIData(tableData: IAccessDataAssignee[], accountRoles: Role[], searchTerm?: string) {
        const { includeTranslatorPseudoRole } = this.props;
        const uiRoles = buildUIRoles(accountRoles, includeTranslatorPseudoRole, this.t);
        if (!uiRoles) {
            return;
        }
        uiRoles.sort((roleA, roleB) => this.isSuperiorRole(roleA, roleB) ? -1 : 1);
        this.setState({
            uiRoles,
            ...(uiRoles.length && !this.state.selectedRole ? { selectedRole: uiRoles[0] } : {}),
        }, () => {
            const accessDataAssignees = this.buildAccessDataAssignees(tableData, searchTerm);
            this.setState({
                accessDataAssignees,
            });
        });
    }

    private renderTable() {
        const { filtered, accessDataAssignees } = this.state;
        if (!accessDataAssignees) {
            return null;
        }
        const dataPreparedForTable = accessDataAssignees.map(this.elementRowsFromData);
        return (
            <div className="accessBox-table">
                <Table
                    filtered={filtered}
                    customHeaders={["", "", "", ""]}
                    data={dataPreparedForTable}
                    noActionArea={true}
                    noHeader={true}
                    lastColAlignRight={true}
                />
            </div>
        )
    }

    private onChangeSelectedUserItems(selectedUserItems: IAutocompleteItem[]) {
        this.setState({
            selectedUserItems,
        });
    }

    private setExpandedSection(section: AccessBoxSection) {
        let expandedSections = this.state.expandedSections.includes(section) ?
            [] :
            [section];
        if (!(expandedSections.length)) {
            expandedSections = accessBoxSections.filter(s => s !== section);
        }
        this.setState({
            expandedSections,
        });
    }

    public render() {
        const { searchTitle, tableData, includeTranslatorPseudoRole, featuresDialects } = this.props;
        const { selectedUserItems, uiRoles, selectedRole, existingAclsSectionHeight,
            newAclsSectionHeight } = this.state;
        const collapsable = isMobileView();
        const existingAclsSectionExpanded = sectionIsExpanded(existingAclsSectionHeight);
        const newAclsSectionExpanded = sectionIsExpanded(newAclsSectionHeight);

        return (
            <div className="accessBox">
                <div
                    className={cx(
                        "accessBoxSection-existingAcls",
                        { "accessBoxSection-existingAcls--coloredBg": !isMobileView() || existingAclsSectionExpanded }
                    )}
                    style={{ height: existingAclsSectionHeight }}
                >
                    <AccessSearchBar
                        title={searchTitle}
                        onSearch={this.onSearch}
                        onSearchTermChange={this.onSearchTermChange}
                        isExpanded={existingAclsSectionExpanded}
                        setIsExpanded={() => collapsable && this.setExpandedSection(AccessBoxSection.ExistingAcls)}
                    />
                    {this.renderTable()}
                </div>
                <div
                    className={cx(
                        "accessBoxSection-newAcls",
                        { "accessBoxSection-newAcls--coloredBg": isMobileView() && newAclsSectionExpanded },
                    )}
                    style={{ height: newAclsSectionHeight }}
                >
                    {isMobileView() ?
                        (
                            <div
                                className="accessBoxSection-newAcls-header"
                                onClick={() => this.setExpandedSection(AccessBoxSection.NewAcls)}
                            >
                                <label className="accessBoxSection-newAcls-header-title">{this.t(TK.User_AddUserOrUsergroup)}</label>
                                {collapsable && (
                                    <ArrowBtn
                                        isExpand={newAclsSectionExpanded}
                                    />
                                )}
                            </div>
                        ) :
                        null}
                    <div className="accessBoxSection-newAcls-body">
                        <UserInput
                            selectedItems={selectedUserItems}
                            setSelectedItems={this.onChangeSelectedUserItems}
                            userIdsIgnoreList={tableData.map(entry => entry.id)}
                            uiRoles={uiRoles}
                            selectedRole={selectedRole}
                            onSelectRole={this.onSelectRole}
                            includeTranslatorPseudoRole={includeTranslatorPseudoRole}
                            featuresDialects={featuresDialects}
                            onAutocompleteInputRef={ref => this.autocompleteInputRef = ref}
                        />
                        <AddBtn
                            onClick={this.buildOnSaveSelectedUserItems()}
                        />
                    </div>
                </div>
            </div >
        );
    }

    /* EVENT HANDLERS */

    private onSearchTermChange(val) {
        this.debouncedSetSearchTerm(val);
        if (val === "") {
            this.setSearchTerm("");
        }
    }

    private onSearch(e) {
        if (e.key === "Enter") {
            this.setSearchTerm(e.target.value);
        }
    }

    private onSelectRole(role: UIRole) {
        this.setState({
            selectedRole: role
        });
    }

    private onSelectTableRole(assignee: IAccessDataAssignee) {
        return (uiRoleName: string) => {
            if (uiRoleName === assignee.uiRoleName) {
                return;
            }
            const roleName = uiRoleName === TRANSLATOR_PSEUDO_NAME ?
                "Contributor" :
                uiRoleName;
            const aclRestrictionSet = uiRoleName === TRANSLATOR_PSEUDO_NAME ?
                { languageCodes: [] } :
                undefined;
            this.props.changeRoleInTable(assignee, roleName, aclRestrictionSet);
        };
    }

    private onSelectTableLanguage(assignee: IAccessDataAssignee) {
        return (languageCode: string) => {
            const currentLanguageCode = [...((assignee.aclRestrictionSet?.languageCodes) || [])].pop();
            if (languageCode === currentLanguageCode) {
                return;
            }
            const newAclRestrictionSet = { languageCodes: [languageCode] };
            this.props.changeRoleInTable(assignee, assignee.roleName, newAclRestrictionSet);
        };
    }

    private buildOnSaveSelectedUserItems(skipStateUpdate = false) {
        return async () => {
            const { onError, onNewUsersAdd, accountRoles } = this.props;
            const { selectedRole, selectedUserItems } = this.state;
            const realUsers = selectedUserItems.filter(({ isNew }) => !isNew);
            const validationErrMsg = validateUserInput(realUsers, selectedRole, this.t);
            if (validationErrMsg) {
                if (onError) {
                    onError(validationErrMsg);
                }
            }
            const role = maybeNormalizePseudoRole(selectedRole, accountRoles);
            await onNewUsersAdd(realUsers, role.name, role.restrictionSet);
            if (!skipStateUpdate) {
                this.setState({
                    selectedUserItems: [],
                });
            }
        }
    }

    private onDeleteItem(id) {
        return () => {
            return this.props.onDeleteItem(id);
        };
    }

    private validateAddNewForm() {
        const { onValidationErrorsUpdate } = this.props;
        const { selectedUserItems, selectedRole } = this.state;
        const error = validateUserInput(selectedUserItems, selectedRole, this.t);
        onValidationErrorsUpdate([...(error ? [error] : [])]);
    }

    private setSearchTerm(value: string) {
        if (value.length > 0) {
            this.setState({
                filtered: true,
                searchTerm: value,
            });
        } else {
            this.setState({
                filtered: false,
                searchTerm: "",
            });
        }
    }

    private getSearchTermAssigneeFilter(searchTerm: string): (assignee: IAccessDataAssignee) => boolean {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return ({ value, label }) =>
            label.toLowerCase().includes(lowerCaseSearchTerm) || value.includes(lowerCaseSearchTerm);
    }

    private inheritedMaxRole(tableData: IAccessDataAssignee[], element: IAccessDataAssignee): string {
        const [lowestRole] = this.getRolesSortedFromWeakest();
        const data = tableData
            .filter(row => row.isInheritedAcl && element.id === row.id)
            .sort((a, b) => this.isSuperiorRoleByName(a.roleName, b.roleName) ? 1 : -1);
        return data[0] ? data[0].roleName : lowestRole.name;
    }

    private maybeRenderLanguageDropdown(accessDataAssignee?: IAccessDataAssignee, isUnchangeable?: boolean) {
        const { includeTranslatorPseudoRole, featuresDialects } = this.props;
        const { absolutePositioningTarget } = this.context;
        if (!includeTranslatorPseudoRole || accessDataAssignee.uiRoleName !== TRANSLATOR_PSEUDO_NAME) {
            return null;
        }
        const languageCode = [...((accessDataAssignee?.aclRestrictionSet?.languageCodes) || [])].pop();
        const languageElements = getAllLanguageCodes(featuresDialects).map(langCode => ({ id: langCode, label: toLanguageLabel(langCode) }));
        return (
            <FilterableDropdown
                selectedElementId={languageCode}
                onSelectElement={this.onSelectTableLanguage(accessDataAssignee)}
                key={`langDD${languageCode}`}
                type={this.t(TranslationKeys.General_Language)}
                elements={languageElements}
                className="languages-dropdown"
                isDisabled={!isUnchangeable}
                dropdownElementsPortalTarget={absolutePositioningTarget}
            />
        )
    }

    private filterInferiorDropdownRoles(dropdownRoles: IDropdownElement[], minRole: string): IDropdownElement[] {
        return dropdownRoles.filter(({ id: roleName }) => {
            return roleName === minRole || this.isSuperiorRoleByName(minRole, `${roleName}`);
        });
    }

    private maybeIncludeCurrentRole(
        dropdownRoles: IDropdownElement[],
        currentRoleName: string,
        t
    ) {
        if (dropdownRoles.some(({ id }) => id === currentRoleName)) {
            return dropdownRoles;
        }
        return dropdownRoles.concat({ id: currentRoleName, label: t(TK[buildRoleTranslationKey(currentRoleName)]) })
    }

    private buildDropdownRoles(
        uiRoles: Role[],
        t,
        minRole: string,
        currentRoleName: string
    ): IDropdownElement[] {
        let dropdownRoles = uiRoles
            .filter((role: Role) => !role.isInvisible)
            .map(({ name }) => ({
                id: name,
                label: t(TK[buildRoleTranslationKey(name)]),
            } as IDropdownElement));
        dropdownRoles = this.filterInferiorDropdownRoles(dropdownRoles, minRole);
        dropdownRoles = this.maybeIncludeCurrentRole(dropdownRoles, currentRoleName, t);
        return dropdownRoles;
    }

    private elementRowsFromData(accessDataAssignee: IAccessDataAssignee) {
        const { tableData } = this.props;
        const { uiRoles } = this.state;
        const sortedRoles = this.getRolesSortedFromWeakest();
        const strongestRole = sortedRoles[sortedRoles.length - 1];
        const isUnchangeable = !accessDataAssignee.isInheritedAcl;
        const maxRoleInherited = this.inheritedMaxRole(tableData, accessDataAssignee);
        const minRole = maxRoleInherited; // the max inherited role becomes the min role in the roles dropdown
        const dropdownRoles = this.buildDropdownRoles(uiRoles, this.t, minRole, accessDataAssignee.uiRoleName);
        const { absolutePositioningTarget } = this.context;
        return [
            accessDataAssignee.type === AssigneeType.USERGROUP ? GroupIcon({ width: 24, marginRight: 8 }) : " ",
            accessDataAssignee.label,
            <div>
                <Dropdown
                    selectedElementId={accessDataAssignee.uiRoleName}
                    onSelectElement={this.onSelectTableRole(accessDataAssignee)}
                    key={accessDataAssignee.id}
                    type={this.t(TranslationKeys.User_ChooseRole)}
                    elements={dropdownRoles}
                    isDisabled={accessDataAssignee.isInheritedAcl && accessDataAssignee.roleName === strongestRole.name}
                    limitMenuWidth={true}
                    className="roles-dropdown"
                    dropdownElementsPortalTarget={absolutePositioningTarget}
                />
                {this.maybeRenderLanguageDropdown(accessDataAssignee, isUnchangeable)}
            </div>,
            isUnchangeable ?
                <CloseButton onClick={this.onDeleteItem(accessDataAssignee.id)} key={accessDataAssignee.id} /> :
                null
        ];
    }

    private isSuperiorRoleByName = (previous: string, next: string): boolean => {
        // @TODO: We have to check which role is the weakest - for now - use
        // number of permissions
        const { uiRoles } = this.state;
        const previousRole = uiRoles.find(role => role.name === previous);
        const nextRole = uiRoles.find(role => role.name === next);
        const is = this.isSuperiorRole(previousRole, nextRole);
        return is;
    }

    private isSuperiorRole = (previousRole: Role | UIRole, nextRole: Role | UIRole): boolean => {
        const { dbRoleName: previousDbRoleName, isRestrictedVariant: previousIsRestrictedVariant } = previousRole as UIRole;
        const { dbRoleName: nextDbRoleName } = nextRole as UIRole;
        if (!!previousDbRoleName && previousDbRoleName === nextDbRoleName) {
            // identical role names on db level, check to see if one of them is the restricted variant of the other (eg like Translator is to Contributor)
            // update MT-2998 & MT-3038 Depending on feature flag setup translator is no longer only restricted Conributor, but additionaly it has virtual Review Permission
            if (previousIsRestrictedVariant) {
                return false;
            }
            return true;
        }
        const previousRoleScore = previousRole.permissions.reduce((reduced, permission) => reduced + scorePermission(permission), 0);
        const nextRoleScore = nextRole.permissions.reduce((reduced, permission) => reduced + scorePermission(permission), 0);
        return nextRoleScore > previousRoleScore;
    }

    private getRolesSortedFromWeakest(): Role[] {
        const { uiRoles } = this.state;
        return uiRoles.sort((a, b) => this.isSuperiorRole(a, b) ? -1 : 1);
    }

    private deleteRedundancyAcls(tableData: IAccessDataAssignee[]): Array<IAccessDataAssignee> {
        return tableData.reduce((rows, item) => {
            const userIndex = rows.findIndex(row => (row.id === item.id));
            if (userIndex === -1) {
                rows.push(item);
            } else if (
                // if we have two acls for the same id, we choose stronger role to show
                this.isSuperiorRoleByName(rows[userIndex].uiRoleName, item.uiRoleName) ||
                // or if we have same acls roles, we choose the one that is deletable to show
                (rows[userIndex].role === item.uiRoleName && rows[userIndex].isInheritedAcl)
            ) {
                rows.splice(userIndex, 1, item);
            }
            return rows;
        }, []);
    }
}

AccessBox.contextType = AbsolutePositioningContext;

export default withTranslation()(AccessBox);
