import * as mongoose from "mongoose";
import {
    ADMIN_ROLE_ID,
    CONTRIBUTOR_ROLE_ID,
    EDITOR_ROLE_ID,
    READER_ROLE_ID,
    REVIEWER_ROLE_ID,
} from "@binders/binders-service-common/lib/authorization/role";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { IRole, Role } from "../models/roles";
import {
    MongoRepository,
    MongoRepositoryFactory
} from "@binders/binders-service-common/lib/mongo/repository";
import {
    PermissionName,
    RoleNotFoundException
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Config } from "@binders/client/lib/config/config";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { addTimestampMiddleware } from "@binders/binders-service-common/lib/mongo/schema";

const roleModelToDao = (role: Role): IRole => {
    return <IRole>{
        roleId: role.roleId,
        name: role.name,
        accountId: role.accountId,
        permissions: role.permissions.map(name => ({ name })),
        isBuiltin: role.isBuiltin,
        isDefault: role.isDefault,
        description: role.description,
    };
};


const roleDaoToModel = (role: IRole): Role => {
    return <Role>{
        roleId: role.roleId,
        name: role.name,
        accountId: role.accountId,
        permissions: role.permissions.map(({ name }) => name),
        isBuiltin: role.isBuiltin,
        isDefault: role.isDefault,
        description: role.description,
        pluralName: `${role.name}s`,
    };
};

export const builtInRoles = {
    admins: new Role(
        ADMIN_ROLE_ID,
        "Admin",
        [PermissionName.ADMIN, PermissionName.EDIT, PermissionName.VIEW, PermissionName.PUBLISH, PermissionName.REVIEW],
        true,
        false,
        undefined,
    ),
    editors: new Role(
        EDITOR_ROLE_ID,
        "Editor",
        [PermissionName.PUBLISH, PermissionName.EDIT, PermissionName.VIEW, PermissionName.REVIEW],
        true,
        false,
        undefined,
    ),
    reviewers: new Role(
        REVIEWER_ROLE_ID,
        "Reviewer",
        [PermissionName.REVIEW, PermissionName.EDIT, PermissionName.VIEW],
        true,
        false,
        undefined,
    ),
    contributors: new Role(
        CONTRIBUTOR_ROLE_ID,
        "Contributor",
        [PermissionName.EDIT, PermissionName.VIEW],
        true,
        false,
        undefined,
    ),
    readers: new Role(
        READER_ROLE_ID,
        "Reader",
        [PermissionName.VIEW],
        true,
        true,
        undefined,
    )
};

export const builtInRolesArray = Object.keys(builtInRoles).map((r) => builtInRoles[r]);


export interface IRoleRepository {
    saveRole(role: Role): Promise<Role>;
    deleteRole(roleId): Promise<void>;
    updateRole(toUpdate: Role, roleId: string): Promise<Role>;
    getRoleById(roleId: string): Promise<Role>;
    allRolesForAccount(accountId: string): Promise<Role[]>;
    accountCustomRoles(accountId: string): Promise<Role[]>;
    addPermissionToRole(roleId: string, permissions: PermissionName[]): Promise<Role>;
    removePermissionFromRole(roleId: string, permissions: PermissionName[]): Promise<Role>;
    getDefaultRole(accountId): Promise<Role>;
    deleteAllForAccount(accountId: string): Promise<void>;
}

const permissionNameEnum = {
    values: Object.values(PermissionName).filter((value) => typeof value === "number") as number[],
    message: "Invalid permission name for path `{PATH}` with value `{VALUE}`"
};

const getRoleSchema: (name: string) => mongoose.Schema = (collectionName) => {
    const schema = new mongoose.Schema(
        {
            roleId: {
                type: String,
                unique: true,
                required: true
            },
            name: {
                type: String,
                required: true
            },
            permissions: [
                {
                    name: { type: Number, enum: permissionNameEnum, required: true },
                },
            ],
            accountId: {
                type: String,
                required: true,
            },
            isBuiltin: {
                type: Boolean,
                required: true,
                default: false,
            },
            isDefault: {
                type: Boolean,
                required: true,
                default: false,
            },
            description: {
                type: String,
            },
            created: {
                type: Date,
                default: Date.now
            },
            updated: {
                type: Date,
                default: Date.now
            }
        }, { collection: collectionName }
    );
    return addTimestampMiddleware(schema, "updated");
};

export class RoleRepository extends MongoRepository<IRole> implements IRoleRepository {

    async saveRole(role: Role): Promise<Role> {
        const daoRole = roleModelToDao(role);
        const resultRole = await this.insertEntity(daoRole);
        return roleDaoToModel(resultRole);
    }


    updateRole(toUpdate: Role, roleId: string): Promise<Role> {
        const daoRole = roleModelToDao(toUpdate);
        return this.saveEntity({ roleId }, <IRole>daoRole).then(roleDaoToModel);
    }


    getRoleById(roleId: string): Promise<Role> {
        const builtInRole = builtInRolesArray.find(({ roleId: id }) => (id === roleId));
        if (builtInRole) {
            return Promise.resolve(builtInRole);
        }
        return this.fetchOne({ roleId }).then(dao => {
            if (dao.isJust()) {
                return roleDaoToModel(dao.get());
            }
            throw new RoleNotFoundException(roleId);
        });
    }


    async allRolesForAccount(accountId: string): Promise<Role[]> {
        return (await this.findEntities({ accountId }).then(daos => daos.map(roleDaoToModel))).concat(builtInRolesArray);
    }


    async accountCustomRoles(accountId: string): Promise<Role[]> {
        return (await this.findEntities({ accountId }).then(daos => daos.map(roleDaoToModel))).concat(builtInRolesArray);

    }


    async deleteRole(roleId: string): Promise<void> {
        await this.deleteMany({ roleId });
    }


    async addPermissionToRole(roleId: string, permissions: PermissionName[]): Promise<Role> {
        const foundRole = await this.getRoleById(roleId);
        const roleWithNewPermissions = foundRole.addPermission(permissions);
        return roleWithNewPermissions;
    }

    async removePermissionFromRole(roleId: string, permissions: PermissionName[]): Promise<Role> {
        const foundRole = await this.getRoleById(roleId);
        const roleWithNewPermissions = foundRole.removePermission(permissions);
        return roleWithNewPermissions;
    }

    async getDefaultRole(accountId: string): Promise<Role> {
        const accountCustomRoles = await this.accountCustomRoles(accountId);
        const defaultCustomRole = accountCustomRoles.find(({ isDefault }) => isDefault);
        if (defaultCustomRole) {
            return defaultCustomRole;
        }
        return builtInRolesArray.find(({ isDefault }) => isDefault);
    }

    // todo: here we associate role with one permission which is not good
    async getRoleByPermission(accountId: string, permission: PermissionName): Promise<Role> {
        const allRoles = await this.allRolesForAccount(accountId);
        const maybeRole = allRoles.find(({ permissions: [p] }) => p === permission);
        if (maybeRole) {
            return maybeRole;
        } else {
            throw new RoleNotFoundException(`permission name ${permission}`);
        }
    }

    async deleteAllForAccount(accountId: string): Promise<void> {
        await this.deleteMany({ accountId });
    }
}

export class RoleRepositoryFactory extends MongoRepositoryFactory<IRole> {
    build(logger: Logger): RoleRepository {
        return new RoleRepository(this.model, this.collection, logger);
    }

    protected updateModel(): void {
        const schema = getRoleSchema(this.collection.name);
        schema.index({ roleId: 1 }, { unique: true });
        this.model = this.collection.connection.model<IRole>("RoleDAO", schema);
    }

    static fromConfig(config: Config, logger: Logger): Promise<RoleRepositoryFactory> {
        const loginOption = getMongoLogin("authorization_service");
        return CollectionConfig.fromConfig(config, "roles", loginOption)
            .caseOf({
                left: error => Promise.reject(error),
                right: ccfg => Promise.resolve(ccfg)
            })
            .then(collectionConfig => new RoleRepositoryFactory(collectionConfig, logger));
    }
}
