import {
    NotifierKind,
    SimpleTarget
} from  "@binders/client/lib/clients/notificationservice/v1/contract";
import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import { TFunction } from "@binders/client/lib/react/i18n";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";

export function buildFormatTargetACItem(t: TFunction) {
    return (item: IAutocompleteItem): IAutocompleteItem => {
        const { id, label, value } = item;
        if (id.startsWith("uid")) {
            return { label, rawLabel: label, value, id };
        }
        return { label: `(${t(TranslationKeys.General_Group)}) ${label}`, rawLabel: label, value, id };
    }
}

export function targetACItemToSimpleTarget(item: IAutocompleteItem): SimpleTarget {
    if (item.id.startsWith("uid-")) {
        return {
            notifierKind: NotifierKind.USER_EMAIL,
            targetId: item.id
        };
    }
    if (item.id.startsWith("gid")) {
        return {
            notifierKind: NotifierKind.GROUP_EMAIL,
            targetId: item.id
        };
    }
    throw new Error(`Target with id ${item.id} not supported`);
}
