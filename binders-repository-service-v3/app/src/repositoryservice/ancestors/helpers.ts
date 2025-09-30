import { DocumentAncestors } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { uniq } from "ramda";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getUniqueAncestorsArray = (
    documentAncestors: DocumentAncestors,
    itemIdsToOmit?: string[]
) => {
    return uniq(Object.keys(documentAncestors)).filter(itm => (itemIdsToOmit || []).indexOf(itm) === -1);
};
