/* eslint-disable no-console */
const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");
const path = require("path");

const FFmpeg_URL = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"; // Update for your platform
const SCRIPT_DIR = __dirname; // Directory of the script itself
const TAR_FILE = path.join(SCRIPT_DIR, "ffmpeg.tar.xz");
const FFMPEG_BINARY = "ffmpeg"; // Binary file to extract

// Download FFmpeg
function downloadFFmpeg() {
    console.log(`Downloading FFmpeg from ${FFmpeg_URL}...`);
    return new Promise((resolve, reject) => {
        https.get(FFmpeg_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download FFmpeg. Status code: ${response.statusCode}`));
                return;
            }

            const totalSize = parseInt(response.headers["content-length"], 10); // Get total size from headers
            let downloadedSize = 0;

            const file = fs.createWriteStream(TAR_FILE);

            response.pipe(file);

            response.on("data", (chunk) => {
                downloadedSize += chunk.length;
                const percentage = ((downloadedSize / totalSize) * 100).toFixed(2);
                process.stdout.write(`\rDownload Progress: ${percentage}%`); // Overwrite the same line
            });

            file.on("finish", () => {
                file.close(() => {
                    console.log("\nDownload complete.");
                    resolve();
                });
            });

            response.on("error", (err) => {
                fs.unlink(TAR_FILE, () => reject(err)); // Cleanup on error
            });
        });
    });
}

function extractFFmpeg() {
    console.log("Extracting FFmpeg...");
    try {
        // Extract the tarball to a temporary location
        const tempDir = path.join(SCRIPT_DIR, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        execSync(`tar -xJf ${TAR_FILE} -C ${tempDir}`, { stdio: "inherit" });

        // Locate the `ffmpeg` binary
        const extractedDir = fs.readdirSync(tempDir).find((entry) =>
            fs.statSync(path.join(tempDir, entry)).isDirectory()
        );
        if (!extractedDir) {
            throw new Error("Failed to locate extracted directory.");
        }
        const ffmpegPath = path.join(tempDir, extractedDir, FFMPEG_BINARY);

        // Move `ffmpeg` to the script directory
        fs.renameSync(ffmpegPath, path.join(SCRIPT_DIR, FFMPEG_BINARY));
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log("FFmpeg extracted.");
    } catch (err) {
        throw new Error(`Failed to extract FFmpeg: ${err}`);
    }
}

// Clean up tar file
function cleanup() {
    console.log("Cleaning up...");
    if (fs.existsSync(TAR_FILE)) {
        fs.unlinkSync(TAR_FILE);
    }
}

// Main process
(async () => {
    try {
        await downloadFFmpeg();
        extractFFmpeg();
        cleanup();
        console.log(`FFmpeg binary is ready in ${SCRIPT_DIR}`);
    } catch (err) {
        console.error("Error preparing FFmpeg:", err);
        process.exit(1);
    }
})();
