import { Binder, DocumentCollection } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { getBinderMasterLanguage } from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { isCollectionItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";

export function sanitizeFilename(name: string): string {
    return name
        .replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ-_ ]/g, "") // remove all except numeric, alpha (including accents), dash, underscore and space
        .replace(/ /g, "_"); // replace spaces by underscores
}

export function buildDirName(item: Binder | DocumentCollection): string {
    if (isCollectionItem(item)) {
        return item.titles[0].title;
    }
    const masterLanguage = getBinderMasterLanguage(item);
    return sanitizeFilename(masterLanguage.storyTitle);
}
