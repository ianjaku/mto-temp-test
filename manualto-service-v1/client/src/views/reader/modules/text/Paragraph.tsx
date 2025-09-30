import * as React from "react";
import { VerticalCenter } from "./VerticalCenter";
import { useMemo } from "react";
import "@binders/ui-kit/lib/style/AttentionBlock.styl";

interface IParagraphProps {
    html: string
    imageViewportDims: { width: number | undefined, height: number | undefined };
    isVerticallyCentered: boolean;
    minPadding: number;
    onMouseUp: (e: React.MouseEvent) => void;
    prefix?: React.ReactNode;
    textModuleHeight?: number;
}

export const adjustToPixelRatio = (dim: number): number => dim * (window.devicePixelRatio || 1);
export const backToPixelValue = (dim: number): number => dim / (window.devicePixelRatio || 1);

export const Paragraph: React.FC<IParagraphProps> = ({
    html, onMouseUp, isVerticallyCentered, minPadding, imageViewportDims, prefix,
}) => {
    const htmlToRender = useMemo(() => {
        return html.replace(/font-size: (\d+)(\.\d+)?rem/g, "font-size: $1$2em");
    }, [html]);

    return (
        <VerticalCenter
            isVerticallyCentered={isVerticallyCentered}
            minPadding={minPadding}
            imageViewportHeight={imageViewportDims.height}
            onMouseUp={onMouseUp}
            className="chunk-html"
        >
            {prefix ?? ""}
            <div dangerouslySetInnerHTML={{ __html: htmlToRender }} />
        </VerticalCenter>
    );
}
