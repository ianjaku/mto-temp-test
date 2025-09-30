import {
    ImageServiceContract,
    Visual,
    VisualStatus
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { Item, ItemWithImagesModule } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from ".";

export interface IProvideVisualStatusOptions {
    binderId: string;
}

const toItemWithVisualStatuses = (item: Item, visuals: Visual[]) => {
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
                chunked: toImageChunksWithVisualStatuses(itemWithImagesModule.modules.images.chunked, visuals),
            }
        }
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toImageChunksWithVisualStatuses = (imageModuleChunked: any[], visuals: Visual[]) => {
    return imageModuleChunked.map(imageModule => {
        return {
            ...imageModule,
            chunks: imageModule.chunks.map(imageChunkArr => {
                return (imageChunkArr.map(imageChunk => {
                    const { id } = imageChunk;
                    const visual = visuals.find(v=> v.id === id);
                    const status = visual ? visual.status : VisualStatus.PROCESSING;
                    return {
                        ...imageChunk,
                        status,
                    }
                }))
            })
        }
    })
}

class ProvideVisualStatusTransformer implements ItemsTransformer {

    constructor(
        private imageServiceContract: ImageServiceContract,
        private options: IProvideVisualStatusOptions
    ) { }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async items(items: Array<Item>) {
        if (!items) {
            return [];
        }
        const { binderId } = this.options;
        const visuals = await this.imageServiceContract.listVisuals(binderId);

        return items.reduce((reduced, item) => {
            return [...reduced, toItemWithVisualStatuses(item, visuals)];
        }, []);
    }
}

export default ProvideVisualStatusTransformer;