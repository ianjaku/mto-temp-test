import { FileTypeResult, fromBuffer } from "file-type";
import { Maybe } from "@binders/client/lib/monad";
import { fileExists } from "@binders/binders-service-common/lib/util/files";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const readChunk = require("read-chunk");

const readFirst1k = async (localFile: string): Promise<Maybe<Buffer>> => {
    const localFileExists = await fileExists(localFile);
    if (!localFileExists) {
        return Maybe.nothing<Buffer>();
    }
    return Maybe.just(await readChunk(localFile, 0, 1024));
};

export const detectMimeFromFilePath = async (localFile: string): Promise<Maybe<string>> => {
    const bufferMaybe = await readFirst1k(localFile);
    if (bufferMaybe.isNothing()) {
        return Maybe.nothing<string>();
    }
    const buffer = bufferMaybe.get();

    // we first perform this simple check, because file-type determines svg as application/xml (MT-3540)
    if (buffer.toString().indexOf("<svg") > -1) {
        return Maybe.just("image/svg+xml");
    }
    const contentMeta = await fromBuffer(buffer);
    if (contentMeta && contentMeta.mime) {
        return Maybe.just(contentMeta.mime);
    }
    return Maybe.nothing<string>();
};

export async function detectMimeFromBuffer(buffer: Buffer): Promise<string> {
    try {
        const contentMeta = await fromBuffer(buffer);
        const mime = await mimeFromContentMeta(contentMeta);
        return mime === "application/xml" ? "image/svg+xml" : mime;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`error while getting mime type from buffer: ${e}`);
        return undefined;
    }
}

async function mimeFromContentMeta(contentMeta: FileTypeResult): Promise<string> {
    if (!(contentMeta?.mime)) {
        throw new Error("Could not detect mime type");
    }
    return contentMeta.mime;
}