import { CSSProperties, useEffect, useState } from "react";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";

export default function useFlyInEffect(): { modalStyle: CSSProperties, flyout: () => Promise<void> } {
    const [bottom, setBottom] = useState("-100vh");
    useEffect(() => {
        const timeout = setTimeout(() => {
            setBottom("0");
        }, 0);
        return () => clearTimeout(timeout);
    }, []);

    const flyout = async () => {
        setBottom("-100vh");
        await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
    };

    if (!isMobileView()) {
        return {
            modalStyle: {},
            flyout,
        };
    }

    return {
        modalStyle: {
            transition: "bottom .3s ease",
            bottom,
        },
        flyout,
    };
}