/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import { BackendAccountServiceClient, BackendImageServiceClient, BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { EventType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { ImageServiceClient } from "@binders/client/lib/clients/imageservice/v1/client";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BinderRepositoryServiceClient as RepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { SingleTrackingRepositoryFactory } from "../trackingservice/repositories/eventRepository";
import { VideoDuration } from "@binders/client/lib/clients/imageservice/v1/contract";
import { fmtDateIso8601 } from "@binders/client/lib/util/date";
import { tmpdir } from "os";

const config = BindersConfig.get();
const loginOption = getMongoLogin("tracking_service");
const logger = LoggerBuilder.fromConfig(config);
// tslint:disable:no-console

const getAccountServiceClient = () => BackendAccountServiceClient.fromConfig(config, "download-read-data-csv-file");
const getRepositoryServiceClient = () => BackendRepoServiceClient.fromConfig(config, "tracking-service");
const getImageServiceClient = () => BackendImageServiceClient.fromConfig(config, "repo-service");

const getTrackingRepository = async () => {
    const collectionConfig = await CollectionConfig.promiseFromConfig(
        config,
        "tracking",
        loginOption,
    );
    const trackingRepositoryFactory = new SingleTrackingRepositoryFactory(collectionConfig, logger);
    const trackingRepository = trackingRepositoryFactory.build(logger);
    return trackingRepository;
}

const appendLineToFile = async (fileHandler: any, content: string[]): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        fileHandler.write(`${content.join(",")}\n`, (err) => {
            if (err) {
                console.log("ERROR", err);
                reject(err);
                return;
            }
            resolve();
        });
    });
};

const getSelectedAccounts = async (accountClient: AccountServiceClient): Promise<string[]> => {
    const selectedAccounts = process.argv.length > 2 ? process.argv.slice(2) : false;
    let accounts = await accountClient.listAccounts();
    if (selectedAccounts) {
        accounts = accounts.filter(acc => selectedAccounts.indexOf(acc.id) > -1);
    }
    return Array.from(new Set(accounts.map(acc => acc.id)));
}

const findVisualIdFromMedia = (media: any): string => {
    const url = typeof media === "string" ? media.replace(/http(s)?:\/\//i, "") : (media.id || media.url);
    return !url ? "" : url.split("/").find(p => p.indexOf("vid-") === 0 || p.indexOf("img-") === 0);
}

const headers = [
    "accountId",
    "date",
    "binderId",
    "publicationId",
    "chunk number",
    "number of images",
    "number of videos",
    "accumulated video duration",
    "word count",
    "read duration",
];

interface IBinderVideosDurations {
    binderId: string;
    videosDurations: VideoDuration;
}

class BindersVideosDurationManager {
    private bindersVideosDurations: IBinderVideosDurations[];
    private cacheHits: number;

    constructor(private readonly imageClient: ImageServiceClient) {
        this.cacheHits = 0;
        this.bindersVideosDurations = [];
    }

    public async getPublicationVideosDurations(publication: Publication): Promise<VideoDuration> {
        const binderVideosDurations = this.bindersVideosDurations.find(
            binderVideoDuration => binderVideoDuration.binderId === publication.binderId,
        );
        if (binderVideosDurations) {
            this.cacheHits++;
            return binderVideosDurations.videosDurations;
        }
        const { chunks } = publication.modules.images.chunked[0];
        const videosIds: string[] = [];
        (chunks || []).forEach(chunk => {
            (chunk || []).forEach((media: any) => {
                const mediaId = findVisualIdFromMedia(media);
                if (mediaId && mediaId.indexOf("vid-") === 0) {
                    videosIds.push(mediaId);
                }
            });
        });
        const hasVideos = videosIds.length > 0;
        const videosDurations = !hasVideos ? { durations: {}, skippedVisualIds: [] } : await this.imageClient.queryVideoDurations(videosIds);
        this.bindersVideosDurations.push({
            binderId: publication.binderId,
            videosDurations,
        });
        return videosDurations;
    }

    public reportCacheHits() {
        console.log("Manager prevented ", this.cacheHits, " calls to API Service");
    }
}

const makeTime = (duration: number): string => {
    const time = Math.round(duration / 1000);
    const isMinute = time > 60;
    return `${isMinute ? Math.round(time / 60) : time}${isMinute ? "m" : "s"}`
}

const calculateMediaCount = (publication: Publication, data: { newChunk: number }): { videoIds: string[], imageCount: number, videoCount: number } => {
    const imageModule = publication.modules.images.chunked[0].chunks[data.newChunk];
    let imageCount = 0;
    let videoCount = 0;
    const videoIds: string[] = [];
    (imageModule || []).forEach((media: any) => {
        const mediaId = findVisualIdFromMedia(media);
        if (mediaId && mediaId.indexOf("vid-") === 0) {
            videoIds.push(media.id);
            videoCount++;
        } else {
            imageCount++;
        }
    });
    return { videoIds, imageCount, videoCount };
}

const getBinderIdsFromEvents = (events: any[]): string[] => {
    return (events || []).reduce((ids, event) => {
        const { binderId } = (event.data || {}) as any;
        if (binderId && ids.indexOf(binderId) === -1) {
            ids.push(binderId);
        }
        return ids;
    }, []);
}

const loadPublicationsFromBinders = async (binderIds: string[], repoServiceClient: RepositoryServiceClient): Promise<Publication[]> => {
    return await repoServiceClient.findPublicationsBackend(
        { binderIds, summary: false },
        { maxResults: 1000 },
    ) as Publication[];
}

const makeTheMagicHappen = async () => {
    const start = Date.now();
    const [
        accountClient,
        repoServiceClient,
        imageServiceClient,
        trackingRepository,
    ] = await Promise.all([
        getAccountServiceClient(),
        getRepositoryServiceClient(),
        getImageServiceClient(),
        getTrackingRepository(),
    ]);
    const accountIds = await getSelectedAccounts(accountClient);
    try {
        const bindersVideosDurationManager = new BindersVideosDurationManager(imageServiceClient);
        const tmpFile = path.join(tmpdir(), `export-read-data-${Date.now()}.csv`);
        const handler = fs.createWriteStream(tmpFile, { flags: "a" });
        await appendLineToFile(handler, headers);

        let accountsToProccess = accountIds.length;
        for (const accountId of accountIds) {
            const accountProccessStart = Date.now();
            console.log("Proccessing:", accountId);
            const events = await trackingRepository.findEvents(
                accountId,
                {
                    eventTypes: [EventType.CHUNK_BROWSED]
                },
                {
                    orderBy: "timestamp",
                    sortOrder: "descending",
                },
            );
            const binderIds = getBinderIdsFromEvents(events);
            const publications = await loadPublicationsFromBinders(binderIds, repoServiceClient);
            for (const event of events) {
                const data = event.data as any;
                const publication = publications.find(pub => {
                    const id = data.documentType === "publication" ?
                        data.documentId :
                        data.binderId;
                    return pub.id === id;
                });

                if (!publication) {
                    break;
                }

                const { videoIds, imageCount, videoCount } = calculateMediaCount(publication, data);
                const videosDurations = await bindersVideosDurationManager.getPublicationVideosDurations(publication);
                const totalDuration = videoIds.reduce((acc, id) => acc + (videosDurations[id] || 0), 0);

                await appendLineToFile(handler, [
                    event.accountId,
                    fmtDateIso8601(new Date(event.timestamp)),
                    data.binderId,
                    data.documentId,
                    data.newChunk,
                    imageCount,
                    videoCount,
                    makeTime(totalDuration),
                    data.words || "0",
                    data.timeSpend ? `${Math.round(data.timeSpend / 1000)}s` : "0",
                ]);
            }
            console.log("Time elapsed: ", makeTime(Date.now() - accountProccessStart));
            console.log("Accounts to process: ", --accountsToProccess);
            console.log("-".repeat("Processing: ".length + accountId.length + 1));
        }
        handler.end("", () => {
            console.log("Wrote CSV data to:", tmpFile, "in", makeTime(Date.now() - start));
            bindersVideosDurationManager.reportCacheHits();
            process.exit(0);
        });
    } catch (err) {
        console.log("ERROR", err);
    }

};

makeTheMagicHappen();