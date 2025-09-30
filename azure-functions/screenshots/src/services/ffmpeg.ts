import { chmodSync, existsSync, readFileSync } from "fs";
import { InvocationContext } from "@azure/functions";
import { createWriteStream } from "fs";
import { spawn } from "child_process";

const FFMPEG_PATH_GLOBAL_HOME = "/home/ffmpeg";
const FFMPEG_PATH_WWW_ROOT = "/home/site/wwwroot/ffmpeg";
const FFMPEG_PATH = existsSync(FFMPEG_PATH_GLOBAL_HOME) ? FFMPEG_PATH_GLOBAL_HOME : FFMPEG_PATH_WWW_ROOT;

export function setupBinary(context: InvocationContext): void {
    if (!existsSync(FFMPEG_PATH)) {
        context.log(`Chmod ffmpeg binary: ${FFMPEG_PATH}`)
        chmodSync(FFMPEG_PATH, "777");
    }
}

export async function takeScreenshot(context: InvocationContext, seek: string, outputPath: string, inputFile: string): Promise<void> {
    context.log("take screenshoot", { seek, outputPath, inputFile })
    const stdErrFile = `${outputPath}.stderr`;
    function printStderr() {
        const stderr = readFileSync(stdErrFile, "utf8");
        context.log(`FFMPEG stderr: ${stderr}`)
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
        context.log(`ffmpeg args: ${ffmpegArgs.join(" ")}`);
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
            context.log(`FFMPEG error: ${err}`)
            printStderr();
            reject(err);
        });
    });
}
