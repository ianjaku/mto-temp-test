import {
    EditorItemSearchResult,
    ReaderItemSearchResult,
    isBinderHitType,
    isCollectionHitType,
    isPublicationHitType
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "../bindersconfig/binders";
import { ClientFactory } from "./clientfactory";


let clientFactory: ClientFactory<BinderRepositoryServiceClient>;
const getOrCreateClientFactory = () => {
    if (clientFactory == null) {
        const config = BindersConfig.get();
        clientFactory = new ClientFactory(
            config,
            BinderRepositoryServiceClient,
            "v3"
        );
    }
    return clientFactory;
}

export async function doEditorSearch(
    query: string,
    accountId: string,
    scopeId?: string,
    userId?: string,
): Promise<EditorItemSearchResult> {
    const clientFactory = getOrCreateClientFactory();

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
            isReadOnlyMode: false,
        },
        accountId,
        {
            prioritizedScopeCollectionId: scopeId ?? undefined
        }
    );
}

export async function expectSearchOrder(
    searchResult: ReaderItemSearchResult | EditorItemSearchResult,
    expectedIdsOrder: string[] // Should be an array of binderIds & collection Ids
): Promise<void> {
    expect(searchResult.hits.length).toEqual(expectedIdsOrder.length);

    const binderIds = searchResult.hits.map(hit => {
        if (isPublicationHitType(hit)) return hit.publicationSummary.binderId;
        if (isCollectionHitType(hit)) return hit.collection.id;
        if (isBinderHitType(hit)) return hit.binderSummary.id;
        throw new Error(`Unexpected hit type: ${hit}`);
    });

    expect(binderIds).toEqual(expectedIdsOrder);
}

export async function doReaderSearch(
    query: string,
    domain: string,
    scopeId?: string,
    userId?: string,
    isPublic?: boolean
): Promise<ReaderItemSearchResult> {
    const clientFactory = getOrCreateClientFactory();

    let client: BinderRepositoryServiceClient;
    if (userId) {
        client = await clientFactory.createForFrontend(userId);
    }
    if (!userId && !isPublic) {
        client = await clientFactory.createBackend();
    }
    if (!userId && isPublic) {
        client = await clientFactory.createForFrontend();
    }
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