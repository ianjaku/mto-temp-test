import * as React from "react";
import { FC, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const Portal: FC<{
    elementId: string;
}> = ({ children, elementId }) => {
    const [element, setElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setElement(document.getElementById(elementId));
    }, [elementId]);

    return (
        element &&
        createPortal(
            children,
            element
        )
    );
};

export const PageTitlePortal: FC = ({ children }) => (
    <Portal elementId='portal-page-title'>
        {children}
    </Portal>
);

export const PageActionsPortal: FC = ({ children }) => (
    <Portal elementId='portal-page-actions'>
        {children}
    </Portal>
);

