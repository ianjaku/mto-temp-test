import React, { useEffect, useMemo, useRef, useState } from "react";
import { isLandscape } from "../../../../utils/viewport";
import { useWindowSize } from "../../../../utils/hooks/useWindowSize";

export const adjustToPixelRatio = (dim: number): number => dim * (window.devicePixelRatio || 1);
export const backToPixelValue = (dim: number): number => dim / (window.devicePixelRatio || 1);

type VerticalCenterProps = {
    children: React.ReactNode;
    isVerticallyCentered: boolean;
    minPadding: number;
    imageViewportHeight?: number;
    onMouseUp?: (e: React.MouseEvent) => void;
    className?: string;
}

export const VerticalCenter = ({
    children,
    isVerticallyCentered,
    minPadding,
    imageViewportHeight,
    onMouseUp,
    className = "",
}: VerticalCenterProps) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [paddingTop, setPaddingTop] = useState(0);
    const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
    const errorTolerance = 5;

    const windowSize = useWindowSize();

    const availableSpace = useMemo(() => {
        const windowInnerHeightPxRatio = adjustToPixelRatio(windowSize.height);
        return isLandscape() ? windowInnerHeightPxRatio : windowInnerHeightPxRatio - (imageViewportHeight || 0);
    }, [windowSize, imageViewportHeight]);

    useEffect(() => {
        const height = contentRef.current?.clientHeight;
        if (height !== undefined && (contentHeight === undefined || Math.abs(height - contentHeight) > errorTolerance)) {
            setContentHeight(adjustToPixelRatio(height));
        }
    }, [contentHeight, children]);

    useEffect(() => {
        if (!isVerticallyCentered || !availableSpace || !contentHeight) {
            setPaddingTop(0);
            return;
        }
        const minPaddingPxRatio = adjustToPixelRatio(minPadding);
        const proposedPadding = (availableSpace / 2) - (contentHeight / 2);
        const padding = Math.max(minPaddingPxRatio, proposedPadding);
        const properPadding = Math.floor(backToPixelValue(padding));
        if (Math.abs(paddingTop - properPadding) > 2) {
            setPaddingTop(properPadding);
        }
    }, [availableSpace, contentHeight, isVerticallyCentered, minPadding, paddingTop]);

    return (
        <div
            className={className}
            onMouseUp={onMouseUp}
            dir="auto"
            style={{ paddingTop }}
        >
            <div ref={contentRef}>
                {children}
            </div>
        </div>
    );
};
