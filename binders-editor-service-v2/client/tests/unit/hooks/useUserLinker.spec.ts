import { UseUserInputResult, useUserInput } from "../../../src/shared/user-input/useUserInput";
import { act, renderHook } from "@testing-library/react-hooks";
import type { IAutocompleteItem } from "@binders/ui-kit/lib/elements/autocomplete";
import type { SearchUsersOrGroupsResult } from "../../../src/users/search";
import { UserInputType } from "../../../src/shared/user-input/UserInputTypeSwitcher";
import { useUserInputAutocomplete } from "../../../src/shared/user-input/useUserInputAutocomplete";
import { useUserLinker } from "../../../src/shared/UserLinker/useUserLinker";

type SearchFn = (accountId: string, query: string) => Promise<SearchUsersOrGroupsResult>
const alwaysTrue = () => true;
const identity = <T>(item: T) => item;
const emptySearch: SearchFn = async () => ({ hits: [], totalHits: 0 })

describe("useUserLinker", () => {
    const onCreateUsers = jest.fn();
    const onLinkUsers = jest.fn();
    const onLinkUsergroupIntersection = jest.fn();

    function renderHooks() {
        const { result: autocompleteResult } = renderHook(() => useUserInputAutocomplete(autocompleteProps()));
        const { result: userLinkerResult, rerender: rerenderUserLinker } = renderHook(
            props => useUserLinker({
                onCreateUsers,
                onLinkUsers,
                onLinkUsergroupIntersection,
                ...props,
            }),
            { initialProps: { initialUserInputType: UserInputType.Group } }
        );

        const freshUserInputProps = () => ({
            autocomplete: autocompleteResult.current,
            selectedItems: userLinkerResult.current.selectedItems,
            setSelectedItems: userLinkerResult.current.setSelectedItems,
        });

        const freshUserInputOptions = () => ({
            selectedUserInputType: userLinkerResult.current.selectedUserInputType,
            setSelectedUserInputType: userLinkerResult.current.setSelectedUserInputType,
        });

        const { result: userInputResult, rerender: rerenderUserInput } = renderHook(
            ({ props, options }) => useUserInput(props, options),
            { initialProps: { props: freshUserInputProps(), options: freshUserInputOptions() } }
        );

        return {
            userInputResult,
            userLinkerResult,
            rerenderUserLinker,
            rerenderUserInput: () => rerenderUserInput({
                props: freshUserInputProps(),
                options: freshUserInputOptions(),
            }),
        }
    }

    beforeEach(() => {
        onLinkUsers.mockReset();
        onLinkUsergroupIntersection.mockReset();
    });

    it("does not clear selected items when user input type changes between User and Group", () => {
        const { rerenderUserInput, userInputResult, userLinkerResult } = renderHooks();
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.Group));
        rerenderUserInput();
        selectSearchResult({ label: "Foo Bar", id: "gid-0" }, () => userInputResult.current)
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(1)
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.User));
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(1)
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.Group));
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(1)
    });

    it("clears selected items when user input type changes to GroupIntersection", () => {
        const { rerenderUserInput, userInputResult, userLinkerResult } = renderHooks();
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.User));
        rerenderUserInput();
        selectSearchResult({ label: "John Doe", id: "uid-0" }, () => userInputResult.current)
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(1)
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.GroupIntersection));
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(0);
    });

    it("links user ids", async () => {
        const { rerenderUserInput, userInputResult, userLinkerResult } = renderHooks();
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.User));
        rerenderUserInput();
        selectSearchResult({ label: "John Doe", id: "uid-2" }, () => userInputResult.current)
        rerenderUserInput();
        selectSearchResult({ label: "Bob", id: "uid-3" }, () => userInputResult.current)
        rerenderUserInput();
        expect(onCreateUsers).not.toHaveBeenCalled();
        act(() => userLinkerResult.current.saveAction());
        expect(onCreateUsers).not.toHaveBeenCalled();
        expect(onLinkUsers).toHaveBeenCalledWith(["uid-2", "uid-3"]);
    });

    it("links group ids", async () => {
        const { rerenderUserInput, userInputResult, userLinkerResult } = renderHooks();
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.Group));
        rerenderUserInput();
        selectSearchResult({ label: "Knitters", id: "gid-0" }, () => userInputResult.current)
        rerenderUserInput();
        selectSearchResult({ label: "France", id: "gid-1" }, () => userInputResult.current)
        rerenderUserInput();
        expect(onCreateUsers).not.toHaveBeenCalled();
        act(() => userLinkerResult.current.saveAction());
        expect(onCreateUsers).not.toHaveBeenCalled();
        expect(onLinkUsers).toHaveBeenCalledWith(["gid-0", "gid-1"]);
    });

    it("links usergroup intersections", async () => {
        const { rerenderUserInput, userInputResult, userLinkerResult } = renderHooks();
        act(() => userLinkerResult.current.setSelectedUserInputType(UserInputType.GroupIntersection));
        rerenderUserInput();
        selectSearchResult({ label: "Knitters", id: "gid-0" }, () => userInputResult.current)
        rerenderUserInput();
        selectSearchResult({ label: "France", id: "gid-1" }, () => userInputResult.current)
        rerenderUserInput();
        expect(userLinkerResult.current.selectedItems).toHaveLength(2);
        expect(onLinkUsers).not.toHaveBeenCalled();
        expect(onLinkUsergroupIntersection).not.toHaveBeenCalled();
        act(() => userLinkerResult.current.saveAction());
        expect(onCreateUsers).not.toHaveBeenCalled();
        expect(onLinkUsers).not.toHaveBeenCalled();
        expect(onLinkUsergroupIntersection).toHaveBeenCalledWith(["gid-0", "gid-1"])
    });

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
        searchGroups: emptySearch,
        searchUsers: emptySearch,
        userInputType: UserInputType.User,
        ...partialProps,
    }
}

function selectSearchResult(item: Partial<IAutocompleteItem>, userInput: () => UseUserInputResult) {
    act(() => userInput().onAddNewChip({
        id: "",
        label: "",
        value: "",
        rawLabel: "",
        ...item,
    }))
}

