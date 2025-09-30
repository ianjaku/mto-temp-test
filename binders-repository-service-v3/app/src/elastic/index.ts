export type ItemKind = "collection" | "document" | "publication"

export function resolveKindFromIndex(index: string): ItemKind {
    if (/binders-collections-v\d+/.test(index)) {
        return "collection";
    }
    if (/binders-binders-v\d+/.test(index)) {
        return "document";
    }
    if (/publications-v\d+/.test(index)) {
        return "publication";
    }
    throw new Error(`Unknown index: ${index}`);
}
