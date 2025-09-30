/* eslint-disable no-console */
import { Account, AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { Repository as AclRepository, AclRepositoryFactory } from "../authorization/repositories/acl";
import { BackendAccountServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { PermissionName, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AccountIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { Acl } from "../authorization/models/acl";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { getInheritedPermissions } from "../authorization/roles";
import { scorePermission } from "@binders/client/lib/clients/authorizationservice/v1/util";

const config = BindersConfig.get();
const scriptName = "fix-inherited-acls";
const logger = LoggerBuilder.fromConfig(config);

function filterDocumentAcls(acls: Acl[], test: (ids: string[]) => boolean) {
    return acls.filter(acl => {
        const matchingRules = acl.rules.filter(rule => {
            const resource = rule.resource;
            return resource.type === ResourceType.DOCUMENT && test(resource.ids);
        });
        return matchingRules.length === 1;
    });
}

function filterAclByCollectionId(acls: Acl[], collectionId: string): Acl[] {
    return filterDocumentAcls(acls, ids => ids.indexOf(collectionId) !== -1);
}

function filterAclByCollectionIdExclusion(acls: Acl[], collectionId: string): Acl[] {
    return filterDocumentAcls(acls, ids => ids.indexOf(collectionId) === -1);
}

function filterAclsByMaxPermission(acls: Acl[], permission: PermissionName) {
    const scoreToMatch = scorePermission(permission);
    return acls.filter( acl => {
        const ruleScores = acl.rules.map(rule => {
            const permissionScores = rule.permissions.map(p => scorePermission(p.name));
            return Math.max(...permissionScores);
        });
        return Math.max(...ruleScores) === scoreToMatch;
    });
}

async function fixRootCollectionForPermission(acls: Acl[], permission: PermissionName, namePrefix: string): Promise<void> {
    const rootAcls = acls.filter(acl =>
        acl.name.startsWith(namePrefix) ||
        (acl.name.startsWith("Root collection") && acl.name.endsWith(PermissionName[permission])));
    if (rootAcls.length !== 1) {
        // console.error("!!! Wrong number of root acls: ", acls, rootAcls.map(acl => acl.id));
        return;
    }
    const rootAcl = rootAcls[0];
    const aclsToFix = filterAclsByMaxPermission(acls, permission)
        .filter( acl => acl.id !== rootAcl.id);

    if (aclsToFix.length > 0) {
        console.log("Fixing root collection acls");
        // Add assignees to rootAcl
        // Delete acl
        console.log(aclsToFix);
    }
    return;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fixRootCollection(acls: Acl[], collectionId: string, repo: AclRepository): Promise<void> {
    const toFix = filterAclByCollectionId(acls, collectionId);
    if (toFix.length === 0) {
        return;
    }
    await fixRootCollectionForPermission(toFix, PermissionName.ADMIN, "Admins can read and modify");
    await fixRootCollectionForPermission(toFix, PermissionName.EDIT, "Editors can read and modify");
    await fixRootCollectionForPermission(toFix, PermissionName.VIEW, "Readers can only read");
}

async function fixNonRootCollectionForPermission(toFix: Acl[], permission: PermissionName): Promise<void> {
    const requiredPermissions = getInheritedPermissions(permission);
    const wrongAcls = filterAclsByMaxPermission(toFix, permission)
        .filter( acl => {
            const permissionCount = acl.rules.reduce( (reduced, rule) => reduced + rule.permissions.length, 0);
            const wrong = permissionCount < requiredPermissions.length;
            if (wrong) {
                console.log(permissionCount, requiredPermissions.length, JSON.stringify(acl.rules));
            }
            return wrong;
        });
    if (wrongAcls.length > 0) {
        console.log("Fixing non root acls");
        console.log(wrongAcls);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fixNonRootCollections(acls: Acl[], collectionId: string, repo: AclRepository): Promise<void> {
    const toFix = filterAclByCollectionIdExclusion(acls, collectionId);
    await fixNonRootCollectionForPermission(toFix, PermissionName.ADMIN);
}

async function getAllAccounts(accountServiceClient: AccountServiceContract) {
    return accountServiceClient.listAccounts();
}

async function fixAccount(account: Account, repoServiceClient: BinderRepositoryServiceClient, aclRepository: AclRepository): Promise<void> {
    try {
        const rootCollections = await repoServiceClient.getRootCollections([account.id]);
        if (rootCollections === undefined || rootCollections.length === 0 || rootCollections[0].id === undefined) {
            console.error("!!!! Invalid root collection", rootCollections[0]);
            return;
        }
        const accountAcls = await aclRepository.accountAcls(new AccountIdentifier(account.id));
        await fixRootCollection(accountAcls, rootCollections[0].id as string, aclRepository);
        await fixNonRootCollections(accountAcls, rootCollections[0].id as string, aclRepository);
    } catch (e) {
        console.error("Could not fix account " + account.name);
        console.error(e);
    }
}

async function getAclRepository() {
    const loginOption = getMongoLogin("authorization_service");
    const collectionConfig = await CollectionConfig.promiseFromConfig(config, "acls", loginOption);
    const factory = new AclRepositoryFactory(collectionConfig, logger);
    return factory.build(logger);
}

async function doIt() {
    const [accountServiceClient, repoServiceClient, aclRepository] = await Promise.all([
        BackendAccountServiceClient.fromConfig(config, scriptName),
        BackendRepoServiceClient.fromConfig(config, scriptName),
        getAclRepository()
    ]);
    const accounts = await getAllAccounts(accountServiceClient);
    return accounts.reduce( (reduced, account) => reduced.then( () => fixAccount(account, repoServiceClient, aclRepository))
        , Promise.resolve(undefined));
}

doIt()
    .then( () => {
        console.log("All done!");
        process.exit();
    })
    .catch( error => {
        console.log("Error!", error);
        process.exit(1);
    });


// tslint:enable:no-console