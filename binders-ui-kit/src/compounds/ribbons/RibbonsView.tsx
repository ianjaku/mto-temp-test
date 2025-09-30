import * as React from "react";
import { ComponentType, FC, createContext, useEffect, useState } from "react";
import { useResizeObserver } from "@binders/client/lib/react/hooks/useResizeObserver";
import "./RibbonsView.styl";

export type RibbonPosition = "top" | "bottom";

export interface RibbonProps {
    hide: () => void
}

export interface RibbonOptions {
    position: RibbonPosition;
    hideOnRouteChange?: boolean; // defaults to false
    overwrite?: boolean; // defaults to false, if a ribbon with the given id already exists, it will remove the old ribbon and create a new one
}

export interface Ribbon extends RibbonOptions {
    id: string;
    component: ComponentType<RibbonProps>;
}

export type ShowRibbonFunction = (
    id: string, 
    options: RibbonOptions,
    component: ComponentType<RibbonProps>
) => void;

export type HideRibbonFunction = (id: string) => void;

export interface RibbonsContext {
    ribbonsTopheight: number;
    ribbonsBottomHeight: number;
    showRibbon: ShowRibbonFunction;
    hideRibbon: HideRibbonFunction;
}

export const ribbonsContext = createContext<RibbonsContext>({
    ribbonsTopheight: 0,
    ribbonsBottomHeight: 0,
    showRibbon: () => null,
    hideRibbon: () => null
});

export const RibbonsView: FC<{
    location: unknown,
    extraBottomRibbons?: ComponentType,
    extraTopRibbons?: ComponentType,
}> = ({
    location,
    extraBottomRibbons,
    extraTopRibbons,
    children
}) => {
    const [ribbons, setRibbons] = React.useState<Ribbon[]>([]);
    const [topHeight, setTopHeight] = useState(0);
    const [bottomHeight, setBottomHeight] = useState(0);

    // Hide ribbons that do not remain on route change, after route changes
    useEffect(() => {
        setRibbons(
            ribbons => ribbons.filter(r => r.hideOnRouteChange === false)
        );
    }, [location]);
    
    
    const topRibbonsEl = React.useRef(null);
    const bottomRibbonsEl = React.useRef(null);

    useResizeObserver(
        topRibbonsEl,
        (newDimensions) => {
            setTopHeight(newDimensions.heightPx);
        } 
    );

    useResizeObserver(
        bottomRibbonsEl,
        (newDimensions) => {
            setBottomHeight(newDimensions.heightPx);
        }
    );
    
    return (
        <>
            <ribbonsContext.Provider value={{
                ribbonsTopheight: topHeight,
                ribbonsBottomHeight: bottomHeight,
                showRibbon(id, options, component) {
                    const ribbon = {
                        id,
                        component,
                        position: options.position,
                        hideOnRouteChange: options.hideOnRouteChange ?? false
                    }
                    const ribbonWithSameIdAlreadyOpen = ribbons.some(r => r.id === ribbon.id);
                    if (ribbonWithSameIdAlreadyOpen && !options?.overwrite) return;
                    setRibbons(ribbons => {
                        if (ribbonWithSameIdAlreadyOpen) {
                            return ribbons.map(r => {
                                if (r.id !== ribbon.id) return r;
                                return ribbon;
                            });
                        } else {
                            return [...ribbons, ribbon];
                        }
                    })
                },
                hideRibbon(id) {
                    setRibbons(ribbons => ribbons.filter(r => r.id !== id));
                }
            }}>
                {children}
            </ribbonsContext.Provider>
            <div ref={topRibbonsEl} className="top-ribbons">
                {extraTopRibbons && React.createElement(extraTopRibbons)}
                {ribbons.filter(r => r.position === "top").map(ribbon => (
                    React.createElement(
                        ribbon.component,
                        {
                            key: ribbon.id,
                            hide: () => setRibbons(ribbons => ribbons.filter(r => r.id !== ribbon.id))
                        }
                    )
                ))}
            </div>
            <div ref={bottomRibbonsEl} className="bottom-ribbons">
                {extraBottomRibbons && React.createElement(extraBottomRibbons)}
                {ribbons.filter(r => r.position === "bottom").map(ribbon => (
                    React.createElement(
                        ribbon.component,
                        {
                            key: ribbon.id,
                            hide: () => setRibbons(ribbons => ribbons.filter(r => r.id !== ribbon.id))
                        }
                    )
                ))}
            </div>
        </>
    )
}
