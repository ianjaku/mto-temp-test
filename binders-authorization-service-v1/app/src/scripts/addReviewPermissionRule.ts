/* eslint-disable no-console */
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AclRepositoryFactory } from "./../authorization/repositories/acl";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { builtInRoles } from "../authorization/repositories/roles";
import mongoose from "mongoose";

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
    const acls = await aclRepository.queryAcls({
        $or: [
            {
                roleId: mongoose.trusted({
                    $in: [
                        builtInRoles.admins.roleId,
                        builtInRoles.editors.roleId,
                        builtInRoles.reviewers.roleId
                    ],
                }),
            },
            {
                "rules.0.permissions": PermissionName.PUBLISH,
            },
        ],
        "rules.0.resourceType": ResourceType.DOCUMENT,
    });
    let i = 0, missingPermissions = 0;
    for (const acl of acls) {
        for (let r = 0; r < acl.rules.length; r++) {
            const permission = acl.rules[r].permissions.find(({ name }) => name === PermissionName.REVIEW)
            if (!permission) {
                console.log(`Missing permission for account ${acl.accountId.value()}: `, acl.rules[r].permissions)
                acl.rules[r].permissions.push({ name: PermissionName.REVIEW });
                await aclRepository.updateAcl(acl, acl.id);
                missingPermissions++
            }
        }
        i++
    }
    console.log(`All acls ${i}, missing permissions ${missingPermissions}`)
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});
