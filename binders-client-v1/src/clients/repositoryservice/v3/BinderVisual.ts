import { Binder, BindersChunkedImageModule, IBinderVisual, Publication } from "./contract";
import { isMobileDevice, isSafari } from "../../../react/helpers/browserHelper";
import { IDims } from "../../imageservice/v1/contract";
import { VisualAbstract } from "../../imageservice/v1/Visual";
import { assocPath } from "ramda";
import { buildTokenUrl } from "../../authorizationservice/v1/helpers";
import { createProxyUrlForManifest } from "../../imageservice/v1/visuals";

export interface IBestFitOptions {
    isLandscape: boolean;
    viewportDims: IDims;
}

export interface IRenderUrlOptions {
    isMobileSafari?: boolean;
    requestImage?: boolean;
    url?: string;
    requestedFormatNames?: string[]; // ordered by preference
    requestedFormatUrlRegex?: string;
    bestFitOptions?: IBestFitOptions;
    forceLowResVideo?: boolean;

    // If it's a video, at which timestamp do you want the thumbnail?
    // If there is no matching thumbnail (within 100ms of the requested time), then null will be returned (from buildRenderUrl)
    timeMs?: number; 
}

export class BinderVisual extends VisualAbstract implements IBinderVisual {
    binderId: string;
    token?: string;
    contentKeyId?: string;
    url?: string;
    startTimeMs?: number;
    endTimeMs?: number;
    
    isVideo(): boolean {
        if (!this.id) {
            // eslint-disable-next-line no-console
            console.error("Found visual without id", this);
        }
        return !!this.id && this.id.startsWith("vid-");
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    buildFallbackUrl() {
        const { urlToken } = this;
        return urlToken ? buildTokenUrl(this.url, urlToken) : this.url;
    }

    getManifestUrls(token: string): string[] {
        // IOS does not support the Media Source Extensions API, so we instead proxy the manifest through our backend to add in the auth tokens
        if (this.manifestUrls && (isMobileDevice() || isSafari())) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const imageServiceLocation = (window as any).bindersConfig.api.locations.image;
            const hlsManifestUrl = this.manifestUrls.find(url => url.includes(".m3u8"));
            return [createProxyUrlForManifest(imageServiceLocation, hlsManifestUrl, token)];
        }
        
        return this.manifestUrls;
    }
}

const toImageChunksWithParsedVisuals = (imageModuleChunked: BindersChunkedImageModule[]) => {
    return imageModuleChunked.map(imageModule => {
        const after = {
            ...imageModule,
            chunks: imageModule.chunks.map(visualChunkArr =>
                visualChunkArr.map(binderVisual => {
                    return Object.assign(Object.create(BinderVisual.prototype), binderVisual)
                })
            ),
        };
        return after;
    })
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const withParsedImageModule = <I extends Binder | Publication>(item: Binder | Publication) => {
    const updatedChunked = toImageChunksWithParsedVisuals(item.modules.images.chunked);
    return assocPath(["modules", "images", "chunked"], updatedChunked, item) as I;
}
