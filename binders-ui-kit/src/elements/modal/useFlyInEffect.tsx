import { CSSProperties, useEffect, useState } from "react";
import { MobileViewOptions } from ".";
import { isMobileView } from "../../helpers/rwd";

export default function useFlyInEffect(mobileViewOptions?: MobileViewOptions): { modalStyle: CSSProperties, flyout: () => Promise<void> } {
    const [top, setTop] = useState(mobileViewOptions?.flyFromBottom ? "100vh" : 0);
    useEffect(() => {
        const timeout = setTimeout(() => {
            setTop(0);
        }, 0);
        return () => clearTimeout(timeout);
    }, [mobileViewOptions]);

    const flyout = async () => {
        setTop(mobileViewOptions?.flyFromBottom ? "100vh" : 0);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
    };

    if (!mobileViewOptions?.flyFromBottom || !isMobileView()) {
        return {
            modalStyle: {},
            flyout,
        };
    }

    return {
        modalStyle: {
            position: "relative",
            transition: "top .3s ease",
            top,
        },
        flyout,
    };
}