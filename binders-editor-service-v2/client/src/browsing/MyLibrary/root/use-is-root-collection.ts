import { rootCollectionContext } from "./rootCollectionContext";
import { useContext } from "react";

export function useIsRootCollection(): boolean {
    return useContext(rootCollectionContext);
}
