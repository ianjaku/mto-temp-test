import * as express from "express";
import { EntityIdentifier } from "../../model/entities";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import UUID from "@binders/client/lib/util/uuid";

export const CORRELATION_KEY_HTTP_HEADER = "X-Binders-Request-CorrelationId";

export class CorrelationKey extends EntityIdentifier<string> {

    private static PREFIX = "cor-";

    protected assert(id: string): void {
        if (! id || ! id.startsWith(CorrelationKey.PREFIX)) {
            throw new InvalidArgument(`Invalid correlation id '${id}'`);
        }
    }

    static generate(): CorrelationKey {
        const id = UUID.randomWithPrefix(CorrelationKey.PREFIX);
        return new CorrelationKey(id);
    }

    static fromExpressRequestHeader(
        request: express.Request,
        key: string = CORRELATION_KEY_HTTP_HEADER
    ): CorrelationKey {
        const headerValue = request.get(key);
        return headerValue ?
            new CorrelationKey(headerValue) :
            CorrelationKey.generate();
    }
}
