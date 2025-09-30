import {
    AssigneeGroup,
    AssigneeType,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BackendAccountServiceClient,
    BackendRepoServiceClient,
    BackendUserServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import {
    Binder,
    BindersRepositoryServiceContract,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { log, main } from "@binders/binders-service-common/lib/util/process";
import {
    BackendAuthorizationServiceClient
} from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { isManualToLogin } from "@binders/client/lib/util/user";
import { writeFile } from "fs/promises";

/*
* This script will dump all ACLs for an account to a csv file.
* Requested by Bekaert Deslee in October 2024
* Once this information is available elsewhere, this script can be removed.
*/

const SCRIPTNAME = "dumpAcls";

const program = new Command();

program
    .name(SCRIPTNAME)
    .description("Dump all ACL for an account to a csv file.")
    .version("0.1.1")
    .option("-a, --account [accountId]", "the account that needs to be dumped")


function getOptions() {
    program.parse(process.argv);
    const options = program.opts();
    return options;
}

const DEBUG = process.env.DEBUG;

async function formatUsers(ids: string[], userServiceClient: UserServiceClient) {
    const users = await userServiceClient.getUsers(ids);
    return users
        .map(user => user.login)
        .filter(login => !isManualToLogin(login))
        .map(login => `"[USER] ${login}"`);
}

async function formatGroups(ids: string[], groups: {[id: string]: string}) {
    return ids.map(groupId => `"[GROUP] ${groups[groupId]}"`);
}
async function formatAssignees(
    assignee: AssigneeGroup,
    userServiceClient: UserServiceClient,
    groups: {[id: string]: string}
): Promise<string[]> {
    const { ids, type } = assignee;
    if (type === AssigneeType.USER) {
        return formatUsers(ids, userServiceClient);
    } else if (type === AssigneeType.USERGROUP) {
        return formatGroups(ids, groups);
    } else if (type === AssigneeType.PUBLIC) {
        return [ "[PUBLIC]" ];
    } else {
        throw new Error(`Unsupported assignee type ${type}`);
    }
}


function formatItem(item: Binder | DocumentCollection) {
    const title = extractTitle(item).replace(/"/g, "'");
    if (isCollectionItem(item)) {
        return `"[COLLECTION] ${title}"`;
    } else {
        return `"[DOCUMENT] ${title}"`;
    }
}
async function formatItems(ids: string[], repoServiceClient: BindersRepositoryServiceContract) {
    const items = await repoServiceClient.findItems({ids}, {maxResults: ids.length});
    return items.map(formatItem);

}

main(async() => {
    const { account: accountId } = getOptions();
    const config = BindersConfig.get();
    const accountServiceClient = await BackendAccountServiceClient.fromConfig(config, SCRIPTNAME);
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, SCRIPTNAME);
    const authorizationServiceClient = await BackendAuthorizationServiceClient.fromConfig(config, SCRIPTNAME);
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, SCRIPTNAME);
    const account = await accountServiceClient.getAccount(accountId);
    log(`Dumping ACLs for account ${account.name}`);
    const acls = await authorizationServiceClient.accountAcls(accountId);
    const groups = await userServiceClient.getGroups(accountId);
    const groupsMap = groups.reduce((acc, group) => {
        acc[group.id] = group.name;
        return acc;
    }, {});
    const lines = [ "ACL,Resource,Assignee,Permission" ];
    for (const acl of acls) {
        const rule = acl.rules[0];
        const formatedItems = await formatItems(rule.resource.ids, repoServiceClient);
        if (formatedItems.length === 0) {
            if (DEBUG) {
                log(`No items found for ACL ${acl.id}`);
            }
            continue;
        }
        if (formatedItems.length > 1) {
            throw new Error(`Multiple items found for ACL ${acl.id}`);
        }
        const formatedItem = formatedItems[0];
        if (rule.resource.type !== ResourceType.DOCUMENT) {
            if (DEBUG) {
                log(`Skipping ACL ${acl.id} for resource type ${ResourceType[rule.resource.type]}`);
            }
            continue;
        }
        const assignees = acl.assignees;
        if (assignees.length === 0) {
            if (DEBUG) {
                log(`No assignees for ACL ${acl.id}`);
            }
            continue;
        }
        for (const assignee of assignees) {
            const formattedAssignees = await formatAssignees(assignee, userServiceClient, groupsMap);
            for (const formattedAssignee of formattedAssignees) {
                const formatedPermissions = rule.permissions.map(permission => PermissionName[permission.name]).join("+");
                // "ACL,Resource,Assignee,Permission"
                lines.push([
                    acl.id,
                    formatedItem,
                    formattedAssignee,
                    formatedPermissions
                ].join(","));
            }
        }
    }
    const fileName = `/tmp/all-acls-${account.name}.csv`;
    await writeFile(fileName, lines.join("\n"));
});
