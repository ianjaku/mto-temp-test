import { EditorItem, InheritedSettingsItem } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { extractTitle } from "@binders/client/lib/clients/repositoryservice/v3/helpers";

export function inheritedSettingsItemFrom(item: EditorItem): InheritedSettingsItem {
    return {
        id: item.id,
        title: extractTitle(item),
        isCollection: item.kind !== "document",
    }
}