import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { differenceInDays, parseISO } from "date-fns";

export const countCollectionElements = (
    collection: DocumentCollection,
    ignoreIdsSet: Set<string>,
    includeDeletedElements = true
): number => {
    const elementCount = collection.elements.filter(el => !ignoreIdsSet.has(el.key)).length;
    if (collection.deletedElements == null || !includeDeletedElements) return elementCount;
    const deletedElementCount = collection.deletedElements.filter(el => !ignoreIdsSet.has(el.key)).length;
    return elementCount + deletedElementCount;
}

export const getAllCollectionElementIds = (
    collection: DocumentCollection,
    type?: string
): string[] => {
    const elements = collection.elements ?? [];
    const deletedElements = collection.deletedElements ?? [];
    const allElements = [...elements, ...deletedElements];
    if (type == null) return allElements.map(el => el.key);

    return allElements.filter(el => el.kind === type).map(el => el.key);
}

export const isDeleted = (item: Binder | DocumentCollection): boolean => {
    return item.deletionTime != null;
}

export const getDeletionTime = (item: Binder | DocumentCollection): Date => {
    if (item.deletionTime == null) return item.deletionTime;
    if (typeof item.deletionTime === "string") {
        return parseISO(item.deletionTime as string);
    }
    return item.deletionTime;
}

export const countDaysSinceDeletion = (item: Binder | DocumentCollection): number => {
    const deletionTime = getDeletionTime(item);
    if (deletionTime == null) return null;

    return differenceInDays(new Date(), deletionTime);
}
