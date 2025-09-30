import { HideRibbonFunction, ShowRibbonFunction, ribbonsContext } from "./RibbonsView";
import { useContext } from "react";


export const useShowRibbon = (): ShowRibbonFunction => {
    const context = useContext(ribbonsContext);
    return context?.showRibbon;
}

export const useHideRibbon = (): HideRibbonFunction => {
    const context = useContext(ribbonsContext);
    return context?.hideRibbon;
}

export const useRibbonsBottomHeight = (): number => {
    const context = useContext(ribbonsContext);
    return context?.ribbonsBottomHeight ?? 0;
}

export const useRibbonsTopHeight = (): number => {
    const context = useContext(ribbonsContext);
    return context?.ribbonsTopheight ?? 0;
}
