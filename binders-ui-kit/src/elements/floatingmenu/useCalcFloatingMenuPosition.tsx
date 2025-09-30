import * as React from "react";
import { useEffect } from "react";

function useCalcFloatingMenuPosition(
    elRef: React.RefObject<HTMLElement>,
): { left: number | undefined, top: number | undefined } {
    const [inputBoundingClientRect, setInputBoundingClientRect] = React.useState<DOMRect>();

    useEffect(() => {
        setTimeout(() => {
            setInputBoundingClientRect(elRef?.current?.getBoundingClientRect());
        }, 0);
    }, [elRef]);

    return {
        left: inputBoundingClientRect?.left,
        top: inputBoundingClientRect?.top,
    }
}

export default useCalcFloatingMenuPosition;