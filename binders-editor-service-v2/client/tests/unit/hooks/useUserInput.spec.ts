import { UseUserInputAutocompleteResult, useUserInputAutocomplete } from "../../../src/shared/user-input/useUserInputAutocomplete";
import { UseUserInputResult, useUserInput } from "../../../src/shared/user-input/useUserInput";
import { act, renderHook } from "@testing-library/react-hooks";
import type { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import type { SearchUsersOrGroupsResult } from "../../../src/users/search";
import { UserInputType } from "../../../src/shared/user-input/UserInputTypeSwitcher";
import { useState } from "react";

const alwaysTrue = () => true;
const identity = <T>(item: T) => item;

type SearchFn = (accountId: string, query: string) => Promise<SearchUsersOrGroupsResult>

const dummySearchGroups: SearchFn = async (_accountId: string, query: string) => {
    switch (query) {
        case "foo":
            return { hits: [{ id: "gid-0", label: "Foo Bar", value: "gid-0", rawLabel: "Foo Bar" }], totalHits: 1 }
        default:
            return { hits: [], totalHits: 0 }
    }
}

const dummySearchUsers: SearchFn = async (_accountId: string, query: string) => {
    switch (query) {
        case "doe":
            return { hits: [{ id: "uid-0", label: "John Doe", value: "uid-0", rawLabel: "John Doe" }], totalHits: 1 }
        default:
            return { hits: [], totalHits: 0 }
    }
}

describe("useUserInput", () => {

    describe("autocomplete & select", () => {
        it("autocompletes & selects from groups for Group", async () => {
            const { result: selectedItemsResult } = renderHook(() => useState<IAutocompleteItem[]>([]))
            const { result: autocompleteResult } = renderHook(() => useUserInputAutocomplete(autocompleteProps({ userInputType: UserInputType.Group })));
            const [selectedItems, setSelectedItems] = selectedItemsResult.current;
            const { result: userInputResult } = renderHook(() => useUserInput({
                autocomplete: autocompleteResult.current,
                selectedItems,
                setSelectedItems,
            }, {}));
            assertEmptyAutocomplete(autocompleteResult.current);
            await searchAndSelectFirst("foo", () => autocompleteResult.current, () => userInputResult.current)
            assertEmptyAutocomplete(autocompleteResult.current);
            expect(selectedItemsResult.current.at(0)).toMatchObject([{ id: "gid-0", label: "Foo Bar" }])
        });

        it("autocompletes & selects from users for User", async () => {
            const { result: selectedItemsResult } = renderHook(() => useState<IAutocompleteItem[]>([]))
            const { result: autocompleteResult } = renderHook(() => useUserInputAutocomplete(autocompleteProps({ userInputType: UserInputType.User })));
            const [selectedItems, setSelectedItems] = selectedItemsResult.current;
            const { result: userInputResult } = renderHook(() => useUserInput({
                autocomplete: autocompleteResult.current,
                selectedItems,
                setSelectedItems,
            }, {}));
            assertEmptyAutocomplete(autocompleteResult.current);
            await searchAndSelectFirst("doe", () => autocompleteResult.current, () => userInputResult.current)
            assertEmptyAutocomplete(autocompleteResult.current);
            expect(selectedItemsResult.current.at(0)).toMatchObject([{ id: "uid-0", label: "John Doe" }])
        });

        it("autocompletes & selects from groups for GroupIntersection", async () => {
            const { result: selectedItemsResult } = renderHook(() => useState<IAutocompleteItem[]>([]))
            const { result: autocompleteResult } = renderHook(() => useUserInputAutocomplete(autocompleteProps({ userInputType: UserInputType.GroupIntersection })));
            const [selectedItems, setSelectedItems] = selectedItemsResult.current;
            const { result: userInputResult } = renderHook(() => useUserInput({
                autocomplete: autocompleteResult.current,
                selectedItems,
                setSelectedItems,
            }, {}));
            assertEmptyAutocomplete(autocompleteResult.current);
            await searchAndSelectFirst("foo", () => autocompleteResult.current, () => userInputResult.current)
            assertEmptyAutocomplete(autocompleteResult.current);
            expect(selectedItemsResult.current.at(0)).toMatchObject([{ id: "gid-0", label: "Foo Bar" }])
        });
    });

    describe("filtering", () => {
        it("uses both itemFilter and itemIdFilter", async () => {
            const initialProps = autocompleteProps({
                searchGroups: async () => ({
                    hits: [
                        { id: "uid-0", label: "Admin User", value: "admin@manual.to", rawLabel: "Admin User" },
                        { id: "uid-1", label: "John Doe", value: "john@doe.com", rawLabel: "John Doe" },
                        { id: "uid-2", label: "Reception Device User", value: "reception@company.com", rawLabel: "Reception Device User" },
                    ],
                    totalHits: 2,
                }),
                userInputType: UserInputType.Group,
            });
            const { result: autocompleteResult, rerender } = renderHook(
                props => useUserInputAutocomplete(props),
                { initialProps }
            );
            const itemFilter = item => !item.value.endsWith("@manual.to")
            const itemIdFilter = itemId => itemId !== "uid-1";
            assertEmptyAutocomplete(autocompleteResult.current);
            await updateSearchTerm("foo", () => autocompleteResult.current);
            expect(autocompleteResult.current.autocompleteData).toHaveLength(3);
            expect(autocompleteResult.current.autocompleteData).toMatchObject([{ id: "uid-0" }, { id: "uid-1" }, { id: "uid-2" }]);
            rerender({ ...initialProps, itemFilter });
            expect(autocompleteResult.current.autocompleteData).toMatchObject([{ id: "uid-1" }, { id: "uid-2" }]);
            rerender({ ...initialProps, itemFilter, itemIdFilter });
            expect(autocompleteResult.current.autocompleteData).toMatchObject([{ id: "uid-2" }]);
            rerender({ ...initialProps, itemIdFilter });
            expect(autocompleteResult.current.autocompleteData).toMatchObject([{ id: "uid-0" }, { id: "uid-2" }]);
        });
    })

});

function autocompleteProps(partialProps: Partial<Parameters<typeof useUserInputAutocomplete>[0]> = {}) {
    return {
        accountId: "",
        disallowGroups: true,
        hideTypeSelector: false,
        itemFilter: alwaysTrue,
        itemFormatter: identity,
        itemIdFilter: alwaysTrue,
        messageOverrides: {},
        needsEditorAccess: true,
        searchGroups: dummySearchGroups,
        searchUsers: dummySearchUsers,
        userInputType: UserInputType.User,
        ...partialProps,
    }
}

function assertEmptyAutocomplete(autocomplete: UseUserInputAutocompleteResult) {
    expect(autocomplete.autocompleteData).toHaveLength(0);
}

async function updateSearchTerm(query: string, autocomplete: () => UseUserInputAutocompleteResult) {
    await act(async () => autocomplete().onUpdateSearchTerm(query));
}

async function searchAndSelectFirst(query: string, autocomplete: () => UseUserInputAutocompleteResult, userInput: () => UseUserInputResult) {
    await updateSearchTerm(query, autocomplete);
    act(() => userInput().onAddNewChip(autocomplete().autocompleteData.at(0)))
}
