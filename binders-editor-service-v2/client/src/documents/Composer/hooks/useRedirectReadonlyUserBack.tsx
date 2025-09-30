import * as React from "react";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { usePermissionFlags } from "./usePermissionFlags";

export const useRedirectReadonlyUserBack = (binderId: string, collectionId: string, redirectUserBack: () => void) => {
    const permissionFlags = usePermissionFlags(binderId, collectionId);
    const handled = React.useRef(false);
    React.useEffect(() => {
        if (handled.current) return;
        if (permissionFlags.some(flag => flag.permissionName === PermissionName.VIEW && !(permissionFlags.some(f => f.permissionName === PermissionName.EDIT)))) {
            handled.current = true;
            redirectUserBack();
        }
    }, [permissionFlags, redirectUserBack]);
}