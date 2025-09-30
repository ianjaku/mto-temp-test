import * as React from "react";
import Button from "../button";
import Checkbox from "../checkbox";
import MembersList from "./MembersList";
import Modal from "../modal";
import Table from "../Table/SimpleTable";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import autobind from "class-autobind";
import cx from "classnames";
import i18next from "@binders/client/lib/react/i18n";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./organizablelists.styl";

export interface IOrganizableListsProps {
    leftMembers: IMember[];
    rightMembers: IMember[];
    onMoveMember: (member, dropTargetId) => void;
    leftMembersId?: string;
    rightMembersId?: string;
    leftMembersTitle?: string;
    leftMembersDropMessage?: string;
    rightMembersTitle?: string;
    rightMembersDropMessage?: string;
}

export interface IOrganizableListsState {
    draggingSource: string;
    isChooseUsersModalOpen: boolean;
    selectedUsers: Array<{id}>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersData: any;
}

export interface IMember {
    name: string;
    id: string | number;
    login?: string;
}

class OrganizableLists extends React.Component<IOrganizableListsProps, IOrganizableListsState> {

    public static defaultProps: Partial<IOrganizableListsProps> = {
        leftMembers: [],
        leftMembersDropMessage: i18next.t(TranslationKeys.User_DropMemberHere),
        leftMembersId: "left",
        leftMembersTitle: i18next.t(TranslationKeys.User_Members).toUpperCase(),
        rightMembers: [],
        rightMembersDropMessage: i18next.t(TranslationKeys.User_DropMemberHere),
        rightMembersId: "right",
        rightMembersTitle: i18next.t(TranslationKeys.User_NonMembers).toUpperCase(),
    };

    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        autobind(this, OrganizableLists.prototype);
        this.state = {
            draggingSource: undefined,
            isChooseUsersModalOpen: false,
            selectedUsers: [],
            usersData: props.rightMembers,
        };
    }

    public render() {
        const { leftMembers, leftMembersDropMessage, leftMembersId, leftMembersTitle, rightMembers, rightMembersDropMessage, rightMembersId, rightMembersTitle } = this.props;
        const { draggingSource, isChooseUsersModalOpen } = this.state;

        return (
            <div className="organizable-lists">
                {isChooseUsersModalOpen && this.renderChooseUserModal()}
                <div className="organizable-lists-header">
                    <div className="organizable-lists-header-column">
                        {leftMembersTitle}
                    </div>
                    <div className="organizable-lists-header-column">
                        {rightMembersTitle}
                        <div className="organizable-lists-header-column-button">
                            <Button onClick={this.onOpenChooseUsersModal} text={this.t(TranslationKeys.General_AddMany)} />
                        </div>
                    </div>
                </div>
                <div className="organizable-lists-body">
                    <div className={cx("organizable-lists-body-column", { "drop-active": draggingSource === rightMembersId })}>
                        <label className="organizable-lists-body-column-dropmessage">{leftMembersDropMessage}</label>
                        <MembersList members={leftMembers} dropTargetId={leftMembersId} onBeginDrag={this.onBeginDrag} onEndDrag={this.onEndDrag} />
                    </div>
                    <div className={cx("organizable-lists-body-column", { "drop-active": draggingSource === leftMembersId })}>
                        <label className="organizable-lists-body-column-dropmessage">{rightMembersDropMessage}</label>
                        <MembersList members={rightMembers} dropTargetId={rightMembersId} onBeginDrag={this.onBeginDrag} onEndDrag={this.onEndDrag} />
                    </div>
                </div>
            </div>
        );
    }

    private onBeginDrag(dropTargetId) {
        this.setState({
            draggingSource: dropTargetId,
        });
    }

    private onEndDrag(sourceDropTargetId, targetDropTargetId, member) {
        this.setState({
            draggingSource: undefined,
        });
        if (sourceDropTargetId !== targetDropTargetId) {
            this.props.onMoveMember(member, targetDropTargetId);
        }
    }

    private onOpenChooseUsersModal() {
        this.setState({
            isChooseUsersModalOpen: true,
            usersData: this.props.rightMembers,
        });
    }

    private onModalHide() {
        this.setState({
            isChooseUsersModalOpen: false,
            usersData: this.props.rightMembers,
        });
    }

    private onAddChosenUsers() {
        this.state.selectedUsers.map(member => this.props.onMoveMember(member, this.props.leftMembersId));
        this.setState({
            selectedUsers: [],
            isChooseUsersModalOpen: false,
            usersData: this.props.rightMembers,
        });
    }

    private onToggleUser(user) {
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

    private onTableSearch(query) {
        const q = query.length > 0 ? query.toLowerCase() : false;
        const filteredData = this.props.rightMembers.reduce((out, column) => {

            const hasMatch = Object.keys(column).map(k => column[k]).findIndex(field => (
                (typeof field === "string") &&
                field.toLowerCase().indexOf(q) >= 0
            )) >= 0;
            if (hasMatch || !q) {
                out.push(column);
            }
            return out;
        }, []);
        this.setState({
            usersData: filteredData,
        });
    }

    private renderChooseUserModal() {
        const usersData = this.state.usersData.map((u) => {
            return [
                <Checkbox
                    key={u.id}
                    onCheck={this.onToggleUser(u).bind(this)}
                    label=""
                    checked={this.state.selectedUsers.some(({ id }) => id === u.id)}
                />,
                u.name,
                u.login,
            ];
        });
        return (
            <Modal
                title={this.t(TranslationKeys.User_ChooseUsers)}
                onHide={this.onModalHide}
                buttons={[<Button key="cancel" secondary text={this.t(TranslationKeys.General_Cancel)} onClick={this.onModalHide} />,
                    <Button key="done" text={this.t(TranslationKeys.General_Choose)} onClick={this.onAddChosenUsers} />]}
                onEnterKey={this.onAddChosenUsers}
                onEscapeKey={this.onModalHide}
            >
                <Table
                    recordsPerPage={5}
                    customHeaders={["", this.t(TranslationKeys.User_UserName).toUpperCase(), this.t(TranslationKeys.User_Login).toUpperCase()]}
                    data={usersData}
                    searchable
                    onSearch={this.onTableSearch}
                />

            </Modal>
        )
    }

}

export default withTranslation()(OrganizableLists);
