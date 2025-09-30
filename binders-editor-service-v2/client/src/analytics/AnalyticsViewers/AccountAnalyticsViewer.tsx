import * as React from "react";
import {
    AccountFeatures,
    FEATURE_PUBLICCONTENT,
    FEATURE_READ_CONFIRMATION
} from "@binders/client/lib/clients/accountservice/v1/contract";
import Dropdown, { IDropdownElement } from "@binders/ui-kit/lib/elements/dropdown";
import {
    IUserActionFilter,
    UserActionType,
    getUserActionTranslationKey
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { Pane, Tabs } from "@binders/ui-kit/lib/elements/tabs";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { differenceInDays, sub } from "date-fns";
import AccountAnalyticsBody from "./AccountAnalyticsBody";
import AccountStore from "../../accounts/store";
import AddChunkIcon from "@binders/ui-kit/lib/elements/icons/AddChunk";
import Button from "@binders/ui-kit/lib/elements/button";
import Checkbox from "@binders/ui-kit/lib/elements/checkbox";
import Chip from "@binders/ui-kit/lib/elements/chip";
import { Container } from "flux/utils";
import DocumentStore from "../../documents/store";
import Folder from "@binders/ui-kit/lib/elements/icons/Folder";
import GroupIcon from "@binders/ui-kit/lib/elements/icons/Group";
import Icon from "@binders/ui-kit/lib/elements/icons";
import { LastAggregationTimestamp } from "./LastAggregationTimestamp";
import Layout from "../../shared/Layout/Layout";
import Modal from "@binders/ui-kit/lib/elements/modal";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import { RangeDatePicker } from "@binders/ui-kit/lib/elements/datePicker";
import RoundButton from "@binders/ui-kit/lib/elements/button/RoundButton";
import { RouteComponentProps } from "react-router";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Table from "@binders/ui-kit/lib/elements/Table/SimpleTable";
import { WebData } from "@binders/client/lib/webdata";
import { WebDataWithFailure } from "../../application/WebDataWithFailure";
import WiredTreeNavigator from "../../browsing/WiredTreeNavigator";
import autobind from "class-autobind";
import { browseInfoFromRouteParams } from "../routes";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { pickFirstParentItem } from "../../documents/helper";
import { uniq } from "ramda";
import { useAccountUsersOrEmpty } from "../../users/hooks";
import { useGetAccountUsergroupsExcludingAutoManaged } from "../../users/query";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./analytics.styl";

const MAX_DAYS = 60;
// values for dropdowns ( 1 ... 10000 and day/week/month/year )
const fixedRangeCountValues: IDropdownElement[] = Array.from({ length: MAX_DAYS }, (_, i) => ({
    id: i + 1,
    label: (i + 1).toString()
}));

const buildFixedRangeTypeValues = (t: TFunction) => [
    { label: t(TK.General_Day, { count: 1 }), id: "day" },
    { label: t(TK.General_Week, { count: 1 }), id: "week" },
    { label: t(TK.General_Month, { count: 1 }), id: "month" },
    { label: t(TK.General_Year, { count: 1 }), id: "year" }
];

const getUserActionTypeKeys = (accountFeatures: AccountFeatures) => {
    return [
        UserActionType.DOCUMENT_READ,
        ...(accountFeatures?.includes(FEATURE_READ_CONFIRMATION) ? [UserActionType.DOCUMENT_READ_CONFIRMED] : []),
        UserActionType.DOCUMENT_PUBLISHED,
        UserActionType.DOCUMENT_UNPUBLISHED,
        UserActionType.ITEM_CREATED,
        UserActionType.ITEM_DELETED,
        UserActionType.ITEM_EDITED,
        UserActionType.ITEM_HARD_DELETED,
        UserActionType.ITEM_MOVED,
        UserActionType.NOT_READ,
        UserActionType.LANGUAGE_ADDED,
        UserActionType.LANGUAGE_DELETED,
        UserActionType.CHECKLIST_COMPLETED,
    ].map(ua => UserActionType[ua]);
}

const chipLabelStyle = {
    display: "flex",
    alignItems: "center",
};

const radioButtonStyle = {
    display: "inline-block",
    width: "auto",
    verticalAlign: "top",
};

const timeRangeType = {
    // datepicker
    custom: "custom",
    // dropdowns
    fixed: "fixed",
    // no filter
    all: "all",
};

const buildDefaultFilter = (accountFeatures: AccountFeatures): Filter => ({
    items: [],
    recursive: true,
    startDate: undefined,
    endDate: undefined,
    users: [],
    usergroups: [],
    userActionTypes: getUserActionTypeKeys(accountFeatures).reduce((obj, a) => ({ ...obj, [a]: false }), {}),
    rangeType: timeRangeType.fixed,
    fixedRange: { count: 1, type: "day" }
});

type Filter = {
    items: unknown[],
    recursive: true,
    startDate: undefined,
    endDate: undefined,
    users: [],
    usergroups: [],
    userActionTypes: Record<string, boolean>,
    rangeType: typeof timeRangeType[keyof typeof timeRangeType],
    fixedRange: { count: number, type: string }
}

type AccountAnalyticsViewerData = {
    accountFeatures: AccountFeatures;
};

interface AccountAnalyticsViewerState {
    data: AccountAnalyticsViewerData;
    items;
    selectedDoc;
    selectedUsers;
    selectedUsergroups;
    selectedUserActions;
    filter: Filter;
    filterForAPI: Omit<IUserActionFilter, "accountId">;
    isDocumentSelectorOpen;
    isUserSelectorOpen;
    isUserActionSelectorOpen;
    childrenItems;
    parentItems: { id: string, domainCollectionId: string, name: string }[];
    filteredUsergroupsData: Usergroup[] | undefined;
    filteredUsersData: User[] | undefined;
}

interface AccountAnalyticsViewerProps extends RouteComponentProps {
    usergroupsData: Usergroup[];
    usersData: User[];
    t: TFunction;
}

class AccountAnalyticsViewer extends WebDataWithFailure<AccountAnalyticsViewerData, AccountAnalyticsViewerProps> {

    publicUser = null;
    mounted = false;

    static getStores() {
        return [DocumentStore, AccountStore];
    }

    static calculateState(previousState: AccountAnalyticsViewerState) {
        const accountFeatures = AccountStore.getAccountFeatures();
        return {
            data: WebData.compose({ accountFeatures }),
            items: DocumentStore.getEditableItems(),
            selectedDoc: previousState ? previousState.selectedDoc : { docId: undefined, name: undefined },
            selectedUsers: previousState ? previousState.selectedUsers : [],
            selectedUsergroups: previousState ? previousState.selectedUsergroups : [],
            selectedUserActions: previousState ? previousState.selectedUserActions : getUserActionTypeKeys(accountFeatures?.result).reduce((obj, a) => ({ ...obj, [a]: false }), {}),
            filter: previousState ? previousState.filter : buildDefaultFilter(accountFeatures?.result),
            isDocumentSelectorOpen: previousState ? previousState.isDocumentSelectorOpen : false,
            isUserSelectorOpen: previousState ? previousState.isUserSelectorOpen : false,
            isUserActionSelectorOpen: previousState ? previousState.isUserActionSelectorOpen : false,
            childrenItems: previousState ? previousState.childrenItems : [],
            parentItems: previousState ? previousState.parentItems : [],
            filteredUsergroupsData: previousState?.filteredUsergroupsData,
            filteredUsersData: previousState?.filteredUsersData,
        };
    }

    constructor(props: AccountAnalyticsViewerProps) {
        super(props);
        autobind(this, AccountAnalyticsViewer.prototype);
    }

    componentDidMount() {
        const { data, filter } = this.state;
        const { t } = this.props;
        const { partials: { accountFeatures: accountFeaturesWD } } = data;
        this.publicUser = accountFeaturesWD.result.includes(FEATURE_PUBLICCONTENT) ?
            {
                id: "public",
                displayName: t(TK.User_Public),
            } :
            {
                id: "public",
                displayName: t(TK.General_NotApplicable),
            };
        if (filter) {
            this.applyFilter();
        }
        this.mounted = true;
    }

    componentDidUpdate(_prevProps: AccountAnalyticsViewerProps, prevState: AccountAnalyticsViewerState) {
        const { filter } = this.state;
        const { filter: prevFilter } = prevState;
        if (!prevFilter && filter) {
            this.applyFilter();
        }
    }

    /* EVENTS */
    // general
    onModalHide() {
        this.setState({
            isDocumentSelectorOpen: false,
            isUserSelectorOpen: false,
            isUserActionSelectorOpen: false,
        });
    }

    applyFilter() {
        const { filter } = this.state;
        let startDate: Date;
        let endDate: Date | undefined;
        if (filter.rangeType === timeRangeType.all) {
            startDate = new Date(0);
        }
        if (filter.rangeType === timeRangeType.custom) {
            startDate = filter.startDate;
            endDate = filter.endDate;
        } else if (filter.rangeType === timeRangeType.fixed) {
            [startDate] = getDatesFromFixedRange(filter.fixedRange);
        }
        const filterForAPI = {
            itemIds: filter.items.map(({ docId }) => docId),
            userIds: filter.users.map(({ id }) => id),
            userGroupIds: filter.usergroups.map(({ id }) => id),
            // range for user action start timestamp
            startRange: {
                rangeStart: startDate.toISOString(),
                ...(endDate ? { rangeEnd: endDate.toISOString() } : {}),
            },
            userActionTypes: Object.keys(filter.userActionTypes)
                .filter((k) => filter.userActionTypes[k])
                .map(type => UserActionType[type]),
            recursive: filter.items.length === 0 || filter.items.some(item => item.kind === "collection"),
            skipUnpublished: filter.skipUnpublished,
            ...(filter.excludeAuthors ? { userIsAuthor: false } : {}),
        };
        this.setState({ filterForAPI });
    }


    onChangeDateRange(_event, date, type) {
        this.setState({
            filter: { ...this.state.filter, [`${type}Date`]: date, rangeType: timeRangeType.custom },
        });
    }

    onSelectFixedRangeCount(val) {
        const { filter } = this.state;
        this.setState({
            filter: { ...filter, fixedRange: { ...filter.fixedRange, count: val } }
        });
    }

    onSelectFixedRangeType(val) {
        const { filter } = this.state;
        this.setState({
            filter: { ...filter, fixedRange: { ...filter.fixedRange, type: val } }
        });
    }

    onDropdownClick() {
        this.setState({
            filter: { ...this.state.filter, rangeType: timeRangeType.fixed }
        });
    }

    onChangeRangeType(val) {
        let startDate = undefined;
        let endDate = undefined;
        let newFilter = {};
        let daysCount = 1;
        const { fixedRange, startDate: filterStartDate, endDate: filterEndDate } = this.state.filter;
        // if we switch from fixed dates (dropdowns) to custom (datepickers)
        if (val === timeRangeType.custom && fixedRange.type && fixedRange.count) {
            [startDate, endDate] = getDatesFromFixedRange(fixedRange);
            newFilter = { startDate, endDate };
        } else if (val === timeRangeType.fixed && filterStartDate && filterStartDate) {
            // switched from custom to fixed dates
            const daysDifference = differenceInDays(filterEndDate, filterStartDate);
            daysCount = Math.min(MAX_DAYS, daysDifference);
            newFilter = { fixedRange: { type: "day", count: daysCount } };
        }
        this.setState({
            filter: { ...this.state.filter, rangeType: val, ...newFilter }
        })
    }

    onChangeHideUnpublished(skipUnpublished = false) {
        this.setState({
            filter: { ...this.state.filter, skipUnpublished }
        })
    }

    onChangeExcludeAuthors() {
        this.setState({
            filter: {
                ...this.state.filter,
                excludeAuthors: !(this.state.filter.excludeAuthors),
            }
        })
    }

    // documents section

    openDocumentSelector() {
        const firstParentArr = this.state.items.result && pickFirstParentItem(this.state.items.result);
        this.setState({
            isDocumentSelectorOpen: true,
            parentItems: firstParentArr || [],
            ...(firstParentArr?.length ? { selectedDoc: { docId: firstParentArr[0].id, name: firstParentArr[0].name } } : {}),
        });
    }

    onSelectDocument(docId, domainCollectionId, parents, name, kind) {
        this.setState({
            selectedDoc: { docId, name, kind },
        });
    }

    onDeleteChosenDoc(id) {
        return () => {
            this.setState({
                filter: { ...this.state.filter, items: this.state.filter.items.filter(({ docId }) => docId !== id) },
            });
        }
    }

    onSaveDocument() {
        this.setState({
            filter: {
                ...this.state.filter,
                items: uniq([...this.state.filter.items, this.state.selectedDoc])
            },
            isDocumentSelectorOpen: false,
        });
    }

    // users section
    onTableSearch<P extends keyof Pick<AccountAnalyticsViewerProps, "usergroupsData" | "usersData">>(query: string, propToSet: string, propToGet: P) {
        if (!query) {
            this.setState({ [propToSet]: undefined });
            return;
        }
        const lowercaseQuery = query.toLowerCase();
        const filteredData = this.props[propToGet].reduce((out, column) => {
            const hasMatch = Object.values(column)
                .filter(field => typeof field === "string")
                .some(field => field.toLowerCase().includes(lowercaseQuery));
            if (hasMatch) {
                out.push(column);
            }
            return out;
        }, []);
        this.setState({ [propToSet]: filteredData });
    }

    openUserSelector() {
        this.setState({
            isUserSelectorOpen: true,
            selectedUsergroups: this.state.filter.usergroups,
            selectedUsers: this.state.filter.users,
        });
    }

    onDeleteChosenUser(id) {
        return () => {
            this.setState({
                filter: {
                    ...this.state.filter,
                    users: this.state.filter.users.filter(({ id: uId }) => uId !== id),
                },
            });
        };
    }

    onDeleteChosenUserGroup(id) {
        return () => {
            this.setState({
                filter: {
                    ...this.state.filter,
                    usergroups: this.state.filter.usergroups.filter(({ id: uId }) => uId !== id),
                },
            });
        };
    }

    onToggleUserGroup(usergroup) {
        return (() => {
            const { selectedUsergroups } = this.state;
            const includesCheckedItem = selectedUsergroups.some(({ id }) => id === usergroup.id);
            if (includesCheckedItem) {
                this.setState({
                    selectedUsergroups: selectedUsergroups.filter(({ id }) => id !== usergroup.id),
                });
                return;
            }
            this.setState({
                selectedUsergroups: [...selectedUsergroups, usergroup],
            });
        })
    }

    onToggleUser(user) {
        return (() => {
            const { selectedUsers } = this.state;
            const includesCheckedItem = selectedUsers.some(({ id }) => id === user.id);
            if (includesCheckedItem) {
                this.setState({
                    selectedUsers: selectedUsers.filter(({ id }) => id !== user.id),
                });
                return;
            }
            this.setState({
                selectedUsers: [...selectedUsers, user],
            });
        })
    }

    onSaveUser() {
        this.setState({
            filter: {
                ...this.state.filter,
                users: this.state.selectedUsers,
                usergroups: this.state.selectedUsergroups
            },
            isUserSelectorOpen: false,
        })
    }

    // user actions section

    onToggleActionType(action) {
        return () => {
            this.setState({
                selectedUserActions: {
                    ...this.state.selectedUserActions,
                    [action]: !this.state.selectedUserActions[action]
                },
            })
        };
    }

    onDeleteChosenUserAction(action) {
        return () => {
            this.setState({
                filter: {
                    ...this.state.filter,
                    userActionTypes: { ...this.state.filter.userActionTypes, [action]: false },
                },
            });
        };
    }

    openUserActionSelector() {
        this.setState({
            isUserActionSelectorOpen: true,
            selectedUserActions: this.state.filter.userActionTypes,
        });
    }

    onSaveUserAction() {
        this.setState({
            filter: { ...this.state.filter, userActionTypes: this.state.selectedUserActions },
            isUserActionSelectorOpen: false,
        })
    }

    /* RENDERS */

    // modals

    renderChooseDocumentModal(parentItems) {
        const { t } = this.props;
        const { selectedDoc } = this.state;
        const hide = () => this.onModalHide();
        return (
            <Modal
                onHide={hide}
                title={t(TK.DocManagement_ChooseDoc)}
                buttons={[
                    <Button onClick={hide} secondary text={t(TK.General_Cancel)} />,
                    <Button isEnabled={selectedDoc?.docId != null} onClick={() => this.onSaveDocument()} text={t(TK.General_Choose)} />,
                ]}
                classNames="newDocument-modal"
            >
                <p className="filterForm-modal-tip">
                    {t(TK.DocManagement_ChooseColOrDoc)}:
                </p>
                <WiredTreeNavigator
                    parentItems={parentItems}
                    includeAllItems={true}
                    onSelect={this.onSelectDocument.bind(this)}
                    allowRootSelection={true}
                    restrictToAdminOnlyPermission={true}
                />
                <div className="filterForm-modal-info">
                    <Icon name="info" style={{ fontSize: "16px" }} />
                    {t(TK.DocManagement_AllAvailableDocuments_Info)}
                </div>
            </Modal>
        );
    }


    renderChooseUserModal() {
        const { t } = this.props;
        const users = this.state.filteredUsersData ?? this.props.usersData;
        const usersData = [this.publicUser, ...users].map((u) => {
            return [
                <Checkbox
                    key={u.id}
                    onCheck={this.onToggleUser(u).bind(this)}
                    label=""
                    checked={this.state.selectedUsers.some(({ id }) => id === u.id)}
                />,
                u.displayName,
                u.login
            ];
        });
        const usergroups = this.state.filteredUsergroupData ?? this.props.usergroupsData;
        const usergroupsData = usergroups.map((ug) => {
            return [
                <Checkbox
                    key={ug.id}
                    onCheck={this.onToggleUserGroup(ug).bind(this)}
                    label=""
                    checked={this.state.selectedUsergroups.some(({ id }) => id === ug.id)}
                />,
                ug.name];
        });
        const hide = () => {
            this.setState({
                filteredUsergroupData: undefined,
                filteredUsersData: undefined,
            });
            this.onModalHide();
        };
        return (
            <Modal
                onHide={hide}
                title={t(TK.User_ChooseUserOrGroup)}
                buttons={[
                    <Button onClick={hide} secondary text={t(TK.General_Cancel)} />,
                    <Button onClick={() => {
                        this.setState({
                            filteredUsergroupData: undefined,
                            filteredUsersData: undefined,
                        });
                        this.onSaveUser();
                    }} text={t(TK.General_Choose)} />,
                ]}
                classNames="filterForm-modal"
            >
                <Tabs>
                    <Pane label="Usergroups">
                        <Table
                            recordsPerPage={5}
                            customHeaders={["", t(TK.User_GroupName).toUpperCase()]}
                            data={usergroupsData}
                            className="filterForm-modal-table"
                            searchable
                            onSearch={(q) => this.onTableSearch(q, "filteredUsergroupData", "usergroupsData")}
                        />
                    </Pane>
                    <Pane label="Users">
                        <Table
                            recordsPerPage={5}
                            customHeaders={["", t(TK.User_UserName).toUpperCase(), t(TK.General_Email).toUpperCase()]}
                            data={usersData}
                            className="filterForm-modal-table"
                            searchable
                            onSearch={(q) => this.onTableSearch(q, "filteredUsersData", "usersData")}
                        />
                    </Pane>
                </Tabs>
            </Modal>
        );

    }

    renderChooseUserActionModal(data: AccountAnalyticsViewerData) {
        const t = this.props.t;
        return (
            <Modal
                onHide={() => this.onModalHide()}
                title={t(TK.User_ActionChoose)}
                buttons={[
                    <Button onClick={() => this.onModalHide()} secondary text={t(TK.General_Cancel)} />,
                    <Button onClick={() => this.onSaveUserAction()} text={t(TK.General_Choose)} />,
                ]}
            >
                <div className="filterForm-actionTypes">
                    {getUserActionTypeKeys(data.accountFeatures).map(a =>
                        <Checkbox
                            key={a}
                            onCheck={this.onToggleActionType(a)}
                            disabled={false}
                            label={t(getUserActionTranslationKey(UserActionType[a]))}
                            checked={this.state.selectedUserActions[a]}
                        />
                    )}
                </div>
            </Modal>
        );
    }

    // chips

    renderChosenDocs(items) {
        const { t } = this.props;
        return (
            <div className="filterForm-chosenDocs">
                {items.length === 0 ?
                    (
                        <div className="filterForm-content-chip">
                            <Chip
                                key={"allDocs"}
                                label={t(TK.DocManagement_AllAvailableDocuments)}
                                onClick={() => this.openDocumentSelector()}
                                onDelete={() => this.openDocumentSelector()}
                            />
                        </div>
                    ) :
                    (<div>
                        {items.map(doc => {
                            const label = (
                                <span style={chipLabelStyle}>
                                    {doc.kind === "collection" ? Folder("filterForm-folder") : null}
                                    {doc.name}
                                </span>
                            );
                            return (
                                <div key={doc.docId} className="filterForm-chip">
                                    <Chip
                                        key={doc.docId}
                                        onDelete={this.onDeleteChosenDoc(doc.docId).bind(this)}
                                        label={label}
                                    />
                                </div>
                            );
                        })}
                        <RoundButton onClick={() => this.openDocumentSelector()} icon={<AddChunkIcon />} />
                    </div>)
                }
            </div>
        );
    }

    renderChosenUsers({ users, usergroups }) {
        const { t } = this.props;
        return <div className="filterForm-chosenUsers">
            {
                (users.length === 0 && usergroups.length === 0) ?
                    (
                        <div className="filterForm-content-chip">
                            <Chip
                                key="allUsers"
                                onClick={() => this.openUserSelector()}
                                onDelete={() => this.openUserSelector()}
                                label={t(TK.User_AllUsers)}
                            />
                        </div>
                    ) :
                    (
                        <div>
                            {users.map(u => {
                                return (
                                    <div key={u.id} className="filterForm-chip">
                                        <Chip
                                            key={u.id}
                                            onDelete={this.onDeleteChosenUser(u.id).bind(this)}
                                            label={u.displayName}
                                        />
                                    </div>
                                );
                            })}
                            {usergroups.map(u => {
                                const label = (
                                    <span style={chipLabelStyle}>
                                        {GroupIcon()}
                                        {u.name}
                                    </span>
                                );
                                return (
                                    <div key={u.id} className="filterForm-chip">
                                        <Chip
                                            key={u.id}
                                            onDelete={this.onDeleteChosenUserGroup(u.id).bind(this)}
                                            label={label}
                                        />
                                    </div>
                                );
                            })}

                            <RoundButton onClick={() => this.openUserSelector()} icon={<AddChunkIcon />} />
                        </div>
                    )
            }
        </div>
    }


    renderChosenUserActions({ userActionTypes }) {
        const { t } = this.props;
        const chosenUserActions = Object.keys(userActionTypes).filter((k) => userActionTypes[k]);
        return <div className="filterForm-chosenUserActions">
            {
                (chosenUserActions.length === 0) ?
                    (
                        <div className="filterForm-content-chip">
                            <Chip
                                key={"allActions"}
                                label={t(TK.User_ActionAllActions)}
                                onClick={() => this.openUserActionSelector()}
                                onDelete={() => this.openUserActionSelector()}
                            />
                        </div>
                    ) :
                    (
                        <div>
                            {chosenUserActions.map(action => {
                                return (
                                    <div key={action} className="filterForm-chip">
                                        <Chip
                                            key={action}
                                            onDelete={this.onDeleteChosenUserAction(action)}
                                            label={t(getUserActionTranslationKey(UserActionType[action]))}
                                        />
                                    </div>
                                );
                            })}
                            <RoundButton onClick={() => this.openUserActionSelector()} icon={<AddChunkIcon />} />
                        </div>
                    )
            }
        </div>
    }

    // sections

    renderTimeRangeSection(filter) {
        const { t } = this.props;
        return (
            <div className="filterForm-content-row">
                <RadioButtonGroup
                    name="timeRangeType"
                    value={filter.rangeType}
                    row={true}
                >
                    <div className="filterForm-content-label isWide">{t(TK.Analytics_TimeRange)}</div>
                    <div className="div filterForm-content-section">
                        <div className="div filterForm-content-subsection">
                            <RadioButton
                                value={timeRangeType.fixed}
                                label=""
                                style={radioButtonStyle}
                                onChange={() => this.onChangeRangeType(timeRangeType.fixed)}
                            />

                            <Dropdown
                                type="fixedRangeCount"
                                elements={fixedRangeCountValues}
                                selectedElementId={filter.fixedRange.count}
                                maxRows={8}
                                className="filterForm-dropdown"
                                onSelectElement={(v) => this.onSelectFixedRangeCount(v)}
                                selectedLabelPrefix=" "
                                hideSelectedElementInList={false}
                                showBorders={true}
                                onClick={() => this.onDropdownClick()}
                                isDisabled={filter.rangeType && filter.rangeType !== timeRangeType.fixed}
                            />
                            <Dropdown
                                type="fixedRangeType"
                                elements={buildFixedRangeTypeValues(t)}
                                selectedElementId={filter.fixedRange.type}
                                maxRows={4}
                                className="filterForm-dropdown"
                                onSelectElement={(v) => this.onSelectFixedRangeType(v)}
                                selectedLabelPrefix=" "
                                hideSelectedElementInList={false}
                                showBorders={true}
                                onClick={() => this.onDropdownClick()}
                                isDisabled={filter.rangeType && filter.rangeType !== timeRangeType.fixed}
                            />
                        </div>
                        <div className="div filterForm-content-subsection">
                            <RadioButton
                                value={timeRangeType.custom}
                                label={t(TK.General_Start)}
                                onChange={() => this.onChangeRangeType(timeRangeType.custom)}
                                style={radioButtonStyle}
                            />

                            <RangeDatePicker
                                selectedDateMin={filter.startDate}
                                selectedDateMax={filter.endDate}
                                onChangeDate={this.onChangeDateRange.bind(this)}
                                width={150}
                                separator={` ${t(TK.General_End)} `}
                                className="filterForm-datepicker"
                                disabled={filter.rangeType && filter.rangeType !== timeRangeType.custom}
                            />
                        </div>
                        <div className="div filterForm-content-subsection">
                            <RadioButton
                                value={timeRangeType.all}
                                label={t(TK.Analytics_AllTime)}
                                style={radioButtonStyle}
                                onChange={(() => this.onChangeRangeType(timeRangeType.all)).bind(this)}
                            />
                        </div>
                    </div>
                </RadioButtonGroup>
            </div>
        );
    }

    renderDocumentsSection(filter) {
        const { t } = this.props;
        return (
            <div className="filterForm-content-row">
                <div className="filterForm-content-label">{t(TK.DocManagement_Documents)}</div>
                {this.renderChosenDocs(filter.items)}
            </div >
        );
    }

    renderUsersSection(filter) {
        const { t } = this.props;
        return (
            <div className="filterForm-content-row">
                <div className="filterForm-content-label">{t(TK.User_Users)}</div>
                {this.renderChosenUsers(filter)}
            </div>
        );
    }

    renderUserActionsSection(filter) {
        const { t } = this.props;
        return (
            <div className="filterForm-content-row">
                <div className="filterForm-content-label">{t(TK.General_Data)}</div>
                {this.renderChosenUserActions(filter)}
            </div>
        );
    }

    mayberRenderUserActionsTweaksSection() {
        const { filter } = this.state;
        const includesDocRead = filter.userActionTypes["DOCUMENT_READ"];
        if (includesDocRead) {
            return (
                <div className="filterForm-content-row">
                    <Checkbox
                        onCheck={() => this.onChangeExcludeAuthors()}
                        label="Exclude authors from document read actions"
                        checked={!!filter.excludeAuthors}
                    />
                </div>
            )
        }
    }

    renderHideUnpublishedFilter(filter) {
        return (
            <div className="filterForm-content-row">
                <Checkbox
                    onCheck={() => this.onChangeHideUnpublished()}
                    label="Hide unpublished documents"
                    checked={!!filter.skipUnpublished}
                />
            </div>
        );
    }

    renderSuccess(data: AccountAnalyticsViewerData) {
        const {
            isDocumentSelectorOpen,
            filter,
            isUserSelectorOpen,
            parentItems,
            isUserActionSelectorOpen
        } = this.state;
        const { t } = this.props;

        return (
            <div className="analytics-wrapper">
                <div className="filterForm">
                    {isDocumentSelectorOpen && this.renderChooseDocumentModal(parentItems)}
                    {isUserSelectorOpen && this.renderChooseUserModal()}
                    {isUserActionSelectorOpen && this.renderChooseUserActionModal(data)}
                    <div className="filterForm-heading">
                        <label className="filterForm-heading-title">
                            {t(TK.Analytics_ReportBuilder)}
                        </label>
                        <LastAggregationTimestamp />
                    </div>
                    <div className="filterForm-content">
                        {this.renderTimeRangeSection(filter)}
                        {this.renderDocumentsSection(filter)}
                        {this.renderUsersSection(filter)}
                        {this.renderUserActionsSection(filter)}
                        {this.mayberRenderUserActionsTweaksSection()}
                        {this.renderHideUnpublishedFilter(filter)}
                        <Button onClick={() => this.applyFilter()} text={t(TK.Analytics_ApplyFilters)} />
                    </div>
                </div>
            </div>
        );
    }

    render() {
        const { data } = this.state;
        const { match, history, location, t } = this.props;
        return (
            <div>
                <Layout
                    className="account-analytics analytics-viewer"
                    match={match}
                    location={location}
                    history={history}
                    containerClassName="container"
                    hideBreadcrumbs={true}
                    innerContainerClassName="container-inner"
                    modalPlaceholder={undefined}
                    browseInfoFromRouteParams={browseInfoFromRouteParams}
                    showMyLibraryLink={false}
                >
                    <div className="analytics-wrapper">
                        {this.renderWebData(data, { loadingMessage: t(TK.General_FetchingData) })}
                    </div>
                    <AccountAnalyticsBody userActionsFilter={this.state.filterForAPI} />
                </Layout>
            </div>
        );
    }
}

function getDatesFromFixedRange(fixedRange) {
    const now = new Date();
    return [sub(now, { [`${fixedRange.type}s`]: fixedRange.count }), now];
}

const container = Container.create(fixES5FluxContainer(AccountAnalyticsViewer));
const AccountAnalyticsViewerWithHooks = withHooks(container, () => ({
    usergroupsData: useGetAccountUsergroupsExcludingAutoManaged().data,
    usersData: useAccountUsersOrEmpty(),
}));
export default withTranslation()(AccountAnalyticsViewerWithHooks);
