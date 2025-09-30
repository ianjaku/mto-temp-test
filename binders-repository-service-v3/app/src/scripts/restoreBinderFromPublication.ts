/* eslint-disable no-console */
import { BackendImageServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import BinderClass, { create as createBinder } from "@binders/client/lib/binders/custom/class";
import {
    BindersImageModule,
    BindersModuleMeta,
    BindersTextModule,
    IThumbnail
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { buildGlobalUrlMap, getUrlTranslation } from "../../src/repositoryservice/repositories/helpers";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import RTEState from "@binders/client/lib/draftjs/state";
import UUID from "@binders/client/lib/util/uuid";
import { extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { serializeEditorStates } from "@binders/client/lib/draftjs/helpers";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getOptions = () => {
    if (process.argv.length < 4) {
        console.error(`Usage: node ${__filename} <PUBLICATION_ID> <TARGET_COLLECTION_ID>`);
        process.exit(1);
    }
    return {
        publicationId: process.argv[2],
        targetCollectionId: process.argv[3],
    };
};

const getRepoServiceClient = () => {
    return BackendRepoServiceClient.fromConfig(config, "restoreBinderFromPublication");
}

const getImageServiceClient = () => {
    return BackendImageServiceClient.fromConfig(config, "restoreBinderFromPublication");
}

const getBinderRepository = () => {
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
};

const getPublicationRepository = () => {
    return new ElasticPublicationsRepository(config, logger, queryBuilderHelper);
};

function createNewBinder(
    title,
    isoCode,
    accountId,
    thumbnail: IThumbnail,
    meta: Array<BindersModuleMeta>,
    images: BindersImageModule,
    text: BindersTextModule
): BinderClass {
    const now = Date.now();
    const baseBinder = {
        bindersVersion: "0.4.2",
        authors: [],
        authorIds: [],
        accountId,
        languages: [
            {
                iso639_1: isoCode,
                modules: ["t1"],
                storyTitle: title,
                storyTitleRaw: title,
                priority: 0
            }
        ],
        links: { "index-pairs": [["t1", "i1"]] },
        modules: {
            meta,
            images,
            text,
        },
        thumbnail,
        binderLog: {
            current: [
                {
                    createdAt: now,
                    position: 0,
                    updatedAt: now,
                    uuid: UUID.random().toString(),
                    targetId: [],
                }
            ]
        }
    };
    return createBinder(baseBinder);
}


const doIt = async () => {
    const { publicationId, targetCollectionId } = getOptions();

    const repoClient = await getRepoServiceClient();
    const imageClient = await getImageServiceClient();
    const publicationRepo = await getPublicationRepository();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const binderRepo = await getBinderRepository();

    const publicationRaw = await publicationRepo.getPublication(publicationId);
    const { binderId: origBinderId, accountId, language: { iso639_1, storyTitle },
        thumbnail, modules } = publicationRaw;

    // console.log("******* looking for", iso639_1, "in", JSON.stringify(modules.meta, null, 2));

    const { key: textMetaKey } = modules.meta.find(metaModule => metaModule["iso639_1"] === iso639_1);

    const metaModule = modules.meta.reduce((reduced, metaEntry) => {
        if (metaEntry.type != "text") {
            return [...reduced, metaEntry];
        }
        if (metaEntry.key === textMetaKey) {
            return [
                ...reduced,
                {
                    ...metaEntry,
                    key: "t1"
                }
            ]
        }
        return reduced;
    }, []);

    const textModule = {
        chunked: modules.text.chunked.map(chunkedMod => ({
            ...chunkedMod,
            key: "t1",
            editorStates: chunkedMod.editorStates.map(es => RTEState.deserialize(es)),
        }))
    };

    const binderObj = createNewBinder(`[RESTORED] ${storyTitle}`, iso639_1, accountId, thumbnail, metaModule, modules.images, textModule as unknown as BindersTextModule);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binder = await repoClient.createBinderBackend(serializeEditorStates(binderObj) as any);

    const newBinderId = binder.id;

    const visuals = await imageClient.duplicateVisuals(origBinderId, newBinderId);
    const globalUrlMap = buildGlobalUrlMap(visuals);
    const toDuplicateChunks = binder.modules.images.chunked[0].chunks;
    const newVisualChunks = [];
    toDuplicateChunks.forEach(chunkItems => {
        const chunkVisuals = [];
        chunkItems.forEach(chunkItem => {
            const srcUrl = chunkItem["url"];
            const srcId = chunkItem["id"];
            const destUrl = getUrlTranslation(srcUrl, globalUrlMap, srcId);
            const [newImageId] = extractImageIdAndFormatFromUrl(destUrl);
            if (chunkItem["url"]) {
                chunkVisuals.push({
                    // eslint-disable-next-line @typescript-eslint/ban-types
                    ...(<Object>chunkItem),
                    url: destUrl,
                    id: newImageId,
                })
            } else {
                chunkVisuals.push(destUrl);
            }
        });

        newVisualChunks.push(chunkVisuals);
    });
    const thumbnailUrl = binder.thumbnail.medium;
    const updatedThumbnailUrl = thumbnailUrl ?
        getUrlTranslation(thumbnailUrl, globalUrlMap) :
        thumbnailUrl;
    const toUpdate = { ...binder, id: newBinderId };
    if (binder.storedVersion) {
        toUpdate["bindersVersion"] = binder.storedVersion;
    }
    toUpdate.thumbnail.medium = updatedThumbnailUrl;
    toUpdate.modules.images.chunked[0].chunks = newVisualChunks;

    await repoClient.updateBinder(toUpdate);
    await repoClient.addElementToCollection(targetCollectionId, "document", toUpdate.id, accountId);
};

doIt()
    .then(() => {
        console.log("All done!");
        process.exit(0);
    },
    error => {
        console.log("!!! Something went wrong.");
        console.error(error);
        process.exit(1);
    });