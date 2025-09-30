import { InvalidArgument } from "@binders/client/lib/util/errors";
import { finishRequest } from "@binders/binders-service-common/lib/middleware/routes";


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const devopsErrorHandler = (err, req, res, next) => {
    if (err instanceof InvalidArgument) {
        req?.logger?.error(`Could not find resource path ${req.url}`, "devops-error");
        finishRequest(req, res, 400, JSON.stringify({ error: { message: err.message } }));
        return;
    }
    next(err);
}

