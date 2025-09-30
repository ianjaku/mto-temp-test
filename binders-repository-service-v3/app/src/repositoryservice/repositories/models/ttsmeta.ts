import * as crypto from "crypto";
import { IPartialBoundary } from "@binders/client/lib/highlight/highlight";

export class TTSMeta {
    constructor(
        public readonly id: string,
        public readonly language: string,
        public readonly paragraphs: string[],
        public readonly boundaries: IPartialBoundary[],
        public readonly fileName: string,
    ) {}

    static createId(
        language: string,
        paragraphs: string[]
    ): string {
        const text = `${paragraphs.join("|")}`
        const hash = crypto.createHash("md5").update(text).digest("hex");
        return `${language}-${hash}`
    }

    static create(
        language: string,
        paragraphs: string[],
        boundaries: IPartialBoundary[],
        fileName: string
    ): TTSMeta {
        return new TTSMeta(
            this.createId(language, paragraphs),
            language,
            paragraphs,
            boundaries,
            fileName
        );
    }
}
