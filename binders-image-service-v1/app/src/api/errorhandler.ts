import * as HTTPStatusCode from "http-status-codes";
import {
    UnsupportedAudioCodec,
    UnsupportedMime,
    UnsupportedVideoCodec
} from  "@binders/client/lib/clients/imageservice/v1/visuals";
import { ProcessingJobRestartError } from "./service";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";

// @TODO: Investigate why this is not being triggered if the error happens inside busboy promises
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function imageErrorHandler (err, req, res, next): void {
    if (err.code === "ENOENT") {
        res.status(HTTPStatusCode.NOT_FOUND);
        res.send(JSON.stringify({error: err.message}));
        return;
    }

    if (err instanceof ProcessingJobRestartError) {
        finishRequest(req, res, HTTPStatusCode.BAD_REQUEST, err.message);
        return;
    }

    if (
        UnsupportedMime.NAME === err.name ||
        UnsupportedVideoCodec.NAME === err.name ||
        UnsupportedAudioCodec.NAME === err.name
    ) {
        finishRequest(req, res, HTTPStatusCode.UNSUPPORTED_MEDIA_TYPE, err.message);
        return;
    }

    next(err);
}