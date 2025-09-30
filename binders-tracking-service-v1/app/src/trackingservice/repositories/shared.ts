import { SearchOptions as MongoSearchOptions } from "@binders/binders-service-common/lib/mongo/repository";
import { SearchOptions } from "@binders/client/lib/clients/trackingservice/v1/contract";

export function mapSearchOptions(clientSearchOptions: SearchOptions): MongoSearchOptions {
    const { maxResults, orderBy, sortOrder } = clientSearchOptions;
    const mongoOptions: MongoSearchOptions = {};
    if (maxResults !== undefined) {
        mongoOptions.limit = maxResults;
    }
    mongoOptions.orderByField = orderBy;
    mongoOptions.sortOrder = sortOrder === "descending" ? "descending" : "ascending";
    return mongoOptions;
}
