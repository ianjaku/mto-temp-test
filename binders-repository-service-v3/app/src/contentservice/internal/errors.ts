import { ContentServiceErrorCode } from "@binders/client/lib/clients/contentservice/v1/contract";

export class ContentServiceError extends Error {
    public code: ContentServiceErrorCode;
    constructor(code: ContentServiceErrorCode, message: string) {
        super(message)
        this.code = code;
    }
}
