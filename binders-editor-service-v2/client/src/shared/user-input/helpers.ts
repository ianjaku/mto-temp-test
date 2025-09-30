import { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";

export interface IAutocompleteInfo {
    autocompleteData: Array<IAutocompleteItem>;
    autocompleteFilteredCount: number;
}

function pickMeaningful({ label, value, id }: Partial<IAutocompleteItem>): Partial<IAutocompleteItem> {
    return {
        id,
        label,
        value,
    };
}

export function buildAutoCompleteInfo(
    usersAndGroups: IAutocompleteItem[],
    itemIdFilter: (itemId: string) => boolean,
    itemFormatter: (item: Partial<IAutocompleteItem>) => IAutocompleteItem,
    itemFilter: (item: IAutocompleteItem) => boolean = () => true,
): IAutocompleteInfo {
    const filtered = usersAndGroups
        .filter(item => itemIdFilter(item.id))
        .map(pickMeaningful);
    const autocompleteFilteredCount = usersAndGroups.length - filtered.length;
    const autocompleteData: Array<IAutocompleteItem> = filtered
        .filter(itemFilter)
        .map(itemFormatter);
    return {
        autocompleteData,
        autocompleteFilteredCount
    };
}

export function labelValueNotEqual(item: IAutocompleteItem) {
    return function({ label, value }: IAutocompleteItem): boolean {
        return label !== item.label && value !== item.value;
    }
}
