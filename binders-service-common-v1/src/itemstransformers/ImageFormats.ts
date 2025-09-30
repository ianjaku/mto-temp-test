import { IItemsTransformerOptions, ItemsTransformer } from ".";
import { IThumbnail, Item, ItemWithImagesModule } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { IVisualFormatUrlMap, ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import { extractBinderIdFromUrl as clientExtractBinderIdFromUrl, extractIdFromUrl, isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { extractBinderIdFromAzureUrl, extractImageIdAndFormatFromUrl } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { JWTSignConfig } from "../tokens/jwt";
import { UrlToken } from "../tokens";
import { flatten } from "ramda";

export interface ICdnOptions {
    cdnnify?: boolean;
    thumbnailsOnly?: boolean;
}

const toItemWithUpdatedImageUrls = (item: Item, visualFormatUrlMap: IVisualFormatUrlMap, urlToken?: string) => {
    const imagesModule = item["modules"] && item["modules"]["images"];
    if (!imagesModule) {
        return item;
    }
    const itemWithImagesModule = item as ItemWithImagesModule;
    return {
        ...itemWithImagesModule,
        modules: {
            ...itemWithImagesModule.modules,
            images: {
                ...itemWithImagesModule.modules.images,
                chunked: toImageChunksWithUpdatedImageUrls(itemWithImagesModule.modules.images.chunked, visualFormatUrlMap, urlToken),
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toImageChunksWithUpdatedImageUrls = (imageModuleChunked: any[], visualFormatUrlMap: IVisualFormatUrlMap, urlToken?: string) => {
    return imageModuleChunked.map(imageModule => {
        return {
            ...imageModule,
            chunks: imageModule.chunks.map(imageChunkArr => {
                return (imageChunkArr.map(imageChunk => {
                    // eslint-disable-next-line prefer-const
                    let { id, url } = imageChunk;
                    const urlSet = visualFormatUrlMap[id];
                    // eslint-disable-next-line prefer-const
                    let { formats, manifestUrls, contentKeyId, sasToken } =
                        urlSet ||
                        { formats: undefined, manifestUrls: undefined, token: undefined, contentKeyId: undefined, sasToken: undefined };
                    if (!formats) {
                        const urlId = extractIdFromUrl(url);
                        const visualFormats = urlId && visualFormatUrlMap[urlId];
                        formats = (urlId && visualFormats && visualFormats.formats) || [];
                    }
                    if (url) {
                        const [, formatName] = extractImageIdAndFormatFromUrl(url);
                        if (formatName) {
                            const format = formats.find(f => f.name.toLowerCase() === formatName.toLowerCase());
                            if (format) {
                                url = format.url;
                            }
                        }
                    }
                    return {
                        ...imageChunk,
                        url,
                        ...(formats ?
                            { formatUrls: formats } :
                            {}
                        ),
                        manifestUrls,
                        contentKeyId,
                        urlToken,
                        sasToken
                    }
                }))
            })
        }
    })
}

function imgUrlAndIdFromChunk(imgChunk: unknown): { id: string, url: string } {
    if (typeof imgChunk === "string") {
        return {
            url: imgChunk,
            id: extractIdFromUrl(imgChunk),
        };
    }
    if (imgChunk["url"] && !imgChunk["id"]) {
        return {
            url: imgChunk["url"],
            id: extractIdFromUrl(imgChunk["url"]),
        };
    }
    return {
        url: imgChunk["url"],
        id: imgChunk["id"],
    };
}

function getVisualUrls(item: Item): Map<string, string> {
    const imagesModule = item["modules"] && item["modules"]["images"];
    if (imagesModule) {
        const chunked = imagesModule.chunked;
        const imageChunks = chunked[0].chunks;
        const visualUrlsMap = imageChunks.reduce((reduced, chunksArr) => {
            flatten(chunksArr).forEach(imgChunk => {
                const { url, id } = imgUrlAndIdFromChunk(imgChunk);
                if (url && id) {
                    reduced.set(id, url);
                }
            });
            return reduced;
        }, new Map<string, string>());
        return visualUrlsMap;
    }
    return undefined;
}

class ImageFormatsTransformer implements ItemsTransformer {

    constructor(
        private imageServiceContract: ImageServiceContract,
        private jwtConfig: JWTSignConfig,
        private options: IItemsTransformerOptions = {},
    ) {}

    extractBinderIdFromUrl(url: string): string {
        return extractBinderIdFromAzureUrl(url) || clientExtractBinderIdFromUrl(url);
    }

    async items(items: Array<Item>): Promise<Item[]> {
        if (!items) {
            return [];
        }
        const allBinderIds = new Set(items.map((item: Item) => {
            return item["binderId"] ? item["binderId"] : item.id;
        }));

        const { thumbnailsOnly, cdnnify: paramCdnnify, urlToken: paramUrlToken } = this.options;
        const cdnnify = paramCdnnify === undefined ? true : paramCdnnify;

        const visualIdsSet = items.reduce((reduced, item) => {
            const thumbnailId = extractIdFromUrl(item.thumbnail.medium);
            const idsSet = new Set([thumbnailId]);
            if (item["modules"]) {
                if (!thumbnailsOnly) {
                    const visualUrlsMap = getVisualUrls(item);
                    Array.from(visualUrlsMap.keys()).forEach(id => {
                        const url = visualUrlsMap.get(id);
                        if (url) {
                            allBinderIds.add(this.extractBinderIdFromUrl(url));
                        }
                        idsSet.add(id);
                    });
                }
            }
            idsSet.forEach(id => {
                reduced.add(id);
            });
            return reduced;
        }, new Set());

        let urlTokens: { [id: string]: UrlToken } = {};
        if (!cdnnify && !paramUrlToken) {
            urlTokens = await UrlToken.buildMany(Array.from(allBinderIds), this.jwtConfig, 1);
        }

        const visualIds = Array.from(visualIdsSet).filter(id => !!id) as string[];
        const visualFormatUrlMap: IVisualFormatUrlMap = await this.imageServiceContract.composeVisualFormatUrls(visualIds, { cdnnify });

        return items.reduce((reduced, item) => {
            let medium = item.thumbnail.medium;
            let thumbnail = item.thumbnail.thumbnail;
            const thumbnailId = isPlaceholderVisual(medium) ?
                undefined :
                extractIdFromUrl(medium);
            if (thumbnailId) {
                const { formats } = visualFormatUrlMap[thumbnailId] || { formats: [] };
                if (formats && formats.length) {
                    const mediumFormat = formats.find(({ name }) => name && (name.toLowerCase() === "medium"));
                    medium = mediumFormat ? mediumFormat.url : formats[0].url;
                    const thumbnailFormat = formats.find(({ name }) => name && (name.toLowerCase() === "thumbnail"));
                    thumbnail = thumbnailFormat ? thumbnailFormat.url : formats[0].url;
                }
            }
            const binderId = item["binderId"] || item.id;
            const urlToken = paramUrlToken || (urlTokens[binderId] && urlTokens[binderId].key);
            const thumbnailAlreadyHasToken = !!item.thumbnail.urlToken; // could have received one in a previous ItemTransformer (like InheritedThumbnails)
            let translatedItem = {
                ...item,
                thumbnail: {
                    ...item.thumbnail,
                    medium,
                    thumbnail,
                    ...(thumbnailAlreadyHasToken ? {} : { urlToken }),
                    id: thumbnailId,
                    url: medium,
                    formatUrls: (thumbnailId ? visualFormatUrlMap[thumbnailId] ?? {} : {}).formats,
                } as IThumbnail,
            };
            if (!thumbnailsOnly) {
                if (item["modules"]) {
                    translatedItem = toItemWithUpdatedImageUrls(translatedItem, visualFormatUrlMap, urlToken);
                }
            }
            return reduced.concat(translatedItem);
        }, []);
    }
}

export default ImageFormatsTransformer;