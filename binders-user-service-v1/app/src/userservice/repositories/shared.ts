import { SearchOptions as MongoSearchOptions } from "@binders/binders-service-common/lib/mongo/repository";
import { SearchOptions } from "@binders/client/lib/clients/userservice/v1/contract";

export function mapSearchOptions(clientSearchOptions: SearchOptions): MongoSearchOptions {
    const mongoOptions: MongoSearchOptions = {};
    if (clientSearchOptions.maxResults !== undefined) {
        mongoOptions.limit = clientSearchOptions.maxResults;
    }
    mongoOptions.orderByField = clientSearchOptions.orderBy === "login" ? clientSearchOptions.orderBy : "displayName";
    mongoOptions.sortOrder = clientSearchOptions.sortOrder === "descending" ? "descending" : "ascending";
    return mongoOptions;
}
