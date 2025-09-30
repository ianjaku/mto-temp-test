import { Maybe } from "@binders/client/lib/monad";
import { Response } from "express";

export interface MediaRange {
    start: Maybe<number>;
    stop: Maybe<number>;
}

export interface ICreateBlobOptions {
    contentType?: string;
}

export interface IExpressResponseOptions {
    fileName?: string;
    requiredETag?: string;
    range?: MediaRange;
    sas?: boolean;
    mime?: string;
}

export interface IObjectStorage {

    uploadLocalFile(
        blobName: string,
        localFile: string,
        options?: ICreateBlobOptions
    ): Promise<void>;

    streamToExpress(
        blobName: string,
        response: Response,
        options?: IExpressResponseOptions
    ): Promise<void>;

}
