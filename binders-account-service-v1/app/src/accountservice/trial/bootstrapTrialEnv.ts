import {
    Account,
    AccountServiceContract,
    BootstrapTrialEnvironmentProps,
    ManageMemberTrigger
} from "@binders/client/lib/clients/accountservice/v1/contract";
import {
    AssigneeType,
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BindersRepositoryServiceContract,
    DocumentCollection
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    ServerEvent,
    captureServerEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { UserCreationMethod, UserServiceContract, UserType } from "@binders/client/lib/clients/userservice/v1/contract";
import { EDITOR_ROLE_ID } from "@binders/binders-service-common/lib/authorization/role";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";

export async function bootstrapTrialEnvironment(
    deps: {
        accountServiceClient: AccountServiceContract,
        repoServiceClient: BindersRepositoryServiceContract,
        authorizationServiceClient: AuthorizationServiceContract,
        routingServiceClient: RoutingServiceContract,
        userServiceClient: UserServiceContract,
    },
    props: BootstrapTrialEnvironmentProps,
): Promise<{ trialAccount: Account, userCollection: DocumentCollection }> {
    const {
        trialAccountId,
        templateCollectionId,
        companyName,
        firstName,
        lastName,
        login,
    } = props;
    const displayName = getUserName({ displayName: "", firstName, lastName });
    const userCollectionName = companyName;
    const { accountServiceClient, repoServiceClient, authorizationServiceClient } = deps;
    const trialAccount = await accountServiceClient.getAccount(trialAccountId);
    const rootColls = await repoServiceClient.getRootCollections([trialAccount.id]);
    const rootCollectionId = rootColls[0].id;
    const [domain] = await deps.routingServiceClient.getDomainFiltersForAccounts([trialAccountId])

    /**
     * 1. Create user account & mark it as PLG
     */
    const user = await deps.userServiceClient.createUser(
        login,
        getUserName({ displayName, firstName, lastName }),
        firstName,
        lastName,
        UserType.Individual,
        1,
        false,
    );
    await deps.userServiceClient.updateUser({ ...user, creationMethod: UserCreationMethod.PLG_TRIAL_V1 });
    const userId = user.id

    /**
     * 2. Duplicate Template collectionAccount
     */
    let userCollection = await repoServiceClient.duplicateCollection(
        templateCollectionId,
        rootCollectionId,
        rootCollectionId,
        trialAccount.id,
        trialAccount.id,
    );
    /**
     * 3. Rename the collection
     */
    if (userCollectionName) {
        userCollection = await repoServiceClient.saveCollectionTitle(userCollection.id, userCollectionName, "en");
    }

    /**
     * 4. Publish the documents in the Template collection
     */
    await repoServiceClient.recursivePublish(
        userCollection.id,
        userCollection.titles.map(t => t.languageCode),
        trialAccount.id,
    );

    /**
     * 5. Remove authors information & last edited by from the documents
     */
    const binders = await repoServiceClient.findBindersBackend({
        hierarchicalIncludeFilters: [[userCollection.id]],
    }, { maxResults: 9999 });
    await repoServiceClient.clearLastModifiedInfo(trialAccountId, binders.map(b => b.id));

    /**
     * 6. Assign the user to the Trial account with edit permissions
     */
    await accountServiceClient.addMember(trialAccountId, userId, ManageMemberTrigger.BOOTSTRAP_TRIAL_ENV, true);
    const docAcl = await authorizationServiceClient.addDocumentAcl(trialAccountId, userCollection.id, EDITOR_ROLE_ID);
    await authorizationServiceClient.addAclAssignee(docAcl.id, trialAccountId, AssigneeType.USER, userId);

    /**
     * 7. Send en invitation email
     */
    await deps.userServiceClient.inviteUser(login, trialAccountId, domain.domain);

    /**
     * 8. Capture event
     */
    await captureServerEvent(
        ServerEvent.TrialEnvironmentBootstrapped,
        { userId, accountId: trialAccountId },
        { userCollectionId: userCollection.id }
    );

    return {
        trialAccount,
        userCollection,
    }

}

