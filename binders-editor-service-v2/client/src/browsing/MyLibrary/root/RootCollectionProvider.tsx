import * as React from "react";
import { rootCollectionContext } from "./rootCollectionContext";

export const RootCollectionProvider: React.FC<{ children: React.ReactNode, value?: boolean }> = (
    { children, value = true }
) => {
    return (
        <rootCollectionContext.Provider value={value}>
            {children}
        </rootCollectionContext.Provider>
    )
}
