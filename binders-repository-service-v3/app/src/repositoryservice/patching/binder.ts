import { Binder, BindersChunkedImageModule, BindersChunkedTextModule } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { onlyEmptyArrays } from "../util";
import { stripHTML } from "@binders/client/lib/util/html";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const normalizeChunkCount = (binder: Binder, logger: Logger) => { // MT-142
    const allChunkedModules = [
        ...binder.modules.images.chunked,
        ...binder.modules.text.chunked
    ];
    const highestChunkCount = allChunkedModules.reduce((highest, chunkedModule) => {
        return chunkedModule.chunks && chunkedModule.chunks.length > highest ?
            chunkedModule.chunks.length :
            highest;
    }, 0);

    const { modules: { images: { chunked: chunkedImagesModules }, text: { chunked: chunkedTextModules } } } = binder;
    binder.modules.images.chunked = normalizeChunkedModules(chunkedImagesModules, highestChunkCount, logger, binder.id);
    binder.modules.text.chunked = normalizeChunkedModules(chunkedTextModules, highestChunkCount, logger, binder.id);

    return binder;
};

const normalizeChunkedModules = (chunkedModules: Array<BindersChunkedTextModule | BindersChunkedImageModule>, count: number, logger: Logger, binderId: string) => {
    return chunkedModules.reduce((reduced, module) => {
        const comesShort = (count - module.chunks.length) || 0;
        if (comesShort > 0) {
            logger.error(`chunkedModule ${module.key} of binder ${binderId} has incorrect number of chunks: ${module.chunks.length} (expected ${count}). Normalizing...`, "update-binder");
        }
        Array.from(Array(comesShort)).forEach(() => module.chunks.push([]));
        return reduced.concat(module);
    }, []);
};


const isEmptyModule = (mod) => {
    if(!mod || !mod.chunked ) {
        return true;
    }
    if(!mod.chunked[0] || onlyEmptyArrays(mod.chunked[0].chunks)) {
        return true
    }
    return false;
}

const isEmptyChunk = (chunk, imageChunk) => {
    if ((!chunk && !imageChunk) || (chunk.length === 0 && imageChunk.length === 0)) {
        return true;
    }
    return (!imageChunk || imageChunk.length === 0) && (!chunk[0] || stripHTML(chunk[0]).trim().length === 0);
}

const removeEmptyLastChunksFromModules = (modules) => {
    const [imageModule] = modules;
    const lastChunkIndex = modules[0].chunks.length - 1;
    let allModulesHaveEmptyLastChunk = true;
    for (const mod of modules) {
        const lastChunk = mod.chunks[lastChunkIndex];
        if (!isEmptyChunk(lastChunk, imageModule.chunks[lastChunkIndex])) {
            allModulesHaveEmptyLastChunk = false;
            break;
        }
    }
    if (allModulesHaveEmptyLastChunk) {
        modules.forEach(mod => mod.chunks.pop());
    }
    return {
        modules,
        didRemove: allModulesHaveEmptyLastChunk,
    };
}

export const removeEmptyLastChunks: (binder: Binder) => Binder = (binder: Binder) => {

    const { text, images } = binder.modules;

    if (isEmptyModule(text) || isEmptyModule(images)) {
        return binder;
    }

    const textModules = text.chunked;
    const imageModule = images.chunked[0];

    const modules = [
        imageModule,
        ...textModules,
    ];

    let { modules: updatedModules, didRemove } = removeEmptyLastChunksFromModules(modules);
    while (didRemove) {
        const result = removeEmptyLastChunksFromModules(updatedModules);
        updatedModules = result.modules;
        didRemove = result.didRemove;
    }

    const [ updatedImageModule, ...updatedTextModules ] = updatedModules;
    const updatedBinder = {
        ...binder,
        modules: {
            ...binder.modules,
            images: {
                ...images,
                chunked: [ updatedImageModule ],
            },
            text: {
                ...text,
                chunked: updatedTextModules,
            }
        }
    };
    return updatedBinder;
};
