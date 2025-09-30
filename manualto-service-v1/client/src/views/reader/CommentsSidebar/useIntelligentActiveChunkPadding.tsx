import {
    useActiveChunkElement,
    useSidebarWidth,
    useTextModuleStoreActions
} from "../../../stores/zustand/text-module-store";
import { MIN_CHUNK_ELEMENT_WIDTH } from "../modules/text/constants";
import { useEffect } from "react";
import { useIsLandscape } from "../../../stores/hooks/orientation-hooks";

/*
    Provide chunk padding based on the sidebar width,
    taking a minimum width into account, to remain readable
*/

export const useIntelligentActiveChunkPadding = (): void => {

    const { setActiveChunkPaddingRight } = useTextModuleStoreActions();
    const activeChunkElement = useActiveChunkElement();
    const isLandscape = useIsLandscape();
    const sidebarWidth = useSidebarWidth();

    useEffect(() => {
        if (!sidebarWidth || !isLandscape) return;
        const requestedTextModuleWidth = activeChunkElement.clientWidth - sidebarWidth;
        const paddingRight = (requestedTextModuleWidth < MIN_CHUNK_ELEMENT_WIDTH) ?
            0 :
            sidebarWidth;
        setActiveChunkPaddingRight(paddingRight);
        return () => {
            setActiveChunkPaddingRight(0);
        }
    }, [setActiveChunkPaddingRight, sidebarWidth, isLandscape, activeChunkElement]);



}
