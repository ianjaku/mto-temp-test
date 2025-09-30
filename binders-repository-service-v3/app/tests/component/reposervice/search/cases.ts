import { UID_ACCOUNT_ADMIN, UID_SUBCOL_EDITOR, UID_SUBCOL_READER } from ".";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { ClientFactory } from "@binders/binders-service-common/lib/testutils/clientfactory"



jest.setTimeout(30000);

const config = BindersConfig.get();
let _clientFactory;

function getClientFactory() {
    if (! _clientFactory) {
        _clientFactory = new ClientFactory(
            config,
            BinderRepositoryServiceClient,
            "v3"
        );
    }
    return _clientFactory;
}

async function doReaderSearch(query: string, domain: string, scopeId: string, userId: string) {
    const clientFactory = getClientFactory();
    const client = userId ?
        await clientFactory.createForFrontend(userId) :
        await clientFactory.createBackend();
    return await client.searchPublicationsAndCollections(
        query,
        {
            binderSearchResultOptions: {
                maxResults: 100
            },
            cdnnify: true,
            isReadOnlyMode: false,
        },
        domain,
        {
            prioritizedScopeCollectionId: scopeId ?? undefined
        }
    );
}


async function doEditorSearch(accountId: string, query: string, scopeId: string, userId: string, isReadOnly: boolean) {
    const clientFactory = getClientFactory();
    const client = userId ?
        await clientFactory.createForFrontend(userId) :
        await clientFactory.createBackend();
    return await client.searchBindersAndCollections(
        query,
        {
            binderSearchResultOptions: {
                maxResults: 100
            },
            cdnnify: true,
            isReadOnlyMode: isReadOnly,
        },
        accountId,
        {
            prioritizedScopeCollectionId: scopeId
        }
    );
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCases(): any {
    return [
        {
            name: "ReaderMatchingPublication",
            test: async (_, domain, user, context) => {

                return doReaderSearch("Gecertificeerde", domain, context.id, user.id)
            },
            validation: async (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 16,
                    [UID_SUBCOL_EDITOR]: 11,
                    [UID_SUBCOL_READER]: 2
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        },
        {
            name: "ReaderMatchingPublicationAndCollection",
            test: async (_, domain, user, context) => {
                return doReaderSearch("\"elektrische voertuigen\"", domain, context.id, user.id)
            },
            validation: (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 18,
                    [UID_SUBCOL_EDITOR]: 18,
                    [UID_SUBCOL_READER]: 8
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        },
        {
            name: "EditorMatchingDocument",
            test: async (accountId, _, user, context) => {
                return doEditorSearch(accountId, "\"Hoe zit het met de mythes\"", context.id, user.id, false);
            },
            validation: (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 2,
                    [UID_SUBCOL_EDITOR]: 1,
                    [UID_SUBCOL_READER]: 0
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        },
        {
            name: "EditorMatchingDocumentReadOnly",
            test: async (accountId, _, user, context) => {
                return doEditorSearch(accountId, "\"Hoe zit het met de mythes\"", context.id, user.id, true);
            },
            validation: (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 2,
                    [UID_SUBCOL_EDITOR]: 2,
                    [UID_SUBCOL_READER]: 1
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        },
        {
            name: "EditorMatchingCollection",
            test: async (accountId, _, user, context) => {
                return doEditorSearch(accountId, "\"Basisprincipes van elektrische voertuigen\"", context.id, user.id, false);
            },
            validation: (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 2,
                    [UID_SUBCOL_EDITOR]: 1,
                    [UID_SUBCOL_READER]: 0
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        },
        {
            name: "EditorMatchingCollectionReadOnly",
            test: async (accountId, _, user, context) => {
                return doEditorSearch(accountId, "\"Basisprincipes van elektrische voertuigen\"", context.id, user.id, true);
            },
            validation: (result, user) => {
                const results = {
                    [UID_ACCOUNT_ADMIN]: 2,
                    [UID_SUBCOL_EDITOR]: 2,
                    [UID_SUBCOL_READER]: 1
                }
                const expected = results[user.id];
                expect(result.totalHitCount).toEqual(expected)
            }
        }
    ]
}