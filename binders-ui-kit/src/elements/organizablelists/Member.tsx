import * as React from "react";
import Tooltip, { TooltipPosition, hideTooltip, showTooltip } from "../tooltip/Tooltip";
import { DragSource } from "react-dnd";
import { IMember } from "./index";
import "./organizablelists.styl";

export interface IDraggableMemberProps {
    member: IMember;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connectDragSource: (children) => React.ReactElement<any>;
    dropTargetId: number | string;
    tooltip?: string;
}

const memberSource = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    beginDrag(props, dnd, element) {
        props.onBeginDrag(props.dropTargetId);
        return {
            dropTargetId: props.dropTargetId,
            member: props.member,
        };
    },
    endDrag(props, monitor) {
        const dropResult = monitor.getDropResult();
        const targetDropTargetId = dropResult ? dropResult.dropTargetId : props.dropTargetId;
        props.onEndDrag(props.dropTargetId, targetDropTargetId, props.member);
    },
};

const collect = (connect, monitor) => {
    return {
        connectDragPreview: connect.dragPreview(),
        connectDragSource: connect.dragSource(),
        isDragging: monitor.isDragging(),
    };
};

const Member: React.FunctionComponent<IDraggableMemberProps> = (props) => {
    const { connectDragSource, tooltip, member } = props;
    const tooltipRef = React.useRef(null);

    const onTooltipShow = (e) => showTooltip(e, tooltipRef.current, TooltipPosition.TOP);
    const onTooltipHide = (e) => hideTooltip(e, tooltipRef.current);

    return connectDragSource(
        <div
            className="organizable-lists-body-column-list-item"
            onMouseEnter={onTooltipShow}
            onMouseLeave={onTooltipHide}
        >
            <span onBlur={onTooltipHide}>{member.name}</span>
            <div onMouseEnter={onTooltipHide}>
                <Tooltip ref={tooltipRef} message={tooltip} />
            </div>
        </div>
    );
};

export default DragSource("member", memberSource, collect)(Member);
