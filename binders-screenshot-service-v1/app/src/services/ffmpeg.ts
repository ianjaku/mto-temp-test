import { createWriteStream, readFileSync } from "fs";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { spawn } from "child_process";

const FFMPEG_PATH = "/usr/bin/ffmpeg";
const CATEGORY = "ffmpeg-service"

export async function takeScreenshot(logger: Logger, seek: string, outputPath: string, inputFile: string): Promise<void> {
    logger.info("take screenshoot", CATEGORY, { seek, outputPath, inputFile })
    const stdErrFile = `${outputPath}.stderr`;
    function printStderr() {
        const stderr = readFileSync(stdErrFile, "utf8");
        logger.error(`FFMPEG stderr: ${stderr}`, CATEGORY, stdErrFile)
    }
    return new Promise((resolve, reject) => {
        const tmpFile = createWriteStream(`${outputPath}`);
        const stdErr = createWriteStream(stdErrFile);
        const ffmpegArgs = [
            "-nostdin",
            "-y",
            "-ss",
            seek,
            "-i",
            inputFile,
            "-qscale:v",
            "2",
            "-frames:v",
            "1",
            "-f",
            "image2pipe",
            "-an",
            "-c:v",
            "png",
            "pipe:1"
        ];
        logger.info(`ffmpeg args: ${ffmpegArgs.join(" ")}`, CATEGORY);
        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

        ffmpeg.stdout.pipe(tmpFile);
        ffmpeg.stderr.pipe(stdErr);

        ffmpeg.on("close", function () {
            if (tmpFile.bytesWritten === 0) {
                printStderr();
                reject(`screenshots failed (not a video?), input ${inputFile}`);
            }
            tmpFile.end();
            resolve();
        });

        ffmpeg.on("error", function (err) {
            logger.error(`FFMPEG error: ${err}`, CATEGORY)
            printStderr();
            reject(err);
        });
    });
} 