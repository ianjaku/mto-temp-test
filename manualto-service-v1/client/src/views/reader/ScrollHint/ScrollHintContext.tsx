import * as React from "react";
import { UseScrollHint, useScrollHint } from "./useScrollHint";
import { createContext, useContext } from "react";
import { useActiveChunkIndex } from "../../../stores/hooks/chunk-position-hooks";

type ScrollHintContext = {
    scrollHint?: UseScrollHint;
}

const scrollHintContext = createContext<ScrollHintContext>({ scrollHint: undefined })

export function useScrollHintFromContext() {
    const { scrollHint } = useContext(scrollHintContext);
    return scrollHint;
}

export function ScrollHintContextProvider({ children }: { children: React.ReactNode }) {
    const activeChunkIndex = useActiveChunkIndex();
    const scrollHint = useScrollHint(activeChunkIndex);
    return (
        <scrollHintContext.Provider
            value={{ scrollHint }}
        >
            {children}
        </scrollHintContext.Provider>
    );
}
