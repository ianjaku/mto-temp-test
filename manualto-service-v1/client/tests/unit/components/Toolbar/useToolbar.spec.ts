import { Expansion, Visibility } from "../../../../src/views/reader/Toolbar/types";
import { ToolbarState, useToolbar } from "../../../../src/views/reader/Toolbar/useToolbar";
import { act, renderHook } from "@testing-library/react-hooks";

describe("useToolbar", () => {

    describe("on desktop", () => {
        it("all icons are visible for editors", () => {
            const { result } = renderHook(() => useToolbar({
                canEdit: true,
                isMobileView: false,
                translatedLanguage: undefined,
                isSingleUndefinedLanguage: false,
            }));
            assertEditButtonVisibility(result.current, "visible");
            assertAllExpanded(result.current);
        });
        it("all icons are visible for readers", () => {
            const { result } = renderHook(() => useToolbar({
                canEdit: false,
                isMobileView: false,
                translatedLanguage: undefined,
                isSingleUndefinedLanguage: false,
            }));
            assertEditButtonVisibility(result.current, "hidden");
            assertAllExpanded(result.current);
        })
        it("should not collapse when language is expanded", () => {
            const { result } = renderHook(() => useToolbar({
                canEdit: true,
                isMobileView: false,
                translatedLanguage: undefined,
                isSingleUndefinedLanguage: false,
            }));
            act(() => result.current.setLanguageToolbarExpansion("expanded"));
            const state = result.current
            assertActionsExpanded(state);
            assertCloseButton(state, "hidden");
            assertEditButtonVisibility(state, "visible");
            assertLanguageToolbar(state, "expanded", "visible");
            assertNavigation(state, "expanded");
        });
    })

    describe("on mobile", () => {
        describe("when user can NOT edit the document", () => {

            describe("in multiple languages", () => {
                const properties = {
                    canEdit: false,
                    isMobileView: true,
                    translatedLanguage: undefined,
                    isSingleUndefinedLanguage: false,
                };
                it("should return correct initial state", () => {
                    const { result: { current: state } } = renderHook(() => useToolbar(properties));
                    assertActionsNotRendered(state);
                    assertCloseButton(state, "hidden");
                    assertEditButtonVisibility(state, "hidden");
                    assertLanguageToolbar(state, "collapsed", "visible");
                    assertNavigation(state, "expanded");
                });
            })

            describe("machine translated from single undefined language", () => {
                const properties = {
                    canEdit: false,
                    isMobileView: true,
                    translatedLanguage: "sk",
                    isSingleUndefinedLanguage: true,
                };
                it("should return correct initial state", () => {
                    const { result: { current: state } } = renderHook(() => useToolbar(properties));
                    assertActionsNotRendered(state);
                    assertCloseButton(state, "visible");
                    assertEditButtonVisibility(state, "hidden");
                    assertLanguageToolbar(state, "expanded", "visible");
                    assertNavigation(state, "collapsed");
                });
                it("should collapse when language is expanded", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    act(() => result.current.setLanguageToolbarExpansion("expanded"));
                    assertExpandedLanguage(result.current);
                });
            });

            describe("original in undefined language", () => {
                const properties = {
                    canEdit: false,
                    isMobileView: true,
                    translatedLanguage: undefined,
                    isSingleUndefinedLanguage: true,
                };
                it("should return correct initial state", () => {
                    const { result: { current: state } } = renderHook(() => useToolbar(properties));
                    assertActionsNotRendered(state);
                    assertCloseButton(state, "hidden");
                    assertEditButtonVisibility(state, "hidden");
                    assertLanguageToolbar(state, "collapsed", "visible");
                    assertNavigation(state, "expanded");
                });
                it("should collapse when language is expanded", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    act(() => result.current.setLanguageToolbarExpansion("expanded"));
                    assertEditButtonVisibility(result.current, "hidden");
                    assertExpandedLanguage(result.current);
                });
            })

        });

        describe("when user can edit the document", () => {
            describe("in multiple languages", () => {
                const properties = {
                    canEdit: true,
                    isMobileView: true,
                    translatedLanguage: undefined,
                    isSingleUndefinedLanguage: false,
                };
                it("should return correct initial state", () => {
                    const { result: { current: state } } = renderHook(() => useToolbar(properties));
                    assertActionsCollapsed(state);
                    assertCloseButton(state, "hidden");
                    assertEditButtonVisibility(state, "visible");
                    assertLanguageToolbar(state, "collapsed", "visible");
                    assertNavigation(state, "expanded");
                });
            })

            describe("machine translated from single undefined language", () => {
                const properties = {
                    canEdit: true,
                    isMobileView: true,
                    translatedLanguage: "sk",
                    isSingleUndefinedLanguage: true,
                };
                it("should return correct initial state", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    const state = result.current;
                    assertActionsNotRendered(state);
                    assertCloseButton(state, "visible");
                    assertEditButtonVisibility(state, "hidden");
                    assertLanguageToolbar(state, "expanded", "visible");
                    assertNavigation(state, "collapsed");
                });
                it("should collapse when closed", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    act(() => result.current.collapse());
                    const state = result.current;
                    assertEditButtonVisibility(state, "visible");
                    assertLanguageToolbar(state, "collapsed", "visible");
                    assertNavigation(state, "expanded");
                });
            });

            describe("original in undefined language", () => {
                const properties = {
                    canEdit: true,
                    isMobileView: true,
                    translatedLanguage: undefined,
                    isSingleUndefinedLanguage: true,
                };
                it("should return correct initial state", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    const state = result.current;
                    assertActionsCollapsed(state);
                    assertCloseButton(state, "hidden");
                    assertEditButtonVisibility(state, "visible");
                    assertLanguageToolbar(state, "collapsed", "visible");
                    assertNavigation(state, "expanded");
                });
                it("should collapse when language is expanded", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    act(() => result.current.setLanguageToolbarExpansion("expanded"));
                    const state = result.current;
                    assertEditButtonVisibility(state, "hidden");
                    assertExpandedLanguage(state);
                });
                it("should collapse when actions are expanded", () => {
                    const { result } = renderHook(() => useToolbar(properties));
                    act(() => result.current.setActionsExpansion("expanded"));
                    const state = result.current;
                    assertActionsExpanded(state);
                    assertCloseButton(state, "visible");
                    assertEditButtonVisibility(state, "hidden");
                    assertLanguageToolbar(state, "collapsed", "hidden");
                    assertNavigation(state, "collapsed");
                });
            })

        });

    })

});

function assertActionsCollapsed(state: ToolbarState) {
    expect(state).toMatchObject({
        actionsExpansion: "collapsed",
        expandActionsButtonVisibility: "visible",
    });
}

function assertActionsExpanded(state: ToolbarState) {
    expect(state).toMatchObject({
        actionsExpansion: "expanded",
        expandActionsButtonVisibility: "hidden",
    });
}

function assertActionsNotRendered(state: ToolbarState) {
    expect(state).toMatchObject({
        actionsExpansion: "collapsed",
        expandActionsButtonVisibility: "hidden",
    });
}

function assertAllExpanded(state: ToolbarState) {
    assertActionsExpanded(state);
    assertCloseButton(state, "hidden");
    assertLanguageToolbar(state, "collapsed", "visible");
    assertNavigation(state, "expanded");
}

function assertCloseButton(state: ToolbarState, vis: Visibility) {
    expect(state).toMatchObject({ closeButtonVisibility: vis })
}

function assertEditButtonVisibility(state: ToolbarState, visibility: Visibility) {
    expect(state).toMatchObject({ editButtonVisibility: visibility })
}

function assertExpandedLanguage(state: ToolbarState) {
    assertLanguageToolbar(state, "expanded", "visible");
    assertNavigation(state, "collapsed");
    assertCloseButton(state, "visible");
    assertActionsNotRendered(state);
}

function assertLanguageToolbar(state: ToolbarState, exp: Expansion, vis: Visibility) {
    expect(state).toMatchObject({
        languageToolbarExpansion: exp,
        languageToolbarVisibility: vis,
    })
}

function assertNavigation(state: ToolbarState, exp: Expansion) {
    expect(state).toMatchObject({ navigationExpansion: exp })
}

