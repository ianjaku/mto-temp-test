import * as React from "react";
import { DragDropContext, Droppable } from "react-beautiful-dnd";
import { Draggable } from "react-beautiful-dnd";
const { useCallback, useMemo } = React;

interface IProps {
    onReorder: (startIndex: number, endIndex: number) => void;
    children: React.ReactNode[];
}

const Sortable: React.FC<IProps> = ({
    onReorder,
    children,
}) => {

    const type = useMemo(() => `${Math.random()}`, []);

    const onDragEnd = useCallback((result) => {
        if (!result.destination) {
            return;
        }
        onReorder(result.source.index, result.destination.index);
    }, [onReorder]);

    const renderDraggableChild = useCallback((child, i) => {
        return (
            <Draggable key={`dr${i}`} draggableId={`draggable-${i}`} index={i}>
                {(provided) => (
                    <div
                        key="data"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{ ...provided.draggableProps.style, zIndex: 1000 }}
                    >
                        {child}
                    </div>
                )}
            </Draggable>
        )
    }, []);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="droppable" type={type}>
                {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {children.map(renderDraggableChild)}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    )
}

export default Sortable;