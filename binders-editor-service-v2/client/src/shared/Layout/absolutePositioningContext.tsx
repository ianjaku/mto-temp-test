import * as React from "react";
import { useRef } from "react";
import "./absolutePositioningContext.styl";

type AbsolutePositioningContextType = {
    absolutePositioningTarget?: HTMLElement;
};

export const AbsolutePositioningContext = React.createContext<AbsolutePositioningContextType>({
    absolutePositioningTarget: undefined,
});

type Props = {
    children: React.ReactNode;
};

export const AbsolutePositioningContextProvider = ({ children }: Props): React.ReactElement => {

    const ref = useRef<HTMLDivElement>(null);

    return (
        <AbsolutePositioningContext.Provider value={{ absolutePositioningTarget: ref?.current }}>
            <>
                <div ref={ref} id="absolutePositioningTarget">
                </div>
                {children}
            </>
        </AbsolutePositioningContext.Provider>
    );
};

export const useAbsolutePositioningContext = (): AbsolutePositioningContextType => React.useContext(AbsolutePositioningContext);
