import * as React from "react";
import { Accordion, AccordionGroup } from "@binders/ui-kit/lib/elements/accordion";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { User, Usergroup, UsergroupDetails } from "@binders/client/lib/clients/userservice/v1/contract";
import {
    useCreateUsergroup,
    useDeleteUsergroup,
    useGetAccountUsergroupsExcludingAutoManaged,
    useGetMembersFromAllGroups,
    useUpdateUsergroup,
} from "../../query";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountStore from "../../../accounts/store";
import Button from "@binders/ui-kit/lib/elements/button";
import { Container } from "flux/utils";
import Delete from "@binders/ui-kit/lib/elements/icons/Delete";
import { DragDropContextProvider } from "react-dnd";
import EditUsergroup from "./EditUsergroup";
import HTML5Backend from "react-dnd-html5-backend";
import Loader from "@binders/ui-kit/lib/elements/loader";
import Modal from "@binders/ui-kit/lib/elements/modal";
import ModeEdit from "@binders/ui-kit/lib/elements/icons/ModeEdit";
import SearchInput from "@binders/ui-kit/lib/elements/input/SearchInput";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import UsergroupOrganizer from "./UsergroupOrganizer";
import colors from "@binders/ui-kit/lib/variables";
import cx from "classnames";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { useAccountUsersOrEmpty } from "../../hooks";
import { useActiveAccountId } from "../../../accounts/hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "../users.styl";

type UsergroupsProps = {
    accountId: string;
    t: TFunction;
    users: User[];
    usergroups: UseQueryResult<Usergroup[]>;
    usergroupMembers: UseQueryResult<UsergroupDetails[]>;
    createUsergroup: UseMutationResult<void, unknown, {
        accountId: string;
        name: string;
    }>;
    deleteUsergroup: UseMutationResult<void, unknown, {
        accountId: string;
        groupId: string;
    }>;
    updateUsergroup: UseMutationResult<void, unknown, {
        accountId: string;
        groupId: string;
        name: string;
    }>;
}

type UsergroupsState = {
    adminUserGroup: { result: string },
    activeAccount?: Account,
    usergroupFacingRemoval?: { id: string, name: string },
    editUsergroupModalShowing: boolean,
    groupToEdit?: { id: string; name?: string },
    groupNameMatch: string,
}

class Usergroups extends React.Component<UsergroupsProps, UsergroupsState> {

    private accordionGroupRef: AccordionGroup | null;

    static getStores() {
        return [AccountStore]
    }

    static calculateState(prevState) {
        return {
            adminUserGroup: AccountStore.getAdminGroup(),
            activeAccount: AccountStore.getActiveAccount(),
            usergroupFacingRemoval: prevState ? prevState.usergroupFacingRemoval : undefined,
            editUsergroupModalShowing: prevState ? prevState.editUsergroupModalShowing : false,
            groupToEdit: prevState ? prevState.groupToEdit : undefined,
            groupNameMatch: prevState ? prevState.groupNameMatch : "",
        }
    }

    constructor(props) {
        super(props);

        this.deleteGroup = this.deleteGroup.bind(this);
        this.hideDeleteModal = this.hideDeleteModal.bind(this);
        this.hideEditUsergroupModal = this.hideEditUsergroupModal.bind(this);
        this.onAccordionClickDelete = this.onAccordionClickDelete.bind(this);
        this.onAccordionClickEdit = this.onAccordionClickEdit.bind(this);
        this.onSave = this.onSave.bind(this);
        this.renderAccordions = this.renderAccordions.bind(this);
        this.renderDeleteModal = this.renderDeleteModal.bind(this);
        this.renderEditGroupModal = this.renderEditGroupModal.bind(this);
        this.renderTable = this.renderTable.bind(this);
        this.renderConfirmDeleteDialog = this.renderConfirmDeleteDialog.bind(this);
        this.updateGroupNameMatch = this.updateGroupNameMatch.bind(this);
        this.getGroupNameMatchRegExp = this.getGroupNameMatchRegExp.bind(this);
        this.renderNoGroupMatch = this.renderNoGroupMatch.bind(this);
        this.accordionGroupRef = null;

    }

    onSave(name) {
        return this.state.groupToEdit ?
            this.updateGroup(name) :
            this.createNewGroup(name);
    }

    createNewGroup(name) {
        const { accountId, createUsergroup } = this.props;
        createUsergroup.mutate({ accountId, name });
    }

    deleteGroup() {
        const { accountId, deleteUsergroup } = this.props;
        const { usergroupFacingRemoval } = this.state;
        deleteUsergroup.mutate({ accountId, groupId: usergroupFacingRemoval.id });
        this.hideDeleteModal();
    }

    updateGroup(name) {
        const { accountId, updateUsergroup } = this.props;
        const { groupToEdit } = this.state;
        updateUsergroup.mutate({ accountId, groupId: groupToEdit.id, name });
    }

    updateGroupNameMatch(groupNameMatch) {
        if (this.accordionGroupRef) {
            this.accordionGroupRef.closeAll(
                () => this.setState({ groupNameMatch })
            );
            // if no results before, also react to change search term
        } else {
            this.setState({ groupNameMatch });
        }
    }

    getGroupNameMatchRegExp() {
        const { groupNameMatch } = this.state;
        try {
            const regexp = new RegExp(groupNameMatch, "i");
            return regexp;
        } catch (e) {
            return "";
        }
    }

    sortByGroupName(a, b) {
        if (a.name.toLowerCase() < b.name.toLowerCase()) {
            return -1;
        }

        if (a.name.toLowerCase() > b.name.toLowerCase()) {
            return 1
        }

        return 0;
    }

    editTitle(usergroup) {
        this.setState({
            editUsergroupModalShowing: true,
            groupToEdit: usergroup,
        })
    }

    removeUsergroup(group) {
        this.setState({
            usergroupFacingRemoval: group,
        })
    }

    hideDeleteModal() {
        this.setState({
            usergroupFacingRemoval: undefined,
        });
    }

    showEditUsergroupModal() {
        this.setState({
            editUsergroupModalShowing: true,
        });
    }

    hideEditUsergroupModal() {
        this.setState({
            editUsergroupModalShowing: false,
            groupToEdit: undefined
        });
    }

    onAccordionClickDelete(usergroup) {
        return e => {
            e.stopPropagation();
            this.removeUsergroup(usergroup);
        };
    }

    onAccordionClickEdit(usergroup) {
        return e => {
            e.stopPropagation();
            this.editTitle(usergroup);
        };
    }

    buildAccordionHeader(usergroup) {
        const { name, isReadonly } = usergroup;
        const [onEdit, onDelete, iconColor, hoverColor] = isReadonly ?
            [e => e.stopPropagation(), e => e.stopPropagation(), colors.disabledColor] :
            [this.onAccordionClickEdit(usergroup), this.onAccordionClickDelete(usergroup), colors.iconDefaultColor, colors.accentColor];
        return (
            <div className={cx("header", { "header--disabled": !!isReadonly })}>
                <label className="header-groupname">{name}</label>
                {this.state.activeAccount?.amIAdmin && (
                    <div className="header-cta">
                        <span onClick={onEdit}>
                            {ModeEdit({ fontSize: 19 }, hoverColor, iconColor)}
                        </span>
                        <span onClick={onDelete}>
                            {Delete({ fontSize: 19 }, hoverColor, iconColor)}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    renderConfirmDeleteDialog({ name }, onClick, onHide) {
        const { t } = this.props;

        return (
            <Modal
                title={t(TK.User_ConfirmDeletion)}
                buttons={[
                    <Button text={t(TK.General_Ok)} secondary onClick={onClick} />,
                    <Button text={t(TK.General_Cancel)} onClick={onHide} />
                ]}
                onHide={onHide}
                onEnterKey={onClick}
                onEscapeKey={onHide}
            >
                <div>
                    {t(TK.User_ConfirmGroupDeletionMessage)} <strong>{name}</strong>?<br />
                    {t(TK.User_ConfirmGroupDeletionMessageSecondLine)}
                </div>
            </Modal>
        )
    }

    renderNoGroupMatch() {
        const { t } = this.props;
        const { groupNameMatch } = this.state;

        return (
            <div className="no-match">
                <h3>{t(TK.User_NoUserGroupMatch, { query: groupNameMatch })}</h3>
            </div>
        );
    }

    renderAccordions(usergroupMembers, filteredUserGroups) {
        const { accountId, users } = this.props;
        const { adminUserGroup } = this.state;

        return filteredUserGroups.map(usergroup => (
            <Accordion
                key={usergroup.id}
                header={this.buildAccordionHeader(usergroup)}
                className="usergroup-accordion"
            >
                <UsergroupOrganizer
                    accountId={accountId}
                    usergroupId={usergroup.id}
                    usergroupName={usergroup.name}
                    users={users}
                    usergroupMembers={usergroupMembers.find(u => u.group.id === usergroup.id)}
                    adminUserGroup={adminUserGroup}
                />
            </Accordion>
        ));
    }

    renderDeleteModal() {
        const { usergroupFacingRemoval } = this.state;
        return !usergroupFacingRemoval ?
            <div /> :
            this.renderConfirmDeleteDialog(
                usergroupFacingRemoval,
                this.deleteGroup.bind(this),
                this.hideDeleteModal.bind(this),
            );
    }

    renderEditGroupModal() {
        const { editUsergroupModalShowing, groupToEdit } = this.state;
        return !editUsergroupModalShowing ?
            <div /> :
            (
                <EditUsergroup
                    onHide={this.hideEditUsergroupModal.bind(this)}
                    onSave={this.onSave.bind(this)}
                    group={groupToEdit}
                />
            );
    }

    renderTable() {
        const { t } = this.props;
        const { groupNameMatch } = this.state;
        const isLoading = this.props.usergroups.isLoading || this.props.usergroupMembers.isLoading;
        if (isLoading) {
            return (
                <Loader />
            );
        }
        const usergroups = this.props.usergroups.data ?? [];
        const usergroupMembers = this.props.usergroupMembers.data ?? [];

        const filteredUserGroups = usergroups
            .sort(this.sortByGroupName)
            .filter(ug => !ug.isAutoManaged)
            .filter(ug => !groupNameMatch || ug.name.match(this.getGroupNameMatchRegExp()));

        const usergroupsOverview = (groupNameMatch && filteredUserGroups.length === 0) ?
            this.renderNoGroupMatch() :
            (
                <AccordionGroup ref={r => this.accordionGroupRef = r} >
                    {this.renderAccordions(usergroupMembers, filteredUserGroups)}
                </AccordionGroup>
            );
        return (
            <DragDropContextProvider backend={HTML5Backend} >
                <div className="usergroups">
                    <div className="usergroups-cta">
                        {this.state.activeAccount?.amIAdmin ?
                            (
                                <Button
                                    text={t(TK.User_NewUserGroup)}
                                    onClick={this.showEditUsergroupModal.bind(this)}
                                />
                            ) :
                            <div></div>}
                        <SearchInput
                            onChange={this.updateGroupNameMatch.bind(this)}
                            placeholder={`${t(TK.General_Search)}...`}
                            value={groupNameMatch}
                        />
                    </div>
                    <div className="usergroups-overview">
                        {usergroupsOverview}
                    </div>
                </div>
            </DragDropContextProvider>
        );
    }

    render() {
        return (
            <div>
                {this.renderTable()}
                {this.renderEditGroupModal()}
                {this.renderDeleteModal()}
            </div>
        )
    }

}

const UsergroupsContainer = Container.create(fixES5FluxContainer(Usergroups));
const UsergroupsWithHooks = withHooks(UsergroupsContainer, () => {
    const usergroups = useGetAccountUsergroupsExcludingAutoManaged();
    const accountId = useActiveAccountId();
    return {
        createUsergroup: useCreateUsergroup(),
        deleteUsergroup: useDeleteUsergroup(),
        updateUsergroup: useUpdateUsergroup(),
        usergroupMembers: useGetMembersFromAllGroups(accountId, usergroups.data?.map(g => g.id) ?? []),
        usergroups,
        users: useAccountUsersOrEmpty(),
    }
});
export default withTranslation()(UsergroupsWithHooks);
