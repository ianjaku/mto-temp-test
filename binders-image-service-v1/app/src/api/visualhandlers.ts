import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { BitmovinHandler } from "../visualhandlers/bitmovin/BitmovinHandler";
import { GifHandler } from "../visualhandlers/gif";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { SharpHandler } from "../visualhandlers/sharp";
import { SvgHandler } from "../visualhandlers/svg";
import { VisualHandler } from "../visualhandlers/contract";

export class VisualHandlers {

    static get(mime: string, logger: Logger): VisualHandler {
        switch (mime) {
            case "image/gif":
                return new GifHandler(logger);
            case "image/jpeg":
            case "image/png":
            case "image/tiff":
            case "image/webp":
                return new SharpHandler(logger);
            case "image/svg+xml":
                return new SvgHandler();
            case "video/avi":
            case "video/vnd.avi":
            case "video/mp4":
            case "video/mpeg":
            case "video/quicktime":
            case "video/x-flv":
            case "video/x-ms-wmv":
            case "video/webm":
            case "video/x-matroska":
            case "video/3gpp":
            case "video/x-msvideo": {
                const config = BindersConfig.get(60);
                return new BitmovinHandler(config, logger);
            }
            case "image/heic":
            case "image/heif":
                return undefined;
            default: {
                logger?.error(`Unsupported file mime-type: ${mime}`, "visual-handler")
                throw new Error(`Unsupported file mime-type: ${mime}`);
            }
        }
    }

    static isVisualTypeSupported(mime: string, logger: Logger): boolean {
        try {
            VisualHandlers.get(mime, logger);
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
