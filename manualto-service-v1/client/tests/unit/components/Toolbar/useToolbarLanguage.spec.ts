import { ToolbarLanguageState, useToolbarLanguage } from "../../../../src/views/reader/Toolbar/ToolbarLanguage/useToolbarLanguage";
import { Translation } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UNDEFINED_LANG } from "@binders/client/lib/util/languages";
import { renderHook } from "@testing-library/react-hooks";

describe("useToolbar", () => {

    describe("when MT feature is on", () => {
        it("shows only MT button when the language is undefined & the document has no translations", () => {
            const { result } = renderHook(() => useToolbarLanguage({
                activeLanguageCode: UNDEFINED_LANG,
                invisible: false,
                isCollapsed: false,
                translatedLanguage: undefined,
                viewableTranslations: [],
                isMTFeatureActive: true,
                isRenderedCollapsed: false
            }));
            expect(result.current).toMatchObject({
                shouldDisplayGlobeAndCode: false,
                shouldDisplayLanguages: true,
                shouldDisplayMachineTranslateButton: true,
                shouldDisplaySeparator: false,
            });
        })

        it("shows all icons when the language is confirmed", () => {
            const { result } = renderHook(() => useToolbarLanguage({
                activeLanguageCode: "en",
                invisible: false,
                isCollapsed: false,
                translatedLanguage: undefined,
                viewableTranslations: [],
                isMTFeatureActive: true,
                isRenderedCollapsed: false
            }));
            assertTranslations(result.current, []);
            expect(result.current).toMatchObject({
                shouldDisplayGlobeAndCode: true,
                shouldDisplayLanguages: true,
                shouldDisplayMachineTranslateButton: true,
                shouldDisplaySeparator: true,
            });
        })

        it("shows all icons when the language is confirmed and has multiple translations", () => {
            const { result } = renderHook(() => useToolbarLanguage({
                activeLanguageCode: "en",
                invisible: false,
                isCollapsed: false,
                translatedLanguage: undefined,
                viewableTranslations: [
                    { languageCode: "en", publicationId: "" },
                    { languageCode: "cs", publicationId: "" },
                ],
                isMTFeatureActive: true,
                isRenderedCollapsed: false
            }));
            assertTranslations(result.current, [
                { languageCode: "cs", publicationId: "" },
            ]);
            expect(result.current).toMatchObject({
                shouldDisplayGlobeAndCode: true,
                shouldDisplayLanguages: true,
                shouldDisplayMachineTranslateButton: true,
                shouldDisplaySeparator: true,
            });
        })
    })

    describe("when MT feature is off", () => {
        it("hides the MT button when the language is undefined & the document has no translations", () => {
            const { result } = renderHook(() => useToolbarLanguage({
                activeLanguageCode: UNDEFINED_LANG,
                invisible: false,
                isCollapsed: false,
                translatedLanguage: undefined,
                viewableTranslations: [],
                isMTFeatureActive: false,
                isRenderedCollapsed: false
            }));
            expect(result.current).toMatchObject({
                shouldDisplayGlobeAndCode: false,
                shouldDisplayLanguages: true,
                shouldDisplayMachineTranslateButton: false,
                shouldDisplaySeparator: false,
            });
        })
        it("hides the MT button when the language is confirmed", () => {
            const { result } = renderHook(() => useToolbarLanguage({
                activeLanguageCode: "en",
                invisible: false,
                isCollapsed: false,
                translatedLanguage: undefined,
                viewableTranslations: [],
                isMTFeatureActive: false,
                isRenderedCollapsed: false
            }));
            assertTranslations(result.current, []);
            expect(result.current).toMatchObject({
                shouldDisplayGlobeAndCode: true,
                shouldDisplayLanguages: true,
                shouldDisplayMachineTranslateButton: false,
                shouldDisplaySeparator: false,
            });
        });
    });

});

function assertTranslations(state: ToolbarLanguageState, translations: Translation[]) {
    expect(state).toMatchObject({ translations });
}

