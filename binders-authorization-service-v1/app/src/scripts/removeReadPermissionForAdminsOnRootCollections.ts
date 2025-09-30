/* eslint-disable no-console */
import { BackendAccountServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { Acl } from "../authorization/models/acl";
import { AclRepositoryFactory } from "./../authorization/repositories/acl";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";

const config = BindersConfig.get();
const scriptName = "remove-read-permissions-for-admins-on-root-collections";
const topLevelLogger = LoggerBuilder.fromConfig(config);

async function getAclRepository() {
    const loginOption = getMongoLogin("authorization_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "acls", loginOption);
    const factory = new AclRepositoryFactory(collectionConfig, topLevelLogger);
    return factory.build(topLevelLogger);
}

async function doIt() {
    // const loginOption = getMongoLogin("authorization_service");
    const aclRepository = await getAclRepository();
    const accountClient = await BackendAccountServiceClient.fromConfig(config, scriptName);
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(
        config,
        scriptName,
    );
    const accounts = await accountClient.listAccounts();
    const accountIds = accounts.map(account => account.id);
    const rootCollections = await repoServiceClient.getRootCollections(accountIds);
    const resourceIds = rootCollections.map(col => col.id);
    const adminPermissions = [
        PermissionName.ADMIN,
        PermissionName.EDIT,
        PermissionName.VIEW,
    ];
    const rootCollectionsAdminAcls = await Promise.all(
        resourceIds.map(res => aclRepository.getAclWithPermissionNames(res, adminPermissions)),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootCollectionsReadAcls: any[] = await Promise.all(
        resourceIds.map(res => aclRepository.getAclWithPermissionNames(res, [PermissionName.VIEW])),
    );
    await Promise.all(rootCollectionsAdminAcls.map(async (adminAcl: Acl) => {
        const adminAclResourceId = adminAcl.rules[0].resource.ids[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sameReadAcl: Acl = rootCollectionsReadAcls.find((readAcl: any) => {
            if (readAcl.rules.find(rule => rule.resource.ids[0] === adminAclResourceId)) {
                return readAcl;
            }
        });
        if (sameReadAcl !== undefined) {
            return Promise.all(adminAcl.assignees.map(async adminAssignee => {
                const usersToRemove: string[] = [];
                const sameTypeAssignees = sameReadAcl
                    .assignees
                    .find(a => a.type === adminAssignee.type);
                if (sameTypeAssignees) {
                    adminAssignee.ids.forEach(asId => {
                        if (sameTypeAssignees.ids.indexOf(asId) > -1) {
                            usersToRemove.push(asId);
                        }
                    });
                }
                const toUpdate = usersToRemove.reduce((previous, userId) => (
                    previous.removeAssignee(adminAssignee.type, userId)
                ), sameReadAcl);
                console.log(
                    "removing",
                    usersToRemove.join(", "),
                    "from ACL:",
                    sameReadAcl.id.value(),
                );
                return aclRepository.updateAcl(toUpdate, sameReadAcl.id);
            }));
        }
        return Promise.resolve();
    }));
}

doIt().then(() => {
    console.log("All done!");
    process.exit();
}).catch(error => {
    console.log("Error!", error);
    process.exit(1);
});