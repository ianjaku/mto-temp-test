/* eslint-disable no-console */
import { AssigneeType } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { BackendAuthorizationServiceClient } from "@binders/binders-service-common/lib/authorization/backendclient";
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BindersRepositoryServiceContract } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import { EDITOR_ROLE_ID } from "@binders/binders-service-common/lib/authorization/role";

const config = BindersConfig.get();

const ACCOUNTID = "aid-ee09275b-0c1f-4c16-adfa-e23e7ee47664";
const DOMAINCOLLECTION_ID = "AXVMnMin2aVi0fP59sPt";
const USER_ID = "uid-ef59a3f6-812d-4253-a535-7600bd5a99a9"
const LANGUAGE = "en"

const getOptions = () => {
    return {
        parentCollectionId: process.argv[2] || "AXdJEF0uDFfQ4bi07W44",
        numberOfItems: process.argv[3] || 5
    };
};

function generateDummyNames(numberOfItems): string[] {
    const result = []

    for (let i = 0; i < numberOfItems; i++) {
        result.push(`Collection-${i}`)
    }

    return result
}

(async function () {
    const { numberOfItems, parentCollectionId } = getOptions();
    const names = generateDummyNames(numberOfItems)
    const clients = await Promise.all([
        BackendRepoServiceClient.fromConfig(config, "create-test-collections"),
        BackendAuthorizationServiceClient.fromConfig(config, "create-test-collections"),
    ]);
    const repoClient: BindersRepositoryServiceContract = clients[0];
    const authorizationClient: AuthorizationServiceClient = clients[1];

    async function createCollection(name) {
        const collection = await repoClient.createCollectionBackend(
            ACCOUNTID,
            name,
            LANGUAGE,
            { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" },
            DOMAINCOLLECTION_ID,
        )
        await repoClient.addElementToCollection(parentCollectionId, "collection", collection.id, ACCOUNTID);
        return collection.id;
    }

    async function addEditorAcl(collectionId, userId) {
        const newAcl = await authorizationClient.addDocumentAcl(ACCOUNTID, collectionId, EDITOR_ROLE_ID);
        await authorizationClient.addAclAssignee(newAcl.id, ACCOUNTID, AssigneeType.USER, userId);
    }

    async function processName(name) {
        const collectionId = await createCollection(name);
        await addEditorAcl(collectionId, USER_ID);

    }

    for (const name of names) {
        console.log(`Processing ${name} item`)
        await processName(name);
    }

})();