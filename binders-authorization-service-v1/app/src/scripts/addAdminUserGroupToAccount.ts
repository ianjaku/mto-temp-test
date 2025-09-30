/* eslint-disable no-console */
import { AclRepositoryFactory, Repository } from "./../authorization/repositories/acl";
import { BackendAccountServiceClient, BackendRepoServiceClient, BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AssigneeType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { NodeClientHandler } from "@binders/binders-service-common/lib/apiclient/nodeclient";
import { buildBackendSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";

function getOptions() {
    if (process.argv.length > 3) {
        console.error(`Usage: node ${__filename} <ACCOUNT_ID>`);
        process.exit(1);
    }
    return {
        accountId: process.argv[2],
    };
}

const options = getOptions();
const config = BindersConfig.get();
const scriptName = "add-admin-groups";
const logger = LoggerBuilder.fromConfig(config);

function getAZClient(): Promise<AuthorizationServiceClient> {
    return NodeClientHandler.forBackend(buildBackendSignConfig(config), "az-script")
        .then(handler => AuthorizationServiceClient.fromConfig(config, "v1", handler));
}

async function getAclRepository(): Promise<Repository> {
    const loginOption = getMongoLogin("authorization_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "acls", loginOption);
    const factory = new AclRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}


function getAccountAdmins(client: AuthorizationServiceClient, accountId: string) {
    return client.getAccountAdmins(accountId);
}

async function checkIfAdminGroupExists(client: AuthorizationServiceClient, accountId: string) {
    const adminGroup = await client.getAdminGroup(accountId);
    return !!adminGroup;
}

async function findAdminAcls(aclRepository, repoServiceClient, accountId) {
    const rootCollections = await repoServiceClient.getRootCollections([accountId]);
    if (rootCollections === undefined || rootCollections.length === 0) {
        console.error(`Couldn't find root collection for ${accountId}. Acls for root collection won't be transferred to new admin group.`)
    }

    const aclsArray = [aclRepository.findAclMatches([], [{ type: ResourceType.ACCOUNT, ids: [accountId] }], [PermissionName.EDIT])];
    if(rootCollections && rootCollections.length > 0) {
        aclsArray.push(aclRepository.findAclMatches([], [{ type: ResourceType.DOCUMENT, ids: [<string>rootCollections[0].id] }], [PermissionName.ADMIN]));
    }

    return Promise.all(aclsArray);
}

function addAdminsToAdminGroup(userClient, users, accountId) {
    return userClient.multiAddGroupMembers(accountId,
        { names: ["Account admins"] },
        users,
        {
            createGroupIfDoesntExist: true,
            makeNewUsergroupReadonly: true
        })
}
async function grantGroupAccountAdmin(azClient, group, accountId, accountAclId, rootCollectionAcl) {

    await azClient.addAclAssignee(accountAclId,
        accountId,
        AssigneeType.USERGROUP,
        group.id);
    if (rootCollectionAcl && rootCollectionAcl[0] && rootCollectionAcl[0].id.value()) {
        await azClient.addAclAssignee(
            rootCollectionAcl[0].id.value(),
            accountId,
            AssigneeType.USERGROUP,
            group.id,
        );
    }
}

async function getAllAccounts(accountServiceClient) {
    return accountServiceClient.listAccounts();
}

async function migrateAdminsToAdminGroup(authorizationClient, userClient, repoClient, aclRepo, accountId) {
    const adminGroupAlreadyExists = await checkIfAdminGroupExists(authorizationClient, accountId);
    if(adminGroupAlreadyExists) {
        console.log(`Group for account admins already exists in account ${accountId}`);
        return;
    }
    const accountAdmins = await getAccountAdmins(authorizationClient, accountId);
    const [group] = await addAdminsToAdminGroup(userClient, accountAdmins, accountId);
    const [adminAcl, rootCollectionAcl] = await findAdminAcls(aclRepo, repoClient, accountId);

    await grantGroupAccountAdmin(authorizationClient, group, accountId, adminAcl[0].id.value(), rootCollectionAcl);
    for (let i = 0; i < accountAdmins.length; i++) {
        await authorizationClient.removeAccountAdmin(accountId, accountAdmins[i]);
    }

    console.log(`Created a group ${JSON.stringify(group)} in account ${accountId}`)
}

async function doIt() {

    const [aclRepo, azClient, userServiceClient, repoServiceClient, accountServiceClient] = await Promise.all([
        getAclRepository(),
        getAZClient(),
        BackendUserServiceClient.fromConfig(config, scriptName),
        BackendRepoServiceClient.fromConfig(config, scriptName),
        BackendAccountServiceClient.fromConfig(config, scriptName),
    ]);

    if(!options.accountId) {
        const allAccounts = await getAllAccounts(accountServiceClient);

        for(let i = 0; i< allAccounts.length; i++) {
            await migrateAdminsToAdminGroup(azClient, userServiceClient, repoServiceClient, aclRepo, allAccounts[i].id);
        }
    } else {
        await migrateAdminsToAdminGroup(azClient, userServiceClient, repoServiceClient, aclRepo, options.accountId);
    }
}


doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error("!!! Something went wrong: ");
        console.error(err);
        process.exit(1);
    }
)

// tslint:enable:no-console