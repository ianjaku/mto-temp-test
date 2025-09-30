/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { AclRepositoryFactory } from "./../authorization/repositories/acl";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { builtInRoles } from "./../authorization/repositories/roles";

const config = BindersConfig.get();
const topLevelLogger = LoggerBuilder.fromConfig(config);

async function getAclRepository() {
    const loginOption = getMongoLogin("authorization_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "acls", loginOption);
    const factory = new AclRepositoryFactory(collectionConfig, topLevelLogger);
    return factory.build(topLevelLogger);
}

async function doIt() {
    const aclRepository = await getAclRepository();
    const acls = await aclRepository.getAllAcls();
    return Promise.all(acls.map((acl) => {
        const roleId = getRoleForAcl(acl.rules[0].permissions, acl.id.value());
        const updatedAcl = acl.saveRoleId(roleId);
        return aclRepository.updateAcl(updatedAcl, acl.id);
    }));
}


function getRoleForAcl(permissions, aclId) {
    const purePermissions = permissions.map(({ name }) => name);

    if (purePermissions.includes(PermissionName.ADMIN)) {
        return builtInRoles.admins.roleId;
    }
    if (purePermissions.includes(PermissionName.EDIT)) {
        return builtInRoles.editors.roleId;
    }
    if (purePermissions.includes(PermissionName.VIEW)) {
        return builtInRoles.readers.roleId;
    } else {
        throw `Can't set roleId for acl with id ${aclId}`;
    }
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});