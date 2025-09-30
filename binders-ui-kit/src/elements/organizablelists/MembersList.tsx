import * as React from "react";
import { DropTarget } from "react-dnd";
import { IMember } from "./index";
import Member from "./Member";
import SearchInput from "../input/SearchInput";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n";
import "./organizablelists.styl";

export interface IMemberProps {
    members: IMember[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connectDropTarget: (children) => React.ReactElement<any>;
    dropTargetId: number | string;
    onBeginDrag: (dropTargetId) => void;
    onEndDrag: (dropTargetId, targetId, member) => void;
}

export interface IMemberState {
    members: IMember[];
    filteredMembers: IMember[];
    query?: string;
}

const memberListTarget = {
    canDrop(props, monitor) {
        return monitor.getItem().dropTargetId !== props.dropTargetId;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    drop(props, monitor) {
        return {
            dropTargetId: props.dropTargetId,
            member: props.member,
        };
    },
};

const collect = (connect, monitor) => {
    return {
        canDrop: monitor.canDrop(),
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        monitor,
    };
};


class MembersList extends React.Component<IMemberProps, IMemberState> {

    public static getDerivedStateFromProps(nextProps, prevState) {
        if (prevState.members.length !== nextProps.members.length) {
            return { members: nextProps.members, filteredMembers: [], query: "" };
        }
        return prevState;
    }

    constructor(props: IMemberProps) {
        super(props);
        this.getDisplayedMembers = this.getDisplayedMembers.bind(this);
        this.onEndDrag = this.onEndDrag.bind(this);
        this.onSearch = this.onSearch.bind(this);
        this.state = {
            filteredMembers: [],
            members: props.members,
            query: "",
        };
    }

    public componentDidUpdate(_, prevState) {
        const { filteredMembers, query } = prevState;
        if (filteredMembers.length > 0 && this.state.filteredMembers.length === 0) {
            this.onSearch(query);
        }
    }

    public render() {
        const { connectDropTarget, onBeginDrag, dropTargetId } = this.props;
        const displayedMembers = this.getDisplayedMembers();
        return connectDropTarget(
            <div className="organizable-lists-body-column-list">
                <SearchInput
                    onChange={this.onSearch}
                    placeholder={`${i18next.t(TranslationKeys.General_Search)}...`}
                />
                {displayedMembers.map(member => (
                    <Member
                        key={member.id}
                        member={member}
                        dropTargetId={dropTargetId}
                        onBeginDrag={onBeginDrag}
                        onEndDrag={this.onEndDrag}
                        tooltip={member.login}
                    />
                ))}
            </div>,
        );
    }

    private onEndDrag(dropTargetId, targetId, member) {
        const { query } = this.state;
        this.props.onEndDrag(dropTargetId, targetId, member);
        this.onSearch(query);
    }

    private getDisplayedMembers() {
        const { filteredMembers, members, query } = this.state;
        if (query.length > 0 && filteredMembers.length === 0) {
            return [];
        }
        return filteredMembers.length === 0 ? members : filteredMembers;
    }

    private onSearch(query) {
        const { members } = this.props;
        const q = query.length > 0 ? query.toLowerCase() : false;
        const filteredMembers = !query ?
            members :
            members.filter(
                m => m.name.toLowerCase().indexOf(q) >= 0,
            );
        this.setState({ filteredMembers, query });
    }
}

export default (DropTarget("member", memberListTarget, collect)(MembersList));
