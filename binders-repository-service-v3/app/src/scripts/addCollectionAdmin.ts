/* eslint-disable no-console */
import { AssigneeType, PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BackendAccountServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const getOptions = () => {
    if (process.argv.length !== 4) {
        console.error(`Usage: node ${__filename} <ACCOUNT_ID> <USER_ID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
        userId: process.argv[3]
    };
};

const config = BindersConfig.get();
const options = getOptions();
const scriptName = "add-admin-to-root-collection";

Promise.all([
    BackendAuthorizationServiceClient.fromConfig(config, scriptName),
    BackendRepoServiceClient.fromConfig(config, scriptName),
    BackendAccountServiceClient.fromConfig(config, scriptName)
]).then( ([azClient, repoClient, accountClient]) => {
    accountClient.getAccount(options.accountId)
        .then(account => {
            if (account.members.find(member => member === options.userId) === undefined) {
                throw new Error(`User ${options.userId} is not a member of ${options.accountId}`);
            }
        })
        .then( () => repoClient.getRootCollections([options.accountId]))
        .then(rootCollections => azClient.resourceAcls({type: ResourceType.DOCUMENT, ids: [rootCollections[0].id]}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((acls: any) => { // broken, signature of resourceAcls changed
            const adminAcl = acls.find(acl => acl.rules.filter(
                rule => rule.permissions.find(p => p.name === PermissionName.ADMIN)
            ).length > 0);
            const userAssignees = adminAcl.assignees.find(assigneeGroup => assigneeGroup.type === AssigneeType.USER);
            if (! userAssignees) {
                throw new Error("Could not find user assignees??");
            }
            if (userAssignees.ids.find(uid => uid === options.userId)) {
                console.log("User already collection admin.");
                return adminAcl;
            }
            else {
                console.log("Adding user as collection admin.");
                return azClient.addAclAssignee(adminAcl.id, options.accountId, AssigneeType.USER, options.userId)
                    .then( updateAcl => {
                        console.log("All done!");
                        return updateAcl;
                    });
            }
        });
});
