import { IItemSearchOptions, } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";

export interface ISearchParams {
    accountId: string;
    options: IItemSearchOptions;
    queryString: string;
    userId?: string; // If no user is given, only public items will be returned

    transformers?: ItemsTransformer[]
}
