import { useCallback, useMemo } from "react";
import { buildLink } from "@binders/client/lib/binders/readerPath";
import { getPathFromParentItems } from "../../documents/actions";
import { getReaderLocation } from "@binders/client/lib/util/domains";
import { useActiveBrowsePathOrDefault } from "../../browsing/hooks";
import { useCurrentDomain } from "../../accounts/hooks";

export function useOpenReaderWindow(
    { collection }: { collection?: string | null }
) {
    const browseContext = useActiveBrowsePathOrDefault([]);
    const domain = useCurrentDomain();
    const readerLocation = useMemo(() => getReaderLocation(domain), [domain]);
    return useCallback(() => {
        if (!collection) return;
        const url = buildLink({
            isCollection: true,
            itemId: collection,
            parentCollections: getPathFromParentItems(undefined, browseContext),
            domain,
            readerLocation,
            isDraft: false,
        });
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (win) {
            win.focus();
        }
    }, [collection, browseContext, domain, readerLocation]);
}
