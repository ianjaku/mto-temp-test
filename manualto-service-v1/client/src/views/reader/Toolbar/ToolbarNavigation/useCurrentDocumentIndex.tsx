import { IStoryWithTitle } from "../../../../binders/contract";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { useActiveViewable } from "../../../../stores/hooks/binder-hooks";
import { useMemo } from "react";

export const useCurrentDocumentIndex = (parentCollectionItems: IStoryWithTitle[] = []): number => {
    const activeViewable = useActiveViewable();
    return useMemo(() => {
        return parentCollectionItems.findIndex(({ key }) => (activeViewable as Publication).binderId === key);
    }, [activeViewable, parentCollectionItems]);
}
