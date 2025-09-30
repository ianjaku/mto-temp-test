import * as React from "react";
import { IPermissionFlag } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { calculatePermissionFlags } from "../../../authorization/tsHelpers";
import { useBrowsePathsOrDefault } from "../../../browsing/hooks";
import { useMyPermissionMap } from "../../../authorization/hooks";

export const usePermissionFlags = (binderId: string, collectionId: string) => {
    const { data: permissionMap } = useMyPermissionMap();
    const breadcrumbsPaths = useBrowsePathsOrDefault(null);
    const permissionFlagsExtraItemIds = React.useMemo(() => [binderId, collectionId].filter(item => item), [binderId, collectionId]);
    const [ permissionFlags, setPermissionFlags ] = React.useState<IPermissionFlag[]>([]);
    React.useEffect(() => {
        if (!breadcrumbsPaths || !permissionMap) {
            return;
        }
        const newFlags = calculatePermissionFlags(breadcrumbsPaths, permissionMap, permissionFlagsExtraItemIds);
        setPermissionFlags(newFlags);
    }, [breadcrumbsPaths, permissionFlagsExtraItemIds, permissionMap]);
    return permissionFlags;
};