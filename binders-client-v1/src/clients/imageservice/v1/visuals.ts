import { filetypeextension, filetypemime } from "magic-bytes.js";
import { isAndroid, isChrome, isMobileSamsungBrowser } from "../../../util/browsers";
import { TranslationKeys as TK } from "../../../i18n/translations";
import { Visual } from "./contract";
import accept from "attr-accept";
import i18n from "../../../i18n";
import { isBinderId } from "../../repositoryservice/v3/helpers";
import { isDev } from "../../../util/environment";


export function isVideoURL(url: string): boolean {
    return (url.match(/vid-[0-9a-f-]+/) !== null) ||
        (url.match(/bindersmedia-videos/) !== null);
}

export const isPlaceholderVisual = (url: string): boolean => {
    return url.indexOf("document-cover-default") !== -1;
}


export const extractBinderIdFromUrl = (url: string): string | undefined => {
    const urlParts = url.split("/").filter(part => !!part);
    if (urlParts.includes("binder-prod-images-cdn.azureedge.net")) {
        const imgProdIndex = urlParts.findIndex(p => p === "images-production");
        const potentialBinderId = `${urlParts[imgProdIndex + 1]}${urlParts[imgProdIndex + 2]}${urlParts[imgProdIndex + 3]}`;
        if (isBinderId(potentialBinderId)) {
            return potentialBinderId;
        }
    }
    const bindersIndex = urlParts.findIndex(p => p === "binders");
    const potentialBinderId = urlParts[bindersIndex + 1];
    return (isBinderId(potentialBinderId) && potentialBinderId) || undefined;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const extractIdFromUrl = (url) => {
    const urlParts = url.split("/").filter(part => !!part);
    return urlParts.find(p => isVisualId(p));
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function extractImageIdAndFormatFromUrl(url) {
    const stripQueryString = (part) => part.includes("?") ? part.substring(0, part.indexOf("?")) : part;

    const imageServicePattern = /\/images?\/v1\/binders\/(\S+)\/(\S+)\/(\S*)?/;
    let matches = url.match(imageServicePattern);
    if (matches) {
        return [matches[2], (matches[3] && stripQueryString(matches[3]).toLowerCase()) || "bare"];
    }

    // https://bindersmedia-visuals.azureedge.net/images-production//AV3q/5mPM/7xU0aRIt-8Ni/img-d830e33f-77a8-4ae5-b44a-5d406d04f580/MEDIUMst=token
    const imageCdnPattern = /https:\/\/.*\/\/(\S+)\/(\S+)\/(\S+)\/(\S+)\/(\S+)?\?/;
    matches = url.match(imageCdnPattern);
    if (matches) {
        return [matches[4], (matches[5] && stripQueryString(matches[5]).toLowerCase()) || "bare"]
    }

    // https://bindersmedia-videos.azureedge.net/asset-cab7a362-1992-485b-b127-ed87f8f14917/THUMBNAIL_000001VIDEO_SCREENSHOT?st=token
    const videoCdnPattern = /https:\/\/.*\/(.+)\/((\S)+_(\d)+)?(\S+)?\?/;
    matches = url.match(videoCdnPattern);
    if (matches) {
        return [undefined, (matches[5] && stripQueryString(matches[5]).toLowerCase()) || "bare"]
    }

    return [undefined, undefined];
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function extractBinderIdFromAzureUrl(url: string) {
    const match = url.match(/(images|images-production)\/\/(.*)\/img-/);
    if (match && match[2]) {
        return match[2].replace(/\//g, "");
    }
    return "";
}

export const isVideoId = (id: string): boolean => id.length === 40 && id.startsWith("vid");
const isVisualId = id => id.length === 40 && (id.startsWith("img") || id.startsWith("vid"));
export const isVideo = (visual: { id: string }): boolean => isVideoId(visual.id);
export const isAssetId = (id: string): boolean => id.length === 42 && id.startsWith("asset-");

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const ensureVisualBehaviourProps = (visual: Partial<Visual>) => {
    return {
        ...visual,
        fitBehaviour: visual.fitBehaviour || "fit",
        bgColor: visual.bgColor ? visual.bgColor : "FFFFFF",
    }
}

export class NoVideoFormatsError extends Error {
    static NAME = "NoVideoFormats";
    constructor() {
        super();
        this.name = NoVideoFormatsError.NAME;
        Object.setPrototypeOf(this, NoVideoFormatsError.prototype);
    }
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const fixDevUrl = (url: string, imageServiceHost: string, isPreview: boolean) => {
    const useUrl = !isDev() || isPreview;
    return useUrl ? url : url.replace(/http(s)?:\/\/(.)+:(\d)+/, imageServiceHost);
}

export const browserSupportsMime = (mime = ""): boolean => {
    return !mime.toLowerCase().includes("avi");
}

/**
 * Verifies whether a format can be displayed by the browser, this is to make sure
 * that both the codec and the file format (in the case of the original video) are fine.
 */
export const canVideoFormatBeDisplayedInBrowser = (formatName: string, mime: string, videoCodec: string): boolean => {
    if (formatName.toLowerCase() === "original") {
        // Even though the codec may be supported for the original, the mime may not
        return browserSupportsMime(mime) && browserSupportsVideoCodec(videoCodec);
    } else {
        // Other formats should have been transcoded
        return browserSupportsVideoCodec(videoCodec);
    }
}

export function browserSupportsVideoCodec(videoCodec: string): boolean {
    return (videoCodec || "").toLowerCase() === "h264";
}

export class UnsupportedVideoCodec extends Error {

    static readonly NAME = "UnsupportedVideoCodec";

    constructor(public readonly codec: string) {
        super();
        this.message = i18n.t(TK.Visual_UnsupportedVideoCodec, { codec });
        this.name = UnsupportedVideoCodec.NAME;
    }
}

export class UnsupportedAudioCodec extends Error {

    static readonly NAME = "UnsupportedAudioCodec";

    constructor(public readonly codec: string) {
        super();
        this.message = i18n.t(TK.Visual_UnsupportedAudioCodec, { codec });
        this.name = UnsupportedAudioCodec.NAME;
    }

}

export class UnsupportedMime extends Error {

    static readonly NAME = "UnsupportedMime";

    constructor(public readonly mime: string) {
        super();
        this.message = i18n.t(TK.Visual_UnsupportedMimeType, { mime });
        this.name = UnsupportedMime.NAME;
    }
}

export class UnsupportedMedia extends Error {

    static readonly NAME = "UnsupportedMedia";

    constructor(
        public readonly translationKey: string = TK.Visual_UnsupportedMediaType,
        public readonly translationParams: Record<string, string> = {},
    ) {
        super();
        // The message gets re-created on the client side, so it can be safely returned from the server without translation
        if (translationKey) {
            this.message = i18n.t(translationKey, translationParams);
        } else {
            this.message = i18n.t(TK.Visual_UnsupportedMediaType);
        }
        this.name = UnsupportedMedia.NAME;
    }
}
export const isUnsupportedMediaError = (error: Error): error is UnsupportedMedia => {
    return error.name === UnsupportedMedia.NAME;
}

const UNSUPPORTED_MEDIA_TYPE_ERRORS = [
    UnsupportedVideoCodec.NAME,
    UnsupportedAudioCodec.NAME,
    UnsupportedMedia.NAME,
    UnsupportedMime.NAME,
];

export const isUnsupportedMediaTypeError = (
    error: Error
): error is UnsupportedVideoCodec | UnsupportedAudioCodec | UnsupportedMedia | UnsupportedMime =>
    UNSUPPORTED_MEDIA_TYPE_ERRORS.includes(error.name);

function checkMimeByFileBuffer(file): Promise<string[]> {
    return new Promise(resolve => {
        const reader = new FileReader();
        const fileByteArray = [];
        let mime;
        let extension;
        reader.readAsArrayBuffer(file);
        reader.onloadend = (evt: ProgressEvent<FileReader>) => {
            if (evt.target.readyState === FileReader.DONE) {
                const arrayBuffer = evt.target.result as ArrayBufferLike;
                const array = new Uint8Array(arrayBuffer);
                for (const a of array) {
                    fileByteArray.push(a);
                }
                mime = filetypemime(fileByteArray);
                extension = filetypeextension(fileByteArray);
                if (mime.length > 0) {
                    resolve([mime[0], extension[0]]);
                } else {
                    resolve([]);
                }

            }
        }
    });
}

export const isImageMime = (file: unknown): boolean => accept(file, "image/*,.heic");
export const isVideoMime = (file: unknown): boolean => accept(file, "video/*");

export function getAcceptVisualsString(options: { includeVideos?: boolean } = { includeVideos: true }): string {
    if (isAndroid(navigator.userAgent) && isChrome(navigator.userAgent)) {
        return "image/*;capture=camera";
    }
    if (isMobileSamsungBrowser(navigator.userAgent)) {
        return `.png,.jpg,.jpeg,.svg,.gif,.webp,.heic${options.includeVideos ? ",.flv,.mov,.wmv,.avi" : ""}`;
    }
    return `image/*,.jpeg,.heic,.png${options.includeVideos ? ",video/mp4,video/*,.flv,.mov,.wmv,.avi" : ""}`;
}

export function getAcceptVideosString(): string {
    if (isAndroid(navigator.userAgent) && isChrome(navigator.userAgent)) {
        return "video/*;capture=camera";
    }
    if (isMobileSamsungBrowser(navigator.userAgent)) { // untested
        return ".flv,.mov,.wmv,.avi,video/mp4,video/*";
    }
    return "video/mp4,video/*,.flv,.mov,.wmv,.avi";
}

export async function fileListToFiles(files: FileList | File[], options: { includeVideos?: boolean } = { includeVideos: true }): Promise<File[]> {
    const filesArray = Array.from(files);
    if (filesArray.length === 0) {
        return [];
    }
    const supported = [];
    for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i];
        if (
            isImageMime(file) ||
            (options.includeVideos && isVideoMime(file))
        ) {
            supported.push(file);
        } else {
            try {
                const [mime, extension] = await checkMimeByFileBuffer(file);
                if (
                    mime.startsWith("image/") ||
                    (options.includeVideos && mime.startsWith("video/"))
                ) {
                    const f = new File([file], `${file.name}.${extension}`, { type: mime, lastModified: file.lastModified })
                    supported.push(f);
                }
            } catch (ex) {
                continue;
            }
        }
    }
    if (!supported.length) {
        throw new UnsupportedMedia(TK.Visual_UnsupportedMediaType)
    }
    return supported;
}

export async function generateVideoThumb(file: File): Promise<string> {
    const testVid = document.createElement("video");
    if (testVid.canPlayType(file.type) === "") {
        // eslint-disable-next-line no-console
        console.warn(`Cannot create preview for ${file.name} (vid)`);
        return null;
    }
    return new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        const video = document.createElement("video");
        // autoplay muted to ensure video gets loaded
        video.autoplay = true;
        video.muted = true;
        video.onloadeddata = () => {
            const ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            video.pause();
            const src = canvas.toDataURL("image/png");
            if (["data:,"].includes(src)) {
                // eslint-disable-next-line no-console
                console.error(`Cannot create preview for ${file.name} (vid) (canvas.toDataURL returned corrupted src)`);
                return resolve(null);
            }
            return resolve(src || null);
        };
        video.onerror = (e) => {
            // eslint-disable-next-line no-console
            console.error(`Cannot create preview for ${file.name} (vid) (${e["message"] ? e["message"] : e})`);
            return resolve(null);
        }
        video.src = URL.createObjectURL(file);
    });
}

export async function generateImageThumb(file: File): Promise<string> {
    return new Promise<string>((resolve) => {
        const testImg = document.createElement("img");
        testImg.onload = () => {
            return resolve(testImg.src);
        }
        testImg.onerror = () => {
            // eslint-disable-next-line no-console
            console.warn(`Cannot create preview for ${file.name} (img)`);
            return resolve(null);
        }
        testImg.src = URL.createObjectURL(file);
    });
}

export async function generateVisualThumb(file: File): Promise<string> {
    const isVideo = isVideoMime(file);
    if (isVideo) {
        return await generateVideoThumb(file);
    }
    return await generateImageThumb(file);
}

export function createProxyUrlForManifest(
    imageServiceBaseUrl: string,
    manifestUrl: string,
    token: string
): string {
    const url = [
        ...imageServiceBaseUrl.split("/"),
        "image",
        "v1",
        "hlsProxy",
        encodeURIComponent(manifestUrl),
        encodeURIComponent(token)
    ];
    return url.join("/");
}
