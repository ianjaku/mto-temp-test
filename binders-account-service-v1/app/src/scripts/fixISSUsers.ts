/* eslint-disable no-console */
import { AssigneeType, ResourceGroup, ResourceType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { ManageMemberTrigger } from "@binders/client/lib/clients/accountservice/v1/contract";
import { difference } from "ramda";

const ACCOUNT_ID = "aid-1767f159-ca3e-48aa-961c-19d68f64ffca";
const ROOT_COLLECTION  = "AV2KUPEE7xU0aRIt-77d";

const config = BindersConfig.get();
const getAccountServiceContract = BackendAccountServiceClient.fromConfig(config, "fix-iss");
const getAuthorizationServiceContract = BackendAuthorizationServiceClient.fromConfig(config, "fix-iss");

const getCurrentAccountMembers = async () => {
    const accountServiceContract = await getAccountServiceContract;
    const account = await accountServiceContract.getAccount(ACCOUNT_ID);
    return account.members;
};

const getCurrentEditors = async () => {
    const authorizationServiceContract = await getAuthorizationServiceContract;
    const resourceGroup: ResourceGroup = {
        type: ResourceType.DOCUMENT,
        ids: [ROOT_COLLECTION]
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acls: any = await authorizationServiceContract.resourceAcls(resourceGroup);
    const editorAcl = acls.find(a => a.description === "Root collection for ISS World: EDIT"); // broken, signature of resourceAcls changed
    const adminAcl = acls.find(a => a.description === "Root collection for ISS World: ADMIN"); // broken, signature of resourceAcls changed
    const editorAssignees = editorAcl.assignees;
    const adminAssignees = adminAcl.assignees;
    const editors = editorAssignees.reduce( (usersSoFar, assignee) => {
        return assignee.type === AssigneeType.USER ?
            usersSoFar.concat(assignee.ids) :
            usersSoFar;
    }, []);
    const admins = adminAssignees.reduce( (usersSoFar, assignee) => {
        return assignee.type === AssigneeType.USER ?
            usersSoFar.concat(assignee.ids) :
            usersSoFar;
    }, []);
    return editors.concat(admins);
};

const removeAccountMembers = async (userIds) => {
    const accountServiceContract = await getAccountServiceContract;
    console.log(`Going to remove ${userIds.length} users from account ${ACCOUNT_ID}`);
    return userIds.reduce( async (promiseSoFar, userId) => {
        await promiseSoFar;
        console.log(`Removing user with id ${userId}`);
        return accountServiceContract.removeMember(ACCOUNT_ID, userId, ManageMemberTrigger.SCRIPT);
    }, Promise.resolve());
}

const doIt = async() => {
    const [
        currentEditors,
        currentAccountMembers ] = await Promise.all([
        getCurrentAccountMembers(),
        getCurrentEditors()
    ]);
    const usersToDelete = difference(currentEditors, currentAccountMembers);
    await removeAccountMembers(usersToDelete);
};

doIt()
    .then(
        () => console.log("All done!"),
        error => console.log("!!! Something went wrong", error)
    );