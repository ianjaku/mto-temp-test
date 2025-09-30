import * as React from "react";
import { DragDropContext, DragStart, DropResult, ResponderProvided } from "react-beautiful-dnd";

interface IComposerDragDropContextProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    breadcrumbsPaths?: any; // injected by Layout
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    browseContext?: any; // injected by Layout
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    permissionFlags?: any; // injected by Layout
    canIAdmin?: boolean; // injected by Layout
    onDragEnd: (result: DropResult, provided: ResponderProvided) => void;
    onDragStart: (start: DragStart, provided: ResponderProvided) => void;
}

const ComposerDragDropContext: React.FC<IComposerDragDropContextProps> = (props: IComposerDragDropContextProps) => {
    const { children, breadcrumbsPaths, browseContext, canIAdmin, permissionFlags, onDragEnd, onDragStart } = props;

    const toRender = React.useMemo(() => {
        return React.Children.map(children, child =>
            React.cloneElement(child, { breadcrumbsPaths, browseContext, permissionFlags, canIAdmin }),
        );
    }, [children, breadcrumbsPaths, browseContext, canIAdmin, permissionFlags]);

    return (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            {toRender}
        </DragDropContext>
    )
}

export default ComposerDragDropContext;
