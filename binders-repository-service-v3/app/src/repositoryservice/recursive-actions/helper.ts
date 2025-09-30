import {
    CollectionElement,
    IDescendantsMap,
    RecursiveErrors,
    ValidationResult
} from "@binders/client/lib/clients/repositoryservice/v3/contract";

export function flattenDescendants(descendants: IDescendantsMap): CollectionElement[] {
    return Object.keys(descendants).reduce((acc: CollectionElement[], lvl) => [...acc, ...descendants[lvl]], [])
}

export function getValidationResult(errors: RecursiveErrors[] = [], affectedItemsCount?: number): ValidationResult {
    return {
        errors: errors.map(error => ({ error })),
        valid: errors.length === 0,
        affectedItemsCount,
    }
}