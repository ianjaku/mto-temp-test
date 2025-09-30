import { extractItemFromBreadcrumbsPaths } from "../../browsing/helper";
import { useBrowsePathsOrDefault } from "../../browsing/hooks";
import { useMemo } from "react";

export function useActiveItem() {
    const breadcrumbsPaths = useBrowsePathsOrDefault([[]]);
    return useMemo(() => {
        if (!breadcrumbsPaths) return null;
        const [firstPath] = [...breadcrumbsPaths[0]].reverse();
        const activeItemId = firstPath && firstPath.id;
        const activeItem = activeItemId && extractItemFromBreadcrumbsPaths(
            breadcrumbsPaths,
            activeItemId,
        );
        return activeItem;
    }, [breadcrumbsPaths]);
}

