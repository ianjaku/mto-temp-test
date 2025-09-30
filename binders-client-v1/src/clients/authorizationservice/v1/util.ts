import { PermissionName } from "./contract";

export function scorePermission(permission: PermissionName): number {
    switch (permission) {
        case PermissionName.ADMIN:
            return 1000;
        case PermissionName.PUBLISH:
            return 950;
        case PermissionName.REVIEW:
            return 925;
        case PermissionName.EDIT:
            return 900;
        case PermissionName.VIEW:
            return 800;
        default:
            return 0;
    }
}
