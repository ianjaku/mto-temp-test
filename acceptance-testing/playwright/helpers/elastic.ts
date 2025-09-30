import {
    ElasticRepositoryConfigFactory,
    RepositoryConfigType
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { readFile } from "fs/promises";

function getElasticIndex(repoConfigType: RepositoryConfigType): string {
    const bindersConfig = BindersConfig.get();
    const repoConfig = ElasticRepositoryConfigFactory.build(bindersConfig, [repoConfigType]);
    return repoConfig.indexName as string;
}

interface ElasticBinderCreateOptions {
    id: string;
    ancestors: string[];
    domainCollectionId: string;
    accountId: string;
    userId: string;
}

export async function fixElasticBinderDocument(path: string, options: ElasticBinderCreateOptions): Promise<[string, unknown]> {
    const fileContents = await readFile(path);
    const binder = JSON.parse(fileContents.toString());
    const indexName = getElasticIndex(RepositoryConfigType.Binders);
    // id
    binder["id"] = options.id;
    // ancestors
    binder["ancestors"] = options.ancestors;
    // domainCollectionId
    binder["domainCollectionId"] = options.domainCollectionId;
    // accountId
    binder["accountId"] = options.accountId;
    // authorIds
    binder["authorIds"] = [options.userId];
    // lastModifiedBy
    binder["lastModifiedBy"] = options.userId;
    // thumbnail?
    const metaModules = binder["modules"]["meta"];
    for (const module of metaModules) {
        module["lastModifiedBy"] = options.userId;
    }
    for (let moduleIndex = 0; moduleIndex < binder.modules.images.chunked.length; moduleIndex++) {
        const imageModule = binder.modules.images.chunked[moduleIndex];
        for (let outerChunkIndex = 0; outerChunkIndex < imageModule.chunks.length; outerChunkIndex++) {
            for (let innerChunkIndex = 0; innerChunkIndex < imageModule.chunks[outerChunkIndex].length; innerChunkIndex++) {
                const isVideo = imageModule.chunks[outerChunkIndex][innerChunkIndex]["id"].startsWith("vid-");
                const newUrl = isVideo ?
                    "https://drive.google.com/uc?export=view&id=14Po5aer2E-dk4hDb663rj62Si-X9fYY2" :
                    "https://drive.google.com/uc?export=view&id=1HKa_ECzI6Xj0hM3DvZ_fyECLDAO9nKn6";
                imageModule.chunks[outerChunkIndex][innerChunkIndex]["url"] = newUrl;
                imageModule.chunks[outerChunkIndex][innerChunkIndex]["id"] = undefined;
            }
        }
    }

    return [indexName, binder];

}