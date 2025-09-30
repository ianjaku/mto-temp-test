import { AccountSortMethod, IAccountSettings } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountSettings } from "../../../src/accountservice/model";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";

describe("AccountSettings", () => {

    it("correctly sets & retrieves the settings", () => {
        const accountsSettings = new AccountSettings({} as IAccountSettings)
            .setHtmlHeadContent("HTML_HEADER_CONTENT")
            .setLanguageSettings({ defaultCode: "en" })
            .setMTSettings({
                generalOrder: [ MTEngineType.Azure, MTEngineType.Deepl ],
                pairs: {
                    "en": MTEngineType.Deepl,
                    "fr": MTEngineType.Deepl,
                }
            })
            .setMTLanguagePair("fr", MTEngineType.Google)
            .setPDFExportSettings({ renderOnlyFirstCarrouselItem: false })
            .setSSOSettings({
                tenantId: "tenantId",
                enabled: true,
                certificateName: "certificateName",
                issuer: "issuer",
                entryPoint: "entryPoint"
            })
            .setSecuritySettings({ autoLogout: true, autoLogoutPeriodMinutes: 2 })
            .setSortSettings({ sortMethod: AccountSortMethod.Alphabetical });

        expect(accountsSettings.getHtmlHeadContent()).toStrictEqual("HTML_HEADER_CONTENT");
        expect(accountsSettings.getDefaultLanguageSettings()).toStrictEqual({
            defaultCode: "en",
            interfaceLanguage: undefined,
        });
        expect(accountsSettings.getMTSettings()).toStrictEqual({
            generalOrder: [ MTEngineType.Azure, MTEngineType.Deepl ],
            pairs: {
                "en": MTEngineType.Deepl,
                "fr": MTEngineType.Google,
            }
        });
        expect(accountsSettings.getPDFExportSettings()).toStrictEqual({
            renderOnlyFirstCarrouselItem: false
        });
        expect(accountsSettings.getSSOSettings()).toStrictEqual({
            tenantId: "tenantId",
            enabled: true,
            certificateName: "certificateName",
            issuer: "issuer",
            entryPoint: "entryPoint"
        });
        expect(accountsSettings.getSecuritySettings()).toStrictEqual({
            autoLogout: true,
            autoLogoutPeriodMinutes: 2,
        });
        expect(accountsSettings.getSortSettings()).toStrictEqual({
            sortMethod: AccountSortMethod.Alphabetical
        });
    });

    it("allows setting a value multi times", () => {
        let accountsSettings = new AccountSettings({} as IAccountSettings)
            .setLanguageSettings({ defaultCode: "en" });

        expect(accountsSettings.getDefaultLanguageSettings()).toStrictEqual({
            defaultCode: "en",
            interfaceLanguage: undefined,
        });

        accountsSettings = accountsSettings.setLanguageSettings({
            defaultCode: "fr",
            interfaceLanguage: "en",
        });

        expect(accountsSettings.getDefaultLanguageSettings()).toStrictEqual({
            defaultCode: "fr",
            interfaceLanguage: "en",
        });

        accountsSettings = accountsSettings.setLanguageSettings({
            defaultCode: "de",
        });

        expect(accountsSettings.getDefaultLanguageSettings()).toStrictEqual({
            defaultCode: "de",
            interfaceLanguage: undefined,
        });
    });
});