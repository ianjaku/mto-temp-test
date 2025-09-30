import {
    BackendImageServiceClient
} from  "@binders/binders-service-common/lib/apiclient/backendclient";
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();

async function fetchVisualIdFromUrl(url: string) {
    const client = await BackendImageServiceClient.fromConfig(config, "attemptToFixImagesWithoutId");
    return client.getVisualIdByImageUrl(url);
}

export async function attemptToFixImagesWithoutId(
    esHit: { _source: Binder },
    logger?: Logger
): Promise<{ changed: boolean; esHit }> {
    const chunked = esHit._source?.modules?.images?.chunked;
    if (chunked == null) return { esHit, changed: false };

    let changed = false;

    for (const chunksWrapper of chunked) {
        const chunks = chunksWrapper?.chunks;
        if (chunks == null) continue;
        let updatedChunks = [...chunks];
        for (const chunk of chunks) {
            if (chunk == null) continue;
            let updatedChunk = [...chunk];
            for (const image of chunk) {
                if (typeof image === "string") continue;
                if (image.id == null) {
                    updatedChunk = updatedChunk.filter(i => i !== image);
                    continue;
                }
                if (!image.id.startsWith("img") && !image.id.startsWith("vid")) {
                    const binderId = esHit["_id"] || esHit["_source"].id;
                    logger?.info(
                        `Attempting to fix visual ${JSON.stringify(image, null, 4)} in ${binderId}`,
                        "visuals-without-id-fixer"
                    );
                    const imageId = await fetchVisualIdFromUrl(image.url);
                    if (imageId != null) {
                        image.id = imageId;
                        changed = true;
                    } else {
                        updatedChunk = updatedChunk.filter(i => i !== image);
                        changed = true;
                        continue;
                    }
                }
            }
            updatedChunks = updatedChunks.map(c => c === chunk ? updatedChunk : c);
        }
        chunksWrapper.chunks = updatedChunks;
    }

    return { changed, esHit };
}