import * as mongoose from "mongoose";
import { uniq, without } from "ramda";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";

export interface IRole extends mongoose.Document {
    roleId: string;
    name: string;
    permissions: [{name: PermissionName}];
    accountId?: string;
    isBuiltin: boolean;
    isDefault: boolean;
    description?: string;
}

export class Role {
    public pluralName: string;
    constructor(
        public roleId: string,
        public name: string,
        public permissions: PermissionName[],
        public isBuiltin: boolean = false,
        public isDefault: boolean = false,
        public accountId?: string,
        public description: string = "",
    ) {
        this.pluralName = `${name}s`;
    }

    addPermission(permissionNames: PermissionName[]): Role {
        const newPermissions = uniq([...permissionNames, ...this.permissions]);
        return new Role(this.roleId, this.name, newPermissions, this.isBuiltin, this.isDefault, this.accountId, this.description);
    }
    removePermission(permissionNames: PermissionName[]): Role {
        const newPermissions = without(permissionNames, this.permissions);
        return new Role(this.roleId, this.name, newPermissions, this.isBuiltin, this.isDefault, this.accountId, this.description);

    }
}
