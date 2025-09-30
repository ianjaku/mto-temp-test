import {
    IItemsTransformerOptions,
    ItemsTransformer
} from  "@binders/binders-service-common/lib/itemstransformers";
import InheritedThumbnailTransformer, {
    InheritedThumbnailTransformerOptions
} from  "./InheritedThumbnails";
import { AccountServiceContract } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AddHasPublicationsTransformer } from "./addHasPublications";
import { AncestorBuilder } from "../ancestors/ancestorBuilder";
import {
    AuthorizationServiceContract
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import { CollectionRepository } from "../repositories/collectionrepository";
import {
    CollectionsWithoutPublicationsFilterTransformer
} from  "./collectionsWithoutPublicationsFilter";
import { HiddenAncestorsFilterTransformer } from "./hiddenAncestorsFilter";
import ImageFormatsTransformer from "@binders/binders-service-common/lib/itemstransformers/ImageFormats";
import { ImageServiceContract } from "@binders/client/lib/clients/imageservice/v1/contract";
import { JWTSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";
import { MultiRepository } from "../repositories/multirepository";
import { PublicNonAdvertisedFilterTransformer } from "./publicNonAdvertisedFilter";
import { PublicationRepository } from "../repositories/publicationrepository";


export interface ItemsTransformerOptions {
    accountId: string;
    userId?: string;
    addHasPublications?: boolean;
    inheritThumbnailOptions?: InheritedThumbnailTransformerOptions, // Will not inherit thumbnails if not passed
    transformImages?: IItemsTransformerOptions,
    filterCollectionsWithoutPublications?: boolean,
    filterItemsWithHiddenAncestors?: boolean,
    filterPublicNonAdvertised?: boolean, // Also requires userId to be set
}

export class ItemsTransformersFactory {

    constructor(
        private publicationRepository: PublicationRepository,
        private collectionRepository: CollectionRepository,
        private multiRepository: MultiRepository,
        private ancestorBuilder: AncestorBuilder,
        private jwtConfig: JWTSignConfig,
        private imageServiceContract: ImageServiceContract,
        private accountServiceContract: AccountServiceContract,
        private authorizationContract: AuthorizationServiceContract
    ) {}

    build(options: ItemsTransformerOptions): ItemsTransformer[] {
        const transformers: ItemsTransformer[] = [];

        if (options.addHasPublications) {
            transformers.push(new AddHasPublicationsTransformer(this.publicationRepository));
        }
        if (options.filterCollectionsWithoutPublications) {
            transformers.push(new CollectionsWithoutPublicationsFilterTransformer());
        }
        if (options.filterItemsWithHiddenAncestors) {
            transformers.push(new HiddenAncestorsFilterTransformer(options.accountId, this.accountServiceContract, this.ancestorBuilder));
        }
        if (options.filterPublicNonAdvertised) {
            transformers.push(
                new PublicNonAdvertisedFilterTransformer(
                    this.authorizationContract,
                    this.ancestorBuilder,
                    options.accountId,
                    options.userId
                )
            )
        }
        if (options.inheritThumbnailOptions) {
            transformers.push(
                new InheritedThumbnailTransformer(
                    options.inheritThumbnailOptions?.ancestorBuilder ?? this.ancestorBuilder,
                    this.collectionRepository,
                    this.jwtConfig,
                    this.multiRepository,
                    options.inheritThumbnailOptions
                )
            );
        }
        if (options.transformImages) {
            transformers.push(
                new ImageFormatsTransformer(
                    this.imageServiceContract,
                    this.jwtConfig,
                    options.transformImages
                )
            );
        }

        return transformers;
    }

}
