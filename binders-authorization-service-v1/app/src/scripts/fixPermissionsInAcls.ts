/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { AclRepositoryFactory } from "./../authorization/repositories/acl";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { builtInRolesArray } from "./../authorization/repositories/roles";

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
        const updatedAcl = updatePermissionsForRole(acl);
        if(updatedAcl) {
            return aclRepository.updateAcl(updatedAcl, acl.id);
        }
        return Promise.resolve(acl);
    }));
}


function updatePermissionsForRole(acl) {
    const selectedRole = builtInRolesArray.find((role) => role.roleId === acl.roleId);
    if(!selectedRole) {
        console.log("---------------------------------------------\nno roleId for this acl!\n", acl);
        return;
    }
    const purePermissions = acl.rules[0].permissions.map(({ name }) => name);
    if(acl.rules[0].resource.type === 1 && (purePermissions.sort().join("") !== selectedRole.permissions.sort().join(""))) {
        const newRules = [{...acl.rules[0], permissions: selectedRole.permissions.map(p => ({name: p}))}];
        return acl.updateRules(newRules);
    }
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});