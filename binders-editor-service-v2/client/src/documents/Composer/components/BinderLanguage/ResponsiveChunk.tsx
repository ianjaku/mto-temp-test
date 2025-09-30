import * as React from "react";
import Chunk from "./Chunk";
import { FC } from "react";
import MobileChunk from "./MobileChunk";
import { useComposerProps } from "../../contexts/composerPropsContext";

export const ResponsiveChunk: FC<{
    className?: string;
}> = (props) => {
    const { className } = props;
    const { isMobile } = useComposerProps();
    return isMobile ?
        <MobileChunk className={className} /> :
        <Chunk className={className} />
}
