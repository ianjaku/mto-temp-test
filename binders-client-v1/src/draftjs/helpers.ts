import { Binder } from "../clients/repositoryservice/v3/contract";
import RTEState from "./state";

function hasMissingEditorStates(binder) {
    return binder.modules.text.chunked.some(
        ({ editorStates, chunks }) => editorStates.length !== chunks.length
    );
}

function shouldRecreateEditorStates(binder) {
    return existNullEditorState(binder) ||
        hasMissingEditorStates(binder)
}

function transformEditorStates(binder, transform, calledFromServer = false): Binder {
    if (binder.toJSON) {
        binder = binder.toJSON();
    }
    const processChunkedModule = (chunkedModule) => {
        return {
            key: chunkedModule.key,
            chunks: chunkedModule.chunks,
            json: chunkedModule.json,
            editorStates: chunkedModule.editorStates ?
                chunkedModule.editorStates.map(transform) :
                []
        };
    };
    if (!calledFromServer && shouldRecreateEditorStates(binder)) {
        recreateMissingEditorStates(binder)
    }
    //if yes recreate editor state from chunk
    const result = {};
    for (const binderProperty in binder) {
        if (binderProperty.startsWith("_") || binderProperty === "modules") {
            continue;
        }
        result[binderProperty] = binder[binderProperty];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as any).modules = {
        meta: binder.modules.meta,
        images: binder.modules.images,
        text: {
            chunked: binder.modules.text.chunked.map(processChunkedModule)
        }
    };
    return result as Binder;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deserializeEditorStatesForTranslate = (binder, calledFromServer = false) => transformEditorStates(binder, RTEState.deserializeForTranslate, calledFromServer);
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deserializeEditorStates = (binder, calledFromServer = false) => transformEditorStates(binder, RTEState.deserialize, calledFromServer);
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const serializeEditorStates = (binder, calledFromServer = false) => transformEditorStates(binder, RTEState.serialize, calledFromServer);


function existNullEditorState(binder: Binder): boolean {
    return binder.modules.text.chunked.some(({ editorStates }) => editorStates.includes("null"))
}

function recreateMissingEditorStates(binder: Binder) {
    const chunkedTextModules = binder.modules.text.chunked
    for (const chunkedTextModule of chunkedTextModules) {
        const editorStates = chunkedTextModule.editorStates
        if (editorStates.includes("null")) {
            const newEditorStates = chunkedTextModule.chunks
                .map(chunk => {
                    return chunk[0] ? RTEState.createFromHtml(chunk[0]) : RTEState.createEmpty()
                })
                .map(RTEState.serialize)
            chunkedTextModule.editorStates = newEditorStates
        }
        if (editorStates.length !== chunkedTextModule.chunks.length) {
            const newEditorStates = chunkedTextModule.chunks
                .map((chunk, index) => {
                    return editorStates[index] ? editorStates[index] : RTEState.serialize(RTEState.createFromHtml(chunk.join("\n")))
                })
            chunkedTextModule.editorStates = newEditorStates
        }
    }
}