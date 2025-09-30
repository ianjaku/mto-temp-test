// docs https://docs.microsoft.com/en-us/azure/media-services/video-indexer/video-indexer-use-apis
import {
    ITranscriptSection,
    IVideoIndexerResult,
    VideoIndexerStatus
} from "@binders/client/lib/clients/imageservice/v1/contract";
import fetch, { BodyInit } from "node-fetch";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { pick } from "ramda";

/*
** Note: videoIndexer functionality is temporarily disabled (MT-4890)
*/

const POLLING_DELAY = 10_000;  // 10 seconds
const POLL_BREAK_STATES = [VideoIndexerStatus.processed, VideoIndexerStatus.failed];
const RELEVANT_TRANSCRIPT_PROPS = ["text", "speakerId", "language"];

export enum VIDEOINDEXER_STATES {
    Processed = "Processed",
    Processing = "Processing",
    Failed = "Failed",
}

function buildGetServicePrincipalOAuthTokenUrl(azureAdTenantId: string): string {
    return `https://login.microsoftonline.com/${azureAdTenantId}/oauth2/v2.0/token`;
}

// function buildGenerateAccessTokenUrl(subscriptionId: string, resourceGroupName: string, accountName: string): string {
//     return `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.VideoIndexer/accounts/${accountName}/generateAccessToken?api-version=2022-07-20-preview`;
// }

type UploadVideoQueryParams = {
    // accessToken: string,
    name: string,
    description: string,
    privacy: "private",
    partition: "some_partition",
    indexingPreset: "AudioOnly",
    streamingPreset: "NoStreaming",
    videoUrl: string,
    callbackUrl: string,
};
function buildUploadVideoUrl(apiRoot: string, location: string, accountId: string, queryParams: UploadVideoQueryParams): string {
    const queryString = new URLSearchParams(queryParams);
    return `${apiRoot}/${location}/Accounts/${accountId}/Videos?${queryString}`;
}

type GetVideoIndexStatusQueryParams = {
    // accessToken: string,
    language: "English",
};
function buildGetVideoIndexStatusUrl(apiRoot: string, accountLocation: string, accountId: string, videoId: string, queryParams: GetVideoIndexStatusQueryParams): string {
    const queryString = new URLSearchParams(queryParams);
    return `${apiRoot}/${accountLocation}/Accounts/${accountId}/Videos/${videoId}/Index?${queryString}`;
}

function statusFromVideoIndexerState(state: string): VideoIndexerStatus {
    switch (state) {
        case VIDEOINDEXER_STATES.Processing: return VideoIndexerStatus.processing;
        case VIDEOINDEXER_STATES.Processed: return VideoIndexerStatus.processed;
        default: return VideoIndexerStatus.failed;
    }
}

type VideoIndexerConfig = {
    apiRoot: string;
    accountId: string;
    accountName: string;
    resourceGroup: string;
}

export type IndexVideoOnUpdateCallback = (result: IVideoIndexerResult) => void;
class VideoIndexer {
    private readonly imageServiceLocation: string;
    private readonly logger: Logger;
    private readonly accountId: string;
    private readonly apiRoot: string;
    // private accessToken: string = null;
    private pollingInterval: ReturnType<typeof setInterval> | undefined;
    private onUpdate: IndexVideoOnUpdateCallback;
    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly subscriptionId: string;
    private readonly resourceGroupName: string;
    private readonly ADAccountId: string;
    private readonly ADAccountName: string;
    private readonly location: string;
    private readonly tenantId: string;

    constructor(imageServiceLocation: string, logger: Logger, accountId: string) {
        this.imageServiceLocation = imageServiceLocation;
        this.logger = logger;
        this.accountId = accountId;

        const config = BindersConfig.get(60);

        const maybeCredentials = config.getObject("azure.servicePrincipal.app") as Maybe<{ login: string, password: string }>;
        const { login: clientId, password: clientSecret } = maybeCredentials.get();
        this.clientId = clientId;
        this.clientSecret = clientSecret;

        const maybeSubscriptionConfig = config.getObject("azure.subscription") as Maybe<{ [key: string]: string }>;
        const { tenantId } = maybeSubscriptionConfig.get();
        this.tenantId = tenantId;

        const videoIndexerConfigMaybe = config.getObject("azure.videoIndexer") as Maybe<VideoIndexerConfig>;
        const { apiRoot, accountId: ADAccountId, accountName: ADAccountName, resourceGroup } = videoIndexerConfigMaybe.get();
        this.apiRoot = apiRoot;
        this.ADAccountId = ADAccountId;
        this.ADAccountName = ADAccountName;
        this.resourceGroupName = resourceGroup;

        const maybeLocationCode = config.getString("azure.locationCode");
        this.location = maybeLocationCode.get();
    }

    public async indexVideo(visualId: string, visualUri: string, name: string, onUpdate: IndexVideoOnUpdateCallback): Promise<void> {
        const url = buildUploadVideoUrl(this.apiRoot, this.location, this.ADAccountId, {
            // accessToken: await this.getAccessToken(),
            name: name.slice(0, 80),
            description: name,
            privacy: "private",
            partition: "some_partition",
            indexingPreset: "AudioOnly",
            streamingPreset: "NoStreaming",
            videoUrl: visualUri,
            callbackUrl: `${this.imageServiceLocation}/videoIndexerCallback`,
        });
        this.logger.debug(`Uploading video with POST call to ${url}`, "video-indexer");
        const response = await fetch(url.toString(), { method: "POST" });
        const responseJson = await response.json();
        if (responseJson.ErrorType) {
            throw new Error(`Request failed ErrorType: ${responseJson.ErrorType}, Message: ${responseJson.Message}`);
        }
        const { id: msVideoId } = responseJson;
        this.pollingInterval = setInterval(() => this.pollVideo(msVideoId, visualId), POLLING_DELAY);
        this.onUpdate = onUpdate;
        this.onUpdate({
            msVideoId,
            visualId,
            status: VideoIndexerStatus.processing,
            accountId: this.accountId,
            percentageCompleted: 0,
        });
    }

    private async pollVideo(msVideoId: string, visualId: string): Promise<void> {
        try {
            const videoIndexerResult = await this.fetchVideoIndexerResult(msVideoId, visualId);
            if (POLL_BREAK_STATES.includes(videoIndexerResult.status)) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = undefined;
                return;
            }
            this.onUpdate(videoIndexerResult);
        } catch (e) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
            this.logger.error(`Unexpected failure while polling for video with id ${visualId}: ${e.message}`, "video-indexer");
        }
    }

    public async fetchVideoIndexerResult(msVideoId: string, visualId: string): Promise<IVideoIndexerResult> {
        const url = buildGetVideoIndexStatusUrl(this.apiRoot, this.location, this.ADAccountId, msVideoId, {
            // accessToken: await this.getAccessToken(),
            language: "English",
        });
        this.logger.debug(`Fetching video indexer result with GET call to ${url}`, "video-indexer");
        const response = await fetch(url);
        const responseJson = await response.json();
        if (responseJson.ErrorType) {
            throw new Error(`Request failed ErrorType: ${responseJson.ErrorType}, Message: ${responseJson.Message}`);
        }
        const { videos: [video] } = responseJson;
        const { state, failureMessage, processingProgress, insights } = video;
        const transcript: ITranscriptSection[] = (insights?.transcript || []).map(transcriptSection => ({
            ...pick(RELEVANT_TRANSCRIPT_PROPS, transcriptSection),
            start: transcriptSection.instances[0].start,
            /*
                note: instances is an array because transcript follows the same format as other props
                (such as keywords, topics) but in the context of transcripts, there should always be just 1 instance
            */
            end: transcriptSection.instances[0].end,
        }));

        const statusExtraInfo = failureMessage ? { statusExtraInfo: failureMessage } : {};
        const percentageCompleted = parseInt((processingProgress || "0").replace(/%/, ""));

        return {
            msVideoId,
            status: statusFromVideoIndexerState(state),
            ...statusExtraInfo,
            transcript,
            accountId: this.accountId,
            visualId,
            percentageCompleted,
        };
    }

    // private async getAccessToken(): Promise<string> {
    //     if (this.accessToken == null) {
    //         try {
    //             const oAuthToken = await this.fetchOAuthToken();
    //             this.accessToken = await this.fetchAccessToken(oAuthToken);
    //         } catch (e) {
    //             this.logger.error(`Error fetching the video indexer access token: ${e.message}`, "video-indexer");
    //             throw e;
    //         }
    //     }
    //     return this.accessToken;
    // }

    private async fetchOAuthToken(): Promise<string> {
        const url = buildGetServicePrincipalOAuthTokenUrl(this.tenantId);
        const params = new URLSearchParams({
            client_id: this.clientId,
            scope: "https://management.azure.com/.default",
            client_secret: this.clientSecret,
            grant_type: "client_credentials",
        }) as BodyInit;
        const response = await fetch(url, {
            method: "POST",
            body: params,
        });
        const responseJSON = await response.json();
        if (responseJSON.error) {
            const { error_codes, error_description } = responseJSON;
            throw new Error(`${JSON.stringify(error_codes)}: ${error_description}`);
        }
        const { access_token: oAuthToken } = responseJSON;
        return oAuthToken;
    }

    // private async fetchAccessToken(oAuthToken: string): Promise<string> {
    //     const url = buildGenerateAccessTokenUrl(this.subscriptionId, this.resourceGroupName, this.ADAccountName);
    //     const response = await fetch(url, {
    //         method: "POST",
    //         headers: {
    //             "Authorization": `Bearer ${oAuthToken}`,
    //             "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //             permissionType: "Contributor",
    //             scope: "Account",
    //         })
    //     });
    //     const responseJSON = await response.json();
    //     if (responseJSON.error) {
    //         const { code, message } = responseJSON.error;
    //         throw new Error(`${code}: ${message}`);
    //     }
    //     const { accessToken } = responseJSON;
    //     return accessToken;
    // }
}
export default VideoIndexer;

