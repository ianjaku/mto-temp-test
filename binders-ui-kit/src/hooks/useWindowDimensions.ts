import { useEffect, useState } from "react";

export interface WindowDimensions {
    height: number;
    width: number;
}

export const useWindowDimensions = (): WindowDimensions => {
    const [ windowDimensions, setWindowDimensions ] = useState<WindowDimensions>({
        height: window.innerHeight,
        width: window.innerWidth,
    });

    useEffect(() => {
        const resizeHandler = () => {
            setWindowDimensions({ height: window.innerHeight, width: window.innerWidth });
        };
        window.addEventListener("resize", resizeHandler);
        return () => {
            window.removeEventListener("resize", resizeHandler);
        };
    }, []);

    return windowDimensions;
};