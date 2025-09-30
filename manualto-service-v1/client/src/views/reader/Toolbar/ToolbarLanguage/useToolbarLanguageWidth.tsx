import { useEffect, useState } from "react";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import vars from "../../../../vars.json";

interface ReturnType {
    width: string | number;
    isRenderedCollapsed: boolean; // gets set after a delay as an effect of isCollapsed, used in slide open animation
}

const PSEUDO_EXPANDED_WIDTH = 150;

export const useToolbarLanguageWidth = (
    isCollapsed: boolean,
    shouldDisplayGlobeAndCode: boolean
): ReturnType => {

    const toolbarLanguageCollapsedWidth = shouldDisplayGlobeAndCode ?
        vars.toolbarLanguageDefaultCollapsedWidth : // explicit width in px required for css transition (based on natural width of the content)
        "auto";

    const [width, setWidth] = useState<string | number>(toolbarLanguageCollapsedWidth);

    const [isRenderedCollapsed, setIsRenderedCollapsed] = useState(true);
    const prevIsCollapsed = usePrevious(isCollapsed);
    useEffect(() => {
        if (prevIsCollapsed === undefined) {
            return;
        }
        if (!isCollapsed && prevIsCollapsed) {
            setWidth(PSEUDO_EXPANDED_WIDTH);
            setTimeout(() => {
                setIsRenderedCollapsed(false);
                setWidth("auto");
            }, 150);
        }
        if (isCollapsed && !prevIsCollapsed) {
            setIsRenderedCollapsed(true);
            setWidth(toolbarLanguageCollapsedWidth);
        }
    }, [isCollapsed, prevIsCollapsed, toolbarLanguageCollapsedWidth]);

    return {
        width,
        isRenderedCollapsed
    }

}