import {
    Binder,
    IDescendantsMap,
    MAXIMUM_NUMBER_OF_ITEMS,
    RecursiveErrors,
    RecursiveOperationError,
    ValidationResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { flattenDescendants, getValidationResult } from "./helper";
import { getBinderTitleMap, getCollectionTitleMap, idsFromDescendantsMap } from "../util";
import { BindersRepository } from "../repositories/binderrepository";
import { CollectionRepository } from "../repositories/collectionrepository";
import { PublicationRepository } from "../repositories/publicationrepository";

export interface IRecursiveActionValidator {
    validateRecursiveDelete(collectionId: string): Promise<ValidationResult>
    validateRecursivePublish(collectionId: string): Promise<ValidationResult>
    validateRecursiveUnpublish(collectionId: string): Promise<ValidationResult>
    validateRecursiveTranslate(collectionId: string): Promise<ValidationResult>
}

const OMIT_ROOT = false


export class RecursiveActionValidator implements IRecursiveActionValidator {

    async validateRecursiveDelete(collectionId: string): Promise<ValidationResult> {
        const descendants = await this.getDescendants(collectionId)
        const deleteErrors = []

        if (this.moreThanMaxNumberOfItems(descendants)) {
            deleteErrors.push({ error: RecursiveErrors.EXCEEDED_MAX_NUMBER })
        }

        if (await this.isRootCollection(collectionId)) {
            deleteErrors.push({ error: RecursiveErrors.GIVEN_ID_IS_ROOT_COLLECTION, isBinder: false, itemId: collectionId })
        }

        const binderIdsWithPublications = await this.findActivePublicationsInSubtree(descendants);
        let errorsWithoutTitles: RecursiveOperationError[] = []
        if (binderIdsWithPublications.length > 0) {
            binderIdsWithPublications.forEach(binderId => {
                errorsWithoutTitles.push({ error: RecursiveErrors.ACTIVE_PUBLICATIONS_EXISTS, itemId: binderId, isBinder: true })
            });
        }

        const instanceErrors = await this.getInstanceErrors(descendants)
        if (instanceErrors.length > 0) {
            errorsWithoutTitles = errorsWithoutTitles.concat(instanceErrors)
        }

        if (errorsWithoutTitles.length > 0) {
            const { collectionErrorsWithTitles, bindersErrorsWithTitles } = await this.fetchTitlesForErrors(errorsWithoutTitles);
            return {
                errors: [...deleteErrors, ...collectionErrorsWithTitles, ...bindersErrorsWithTitles],
                valid: false
            }
        }
        const affectedItemsCount = idsFromDescendantsMap(descendants).length;
        return getValidationResult(deleteErrors, affectedItemsCount);
    }

    async validateRecursivePublish(collectionId: string): Promise<ValidationResult> {
        const instanceErrorsAsWarnings = true
        return this.makeCommonValidation(collectionId, instanceErrorsAsWarnings)
    }

    async validateRecursiveUnpublish(collectionId: string): Promise<ValidationResult> {
        const instanceErrorsAsWarnings = true
        return this.makeCommonValidation(collectionId, instanceErrorsAsWarnings)
    }

    async validateRecursiveTranslate(collectionId: string): Promise<ValidationResult> {
        return this.makeCommonValidation(collectionId, false, true)
    }

    private async makeCommonValidation(collectionId: string, instanceErrorsAsWarnings = false, includeCollectionsInTotalAffected = false): Promise<ValidationResult> {
        const descendants = await this.getDescendants(collectionId)
        const commonErrors = []
        if (this.moreThanMaxNumberOfItems(descendants)) {
            commonErrors.push(RecursiveErrors.EXCEEDED_MAX_NUMBER)
        }

        if (await this.isRootCollection(collectionId)) {
            commonErrors.push(RecursiveErrors.GIVEN_ID_IS_ROOT_COLLECTION)
        }

        const instanceErrors = await this.getInstanceErrors(descendants);
        if (instanceErrors.length > 0) {
            const { errors, valid } = getValidationResult(commonErrors)
            const { collectionErrorsWithTitles, bindersErrorsWithTitles } = await this.fetchTitlesForErrors(instanceErrors);
            if (instanceErrorsAsWarnings) {
                return {
                    errors,
                    valid,
                    warnings: [...collectionErrorsWithTitles, ...bindersErrorsWithTitles]
                }
            } else {
                return {
                    errors: [...errors, ...collectionErrorsWithTitles, ...bindersErrorsWithTitles],
                    valid: false
                }
            }
        }
        let affectedItemsCount = idsFromDescendantsMap(descendants, "document").length;
        if (includeCollectionsInTotalAffected) {
            affectedItemsCount += idsFromDescendantsMap(descendants, "collection").length;
        }
        return getValidationResult(commonErrors, affectedItemsCount);
    }

    private async fetchTitlesForErrors(errors: RecursiveOperationError[]) {
        const bindersErrors = errors.filter(err => err.isBinder);
        const collectionErrors = errors.filter(err => !err.isBinder);
        let bindersErrorsWithTitles: RecursiveOperationError[] = [];
        if (bindersErrors.length > 0) {
            bindersErrorsWithTitles = await this.fetchBindersTitlesForErrors(bindersErrors);
        }
        let collectionErrorsWithTitles: RecursiveOperationError[] = [];
        if (collectionErrors.length > 0) {
            collectionErrorsWithTitles = await this.fetchCollectionTitlesForErrors(collectionErrors);
        }
        return { collectionErrorsWithTitles, bindersErrorsWithTitles };
    }

    private async getDescendants(collectionId: string): Promise<IDescendantsMap> {
        return this.collectionRepository.buildDescendantsMap(collectionId, OMIT_ROOT)
    }

    private moreThanMaxNumberOfItems(descendants: IDescendantsMap): boolean {
        const flattendItems = flattenDescendants(descendants)
        const documents = flattendItems.filter(el => el.kind === "document")

        return documents.length > MAXIMUM_NUMBER_OF_ITEMS
    }

    private async isRootCollection(collectionId: string): Promise<boolean> {
        const { isRootCollection } = await this.collectionRepository.getCollection(collectionId)
        return isRootCollection
    }

    private async findInstancesInSubtree(descendants: IDescendantsMap): Promise<string[]> {
        const flattendItems = flattenDescendants(descendants)
        return this.collectionRepository.getIdsOfMultiElements(flattendItems.map(item => item.key))
    }

    private async fetchBindersTitlesForErrors(errorsWithoutTitles: RecursiveOperationError[]): Promise<RecursiveOperationError[]> {
        const binderIds = errorsWithoutTitles.map((error) => error.itemId)
        const faultyBinders = await this.bindersRepository.findBinders({ binderIds }, { maxResults: 100 })
        const itemTitleMap = getBinderTitleMap(faultyBinders as Binder[]);
        return errorsWithoutTitles.map(err => ({ ...err, itemTitle: itemTitleMap[err.itemId] }))
    }

    private async fetchCollectionTitlesForErrors(errorsWithoutTitles: RecursiveOperationError[]): Promise<RecursiveOperationError[]> {
        const ids = errorsWithoutTitles.map((error) => error.itemId)
        const faultyCollections = await this.collectionRepository.findCollections({ ids }, { maxResults: 100 })
        const itemTitleMap = getCollectionTitleMap(faultyCollections);
        return errorsWithoutTitles.map(err => ({ ...err, itemTitle: itemTitleMap[err.itemId] }))
    }

    private async getInstanceErrors(descendants: IDescendantsMap) {
        const foundInstances = await this.findInstancesInSubtree(descendants);
        if (foundInstances.length > 0) {
            const flattendItems = flattenDescendants(descendants)
            const instanceMap = foundInstances.reduce((acc, curr) => {
                acc[curr] = true
                return acc
            }, {});

            const instancesElements = flattendItems.filter(el => instanceMap[el.key])
            return instancesElements.map(el => ({ error: RecursiveErrors.INSTANCES_EXIST, itemId: el.key, isBinder: el.kind === "document" }))

        }
        return []
    }

    private async findActivePublicationsInSubtree(descendants: IDescendantsMap): Promise<string[]> {
        const flattendItems = flattenDescendants(descendants)
        const bindersIds = flattendItems.filter(el => el.kind === "document").map(el => el.key)
        return this.publicationRepository.filterPublicationlessBinders(bindersIds)
    }

    constructor(
        private readonly collectionRepository: CollectionRepository,
        private readonly publicationRepository: PublicationRepository,
        private readonly bindersRepository: BindersRepository
    ) { }
    j
}