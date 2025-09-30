import FfmpegCommand, { ffprobe } from "fluent-ffmpeg";
import { Logger } from "@binders/binders-service-common/lib/util/logging";


async function getAudioCodecs(inputFile, logger: Logger) {
    return new Promise<string[]> ( (resolve) => {
        ffprobe(inputFile, function (err, ffmpegMetadata) {
            if (err) {
                logger.logException(err, "get-audio-codecs");
                resolve([]);
            }
            const audioCodecs = [];
            for (const stream of ffmpegMetadata.streams) {
                if (stream.codec_type === "audio") {
                    const audioCodec = stream.codec_name;
                    if (audioCodec === "unknown") {
                        audioCodecs.push(stream.codec_tag_string);
                    } else {
                        audioCodecs.push(audioCodec);
                    }
                }
            }
            resolve(audioCodecs);
        });
    });
}

export async function maybeStripAPAC(inputFile: string, logger: Logger): Promise<string> {
    // 2025-04-01: Bitmovin currently doesn't support APAC audio codec (used by iPhone 16)
    // so we need to strip it out before uploading to Bitmovin
    const audioCodecs = await getAudioCodecs(inputFile, logger);
    if (!audioCodecs.includes("apac")) {
        return inputFile;
    }
    const outputFile = `${inputFile}.noAPAC.mov`;
    return new Promise<string>( (resolve) => {
        const cmd = FfmpegCommand()
            .input(inputFile)
            .output(outputFile)
            .videoCodec("copy")
            .on("end", () => resolve(outputFile))
            .on("error", (err) => {
                logger.logException(err, "strip-apac");
                resolve(inputFile);
            });
        if (audioCodecs.length === 1) {
            cmd.noAudio().run();
        } else {
            const cmdWithAudio = audioCodecs.reduce(
                (acc, codec, index) => {
                    if (codec === "apac") {
                        return acc;
                    } else {
                        // Copy all other audio streams
                        return acc.addOutputOption(`-c:a:${index} copy`);
                    }
                },
                cmd
            )
            cmdWithAudio.run();
        }
    });

}