import { BrowserType } from "./browsers";
import { ReaderSections } from "../sections/reader/readersections";

/**
 * Waits until the video is playing, or throws an error. Assumes the document is open
 * @argument carrouselPositions - set to [-1] if the visual is not inside a carrousel
 */
export async function waitForPlayingVideos(
    reader: ReaderSections,
    chunk: number,
    carrouselPositions: number[],
    start = new Date(),
): Promise<void> {
    for (let i = 1; i < chunk; i++) {
        await reader.document.goToNextChunk();
    }

    let currentCarrouselPosition = 1;
    for (const carrouselPosition of carrouselPositions) {
        for (let i = currentCarrouselPosition; i < carrouselPosition; i++) {
            await reader.document.goToNextVisualInCarrousel(chunk);
            currentCarrouselPosition++;
        }
        const videoStatus = await reader.document.getVideoStatus(chunk, carrouselPosition);
        if (videoStatus === "transcoding") {
            if (new Date().getTime() - start.getTime() > 300_000) {
                throw new Error("Timeout waiting for video transcoding");
            }
            return waitForPlayingVideos(reader, chunk, carrouselPositions, start);
        }
        if (videoStatus === "playing") {
            continue;
        }
        throw new Error(`Video is not in an expected state (chunk: ${chunk}, carrouselPosition: ${carrouselPosition}, status: ${videoStatus})`)
    }
}



export function getScreenshotFilename(
    fileNameWithoutInfix: string,
    projectsRequiringInfix: BrowserType[],
    actualProject: string | BrowserType
): string {
    const [basename, extension] = fileNameWithoutInfix.split(".");
    const infix = projectsRequiringInfix.includes(actualProject as BrowserType) ?
        `-${actualProject}` :
        "";
    return `${basename}${infix}.${extension}`;
}
