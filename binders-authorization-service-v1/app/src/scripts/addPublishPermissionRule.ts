/* eslint-disable no-console */
import {
    ADMIN_ROLE_ID,
    EDITOR_ROLE_ID
} from "@binders/binders-service-common/lib/authorization/role";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import {
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AclRepositoryFactory } from "./../authorization/repositories/acl";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

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
    const acls = await aclRepository.findAcls({ roleIds: [EDITOR_ROLE_ID, ADMIN_ROLE_ID], resourceTypes: [ ResourceType.DOCUMENT ] });
    console.log(`${acls.length} edit/admin acls found`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aclsWithoutPublish = acls.filter(acl => (<any>(acl.rules[0])).permissions.findIndex(pm => pm.name === 4) < 0);
    console.log(`${aclsWithoutPublish.length} of them lack PUBLISH permission`);
    for(const acl of aclsWithoutPublish) {
        const editPermissionIndex = acl.rules[0].permissions.findIndex(pm => pm.name === PermissionName.EDIT);
        acl.rules[0].permissions.splice(editPermissionIndex, 0, { name: PermissionName.PUBLISH });
        await aclRepository.updateAcl(acl, acl.id);
        process.stdout.write(".");
    }
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});
