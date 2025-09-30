import * as path from "path";
import BitmovinApi, {
    AacAudioConfiguration,
    AclEntry,
    AclPermission,
    AzureInput,
    AzureOutput,
    CloudRegion,
    DashManifest,
    DashManifestDefault,
    DashManifestDefaultVersion,
    Encoding,
    EncodingOutput,
    Fmp4Muxing,
    H264PerTitleConfiguration,
    H264VideoConfiguration,
    HlsManifest,
    HlsManifestDefault,
    Input,
    ManifestGenerator,
    ManifestResource,
    Mp4Muxing,
    MuxingStream,
    Output,
    PerTitle,
    PresetConfiguration,
    StartEncodingRequest,
    Status,
    Stream,
    StreamInput,
    StreamMode,
    StreamSelectionMode,
    Thumbnail,
    ThumbnailAspectMode
} from "@bitmovin/api-sdk";
import { Logger, LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Video, VideoFormat } from "../../api/model";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import PrettyBitmovinLogger from "./BitmovinLogger";
import { VideoFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";
import { uniq } from "ramda";

// In seconds, the length of each "chunk" of video (Should be 2, 3, or 4)
const SEGMENT_LENGTH = 2;
// The path to which the manifests and segments will be written (relative to the root of the container)
const OUTPUT_PATH = "streams";
const FMP4_OUTPUT_PATH = OUTPUT_PATH + "/video/fmp4/{width}x{height}_{bitrate}";
const MP4_OUTPUT_PATH = OUTPUT_PATH + "/video/mp4";
// Path to the original video file relative to the root of the container
const ORIGINAL_PATH = "ORIGINAL";
const SEGMENT_NAMING = "seg_%number%.m4s";
const INIT_SEGMENT_NAME = "init.mp4";

// Per Title strategies
const FIXED_HEIGHT_SIZES = [ 240, 360, 480, 720, 1080 ];
const MAX_ALLOWED_VIDEO_HEIGHT = 1080;

export class TranscodeTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, TranscodeTimeoutError.prototype);  // ES5 >= requirement
    }
}

export class TranscodeFailError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, TranscodeFailError.prototype);  // ES5 >= requirement
    }
}

const privateAcl = new AclEntry({ permission: AclPermission.PRIVATE });

const addAudio = async (
    bitmovinApi: BitmovinApi,
    inputId: string,
    outputId: string,
    encodingId: string,
) => {
    const audioCodecConfiguration =
        await bitmovinApi.encoding.configurations.audio.aac.create(
            new AacAudioConfiguration({
                name: "audio bitrate:128000",
                bitrate: 128000,
            })
        );

    const audioStream = await createStream(bitmovinApi, encodingId, inputId, ORIGINAL_PATH, audioCodecConfiguration.id);

    await bitmovinApi.encoding.encodings.muxings.fmp4.create(
        encodingId,
        new Fmp4Muxing({
            segmentLength: SEGMENT_LENGTH,
            segmentNaming: SEGMENT_NAMING,
            initSegmentName: INIT_SEGMENT_NAME,
            streams: [new MuxingStream({ streamId: audioStream.id })],
            outputs: [
                new EncodingOutput({
                    outputId,
                    outputPath: OUTPUT_PATH + "/audio/128000/fmp4/",
                    acl: [privateAcl],
                }),
            ],
        })
    );
}

const createManifests = async (
    bitmovinApi: BitmovinApi,
    outputId: string,
    destinationPath: string,
    encodingId: string,
): Promise<{
    dashManifest: DashManifest,
    hlsManifest: HlsManifest,
}> => {
    const manifestOutput = new EncodingOutput({
        outputId: outputId,
        outputPath: destinationPath,
        acl: [privateAcl],
    });

    return {
        dashManifest: await bitmovinApi.encoding.manifests.dash.default.create(
            new DashManifestDefault({
                manifestName: "manifest.mpd",
                encodingId: encodingId,
                version: DashManifestDefaultVersion.V2,
                outputs: [manifestOutput],
            })
        ),
        hlsManifest: await bitmovinApi.encoding.manifests.hls.default.create(
            new HlsManifestDefault({
                manifestName: "manifest.m3u8",
                encodingId: encodingId,
                outputs: [manifestOutput],
            })
        )
    };
}

export const startBitmovinEncoding = async (
    bindersConfig: BindersConfig,
    visual: Video,
    azureContainerConfig: {
        accountName: string,
        accountKey: string,
        container: string,
    },
    options: {
        hasAudio: boolean;
    },
    logger: Logger,
): Promise<{
    manifestPaths: string[];
    encodingId: string;
    thumbnails: Thumbnail[];
}> => {
    const bitmovinApi = createBitmovinApi(bindersConfig, logger);
    const input = await bitmovinApi.encoding.inputs.azure.create(new AzureInput(azureContainerConfig));
    const output = await bitmovinApi.encoding.outputs.azure.create(new AzureOutput(azureContainerConfig));

    return await startPerTitleEncoding(bitmovinApi, visual, options, input, output);
}

export const waitForBitmovinEncodingToFinish = async (
    config: BindersConfig,
    encodingId: string,
    updateTranscodingState: () => Promise<void>,
    logger: Logger,
): Promise<{
    resolutions: {width: number, height: number}[];
}> => {
    const bitmovinApi = createBitmovinApi(config, logger);

    const waitingStartTime = new Date().getTime();
    const startedMoreThan20MinutesAgo = () => new Date().getTime() - waitingStartTime > 1000 * 60 * 20;
    const startedMoreThan5MinutesAgo = () => new Date().getTime() - waitingStartTime > 1000 * 60 * 5;

    let encoding = await bitmovinApi.encoding.encodings.get(encodingId);
    while ([Status.QUEUED, Status.RUNNING, Status.CREATED].includes(encoding.status)) {
        if (startedMoreThan20MinutesAgo()) {
            throw new Error(`Stopped waiting for ${encodingId} as it took more than 20 minutes to transcode`);
        }
        if (startedMoreThan5MinutesAgo()) {
            const logger = LoggerBuilder.fromConfig(config, "bitmovin");
            logger.error(`Encoding ${encodingId} is taking longer than 5 minutes to transcode`, "bitmovin");
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
        encoding = await bitmovinApi.encoding.encodings.get(encodingId);
        await updateTranscodingState();
    }

    if (encoding.status !== Status.FINISHED) {
        logger.error(`Failed to finish Bitmovin transcoding for encodingId ${encodingId}. Stuck at ${encoding.status}`, "bitmovin");
        if ([Status.CANCELED, Status.ERROR, Status.TRANSFER_ERROR].includes(encoding.status)) {
            throw new TranscodeFailError(`Bitmovin encoding ${encodingId} failed to finish with ${encoding.status}`);
        } else {
            throw new TranscodeTimeoutError(`Bitmovin encoding ${encodingId} timed out at ${encoding.status}`);
        }
    }

    const streams = await bitmovinApi.encoding.encodings.streams.list(encodingId);
    const resolutions = streams.items?.map(stream => ({
        width: stream?.appliedSettings?.width,
        height: stream?.appliedSettings?.height
    })).filter(stream => stream.width && stream.height);

    if (resolutions.length === 0) {
        logger.warn(`No mp4 resolutions found for encodingId ${encodingId}`, "bitmovin");
    }

    return { resolutions };
}

const createBitmovinApi = (config: BindersConfig, logger: Logger) => {
    return new BitmovinApi({
        apiKey: config.getString("bitmovin.apiKey").get(),
        logger: new PrettyBitmovinLogger(logger),
    });
}

const startPerTitleEncoding = async (
    bitmovinApi: BitmovinApi,
    visual: Video,
    options: {
        hasAudio: boolean;
    },
    input: Input,
    output: Output,
): Promise<{
    manifestPaths: string[];
    encodingId: string;
    thumbnails: Thumbnail[];
}> => {
    const visualId = visual.id.value();

    const encoding = await bitmovinApi.encoding.encodings.create(
        new Encoding({
            name: `${visualId} - Per-Title Encoding (FIXED_HEIGHT)`,
            cloudRegion: CloudRegion.AZURE_EUROPE_WEST,
        })
    );

    const configs = await createFixedHeightH264VideoConfigs(bitmovinApi, visual);

    const streams: Stream[] = [];
    for (const config of configs) {
        const stream = await createStream(bitmovinApi, encoding.id, input.id, ORIGINAL_PATH, config.id, StreamMode.PER_TITLE_TEMPLATE_FIXED_RESOLUTION);
        streams.push(stream);
        await createFmp4Muxing(bitmovinApi, encoding, output.id, FMP4_OUTPUT_PATH, stream.id);
        await createMp4Muxing(bitmovinApi, encoding, output.id, MP4_OUTPUT_PATH, stream.id);
    }

    const thumbnails: Thumbnail[] = [];
    const originalFormat = visual.formats.find(f => f.format === VideoFormatType.ORIGINAL);
    const duration = originalFormat?.durationInMs;

    const aspectRatio = originalFormat.width / originalFormat.height;

    const thumbnailHeight = Math.min(getOriginalVideoFormat(visual).height, 480);
    const thumnailWidth = Math.round(thumbnailHeight * aspectRatio);

    if (duration) {
        const stepSizeMs = duration / 9;
        const limitToOneDecimal = (nr: number) => Math.floor(nr * 10) / 10;
        const positions = Array.from(
            { length: 9 },
            (_, i) => limitToOneDecimal(stepSizeMs * i / 1000)
        );
        thumbnails.push(
            await addThumbnail(bitmovinApi, encoding, output.id, "", streams[0].id, thumnailWidth, thumbnailHeight, positions)
        );
    }

    // Bitmovin will error out if an audio stream is added for videos without audio
    if (options.hasAudio) {
        await addAudio(bitmovinApi, input.id, output.id, encoding.id);
    }

    const { dashManifest, hlsManifest } = await createManifests(bitmovinApi, output.id, OUTPUT_PATH, encoding.id);

    await bitmovinApi.encoding.encodings.start(
        encoding.id,
        new StartEncodingRequest({
            perTitle: new PerTitle({
                h264Configuration: new H264PerTitleConfiguration({
                    maxBitrate: 5800000,
                })
            }),
            manifestGenerator: ManifestGenerator.V2,
            vodDashManifests: [new ManifestResource({ manifestId: dashManifest.id })],
            vodHlsManifests: [new ManifestResource({ manifestId: hlsManifest.id })],
        })
    );

    return {
        encodingId: encoding.id,
        manifestPaths: [
            "/" + visualId  + "/" + path.join(OUTPUT_PATH, dashManifest.manifestName),
            "/" + visualId + "/" + path.join(OUTPUT_PATH, hlsManifest.manifestName)
        ],
        thumbnails
    }
};

const createFixedHeightH264VideoConfigs = async (
    bitmovinApi: BitmovinApi,
    visual: Video,
): Promise<H264VideoConfiguration[]> => {
    const configs: H264VideoConfiguration[] = [];
    for (const height of getValidVideoHeightsFor(visual)) {

        const originalFormat = getOriginalVideoFormat(visual);
        const aspectRatio = originalFormat.width / originalFormat.height;
        const width = height * aspectRatio;
        const widthEven = width - (width % 2);

        const config = await createH264VideoConfig(bitmovinApi, widthEven, height);
        configs.push(config);
    }
    return configs;
}

function getOriginalVideoFormat(visual: Video): VideoFormat {
    const originalFormat = visual.formats.find(f => f.format === VideoFormatType.ORIGINAL);
    if (originalFormat == null) {
        throw new Error(`Could not find original video format for ${visual.id}`);
    }
    return originalFormat;
}

/**
 * Decides which video sides should be used for encoding based on the video's original height
 * Based on the video height, it will cap the max height at either 1080 or the original video height if smaller
 * It also normalized the video height to be an even number to avoid encoding issue
 */
function getValidVideoHeightsFor(visual: Video): number[] {
    const originalVideoHeight = getOriginalVideoFormat(visual).height;
    const normalizedOriginalVideoHeight = originalVideoHeight - originalVideoHeight % 2;
    const maxVideoHeight = Math.min(normalizedOriginalVideoHeight, MAX_ALLOWED_VIDEO_HEIGHT);
    const availableHeights = uniq([ ...FIXED_HEIGHT_SIZES, maxVideoHeight ]);
    return availableHeights.filter(height => height <= maxVideoHeight);
}

const createH264VideoConfig = (
    bitmovinApi: BitmovinApi,
    width: number,
    height: number,
): Promise<H264VideoConfiguration> => {
    const config = new H264VideoConfiguration({
        name: height ? `H.264 ${height}p` : "H.264 no set height",
        presetConfiguration: PresetConfiguration.VOD_STANDARD,
        width,
        height,
    });
    return bitmovinApi.encoding.configurations.video.h264.create(config);
};

const createStream = (
    bitmovinApi: BitmovinApi,
    encodingId: string,
    inputId: string,
    inputPath: string,
    codecConfigId: string,
    mode?: StreamMode,
): Promise<Stream> => {
    const streamInput = new StreamInput({
        inputId,
        inputPath,
        selectionMode: StreamSelectionMode.AUTO,
    });
    const stream = new Stream({
        codecConfigId,
        inputStreams: [streamInput],
        mode
    });
    return bitmovinApi.encoding.encodings.streams.create(encodingId, stream);
};

const createFmp4Muxing = (
    bitmovinApi: BitmovinApi,
    encoding: Encoding,
    outputId: string,
    outputPath: string,
    streamId: string,
): Promise<Fmp4Muxing> => {
    const encodingOutput = new EncodingOutput({
        outputPath,
        outputId,
        acl: [ privateAcl ]
    });
    const muxing = new Fmp4Muxing({
        segmentLength: SEGMENT_LENGTH,
        outputs: [ encodingOutput ],
        streams: [ new MuxingStream({ streamId }) ]
    });
    return bitmovinApi.encoding.encodings.muxings.fmp4.create(encoding.id, muxing);
};

const createMp4Muxing = (
    bitmovinApi: BitmovinApi,
    encoding: Encoding,
    outputId: string,
    outputPath: string,
    streamId: string
): Promise<Mp4Muxing> => {
    const encodingOutput = new EncodingOutput({
        outputPath,
        outputId,
        acl: [ privateAcl ]
    });
    const muxing = new Mp4Muxing({
        filename: "{width}x{height}_{bitrate}.mp4",
        outputs: [ encodingOutput ],
        streams: [ new MuxingStream({ streamId }) ],
    });
    return bitmovinApi.encoding.encodings.muxings.mp4.create(encoding.id, muxing);
}

const addThumbnail = async (
    bitmovinApi: BitmovinApi,
    encoding: Encoding,
    outputId: string,
    outputPath: string,
    streamId: string,
    width: number,
    height: number,
    positions: number[]
): Promise<Thumbnail> => {

    return await bitmovinApi.encoding.encodings.streams.thumbnails.create(
        encoding.id,
        streamId,
        new Thumbnail({
            name: `Bitmovin thumbnail - ${height}p`,
            pattern: `thumbnail_${height}p_%number%.png`,
            width,
            height,
            aspectMode: ThumbnailAspectMode.CROP,
            positions,
            outputs: [
                new EncodingOutput({
                    outputId,
                    outputPath,
                    acl: [ privateAcl ],
                }),
            ],
        })
    )
}
