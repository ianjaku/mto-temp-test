import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { JSONContent } from "@tiptap/react";
import { safeJsonParse } from "@binders/client/lib/util/json";

function transformEmojiTag(html: string): string {
    return html.replace(/<img[^>]*alt=["']([^"']+)["'][^>]*\/?>/g, "$1");
}

function transformEmojiJson(jsonContent: JSONContent): JSONContent {
    if (jsonContent.attrs?.class === "twemoji") {
        return {
            type: "text",
            text: jsonContent.attrs.alt
        };
    }
    if (jsonContent.content) {
        jsonContent.content = jsonContent.content.map(child => transformEmojiJson(child));
    }
    return jsonContent;
}

/**
 * Function responsible for transforming inline emoji images (provided by twemoji to properly render them in DOM)
 * back to their unicode value, which is how they're saved in the database
 * @param binder The binder to normalize
 * @returns {Binder} The normalized binder
 */

export function normalizeEmojis(binder: Binder): Binder {
    return {
        ...binder,
        modules: {
            ...binder.modules,
            text: {
                ...binder.modules.text,
                chunked: binder.modules.text.chunked.map(textModule => {
                    if (!textModule.json) {
                        return textModule;
                    }
                    const updatedChunks = textModule.chunks.map(chunkArray => {
                        return chunkArray.map(chunk => transformEmojiTag(chunk));
                    });
                    const updatedJson = textModule.json.map(jsonStr => {
                        if (!jsonStr) {
                            return jsonStr;
                        }
                        const jsonContent = safeJsonParse(jsonStr);
                        if (!jsonContent) {
                            return jsonStr;
                        }
                        return JSON.stringify(transformEmojiJson(jsonContent));
                    });
                    return {
                        ...textModule,
                        chunks: updatedChunks,
                        json: updatedJson
                    };
                })
            }
        }
    }
}