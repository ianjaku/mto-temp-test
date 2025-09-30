import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ObjectConfig } from "@binders/client/lib/config/config";
import Translator from "../../../src/repositoryservice/translation/translator";

const mockConfig = {
    logging: {
        default: {
            level: "TRACE"
        }
    },
    translator: {
        azure: {
            host: undefined,
            subscriptionKey: undefined,
        },
        google: {
            host: undefined,
            subscriptionKey: undefined,
        },
        deepl: {
            host: undefined,
            subscriptionKey: undefined,
        }
    }
}

describe("engine selection", () => {
    it("selects the default first engine in case of no settings", async () => {
        const translator = await Translator.fromConfig(new ObjectConfig(mockConfig));
        const preferredTranslator = translator.withPreferredEngine("nl", "en", undefined);
        expect(preferredTranslator.getEngines()[0].type).toEqual(MTEngineType.Azure);
    });
    it("selects the correct engine in case of provided generalOrder", async () => {
        const translator = await Translator.fromConfig(new ObjectConfig(mockConfig));
        const preferredTranslator1 = translator.withPreferredEngine("nl", "en", {
            generalOrder: [MTEngineType.Deepl, MTEngineType.Azure, MTEngineType.Google]
        });
        expect(preferredTranslator1.getEngines()[0].type).toEqual(MTEngineType.Deepl);
        const preferredTranslator2 = translator.withPreferredEngine("nl", "en", {
            generalOrder: [MTEngineType.Google, MTEngineType.Azure, MTEngineType.Deepl]
        });
        expect(preferredTranslator2.getEngines()[0].type).toEqual(MTEngineType.Google);
    });
    it("selects the correct engine in case of provided MT language pairs", async () => {
        const translator = await Translator.fromConfig(new ObjectConfig(mockConfig));
        const preferredTranslator1 = translator.withPreferredEngine("nl", "en", {
            generalOrder: [MTEngineType.Deepl, MTEngineType.Azure, MTEngineType.Google],
            pairs: {
                "nl:en": MTEngineType.Google,
            }
        });
        expect(preferredTranslator1.getEngines()[0].type).toEqual(MTEngineType.Google);
        const preferredTranslator2 = translator.withPreferredEngine("nl", "en", {
            generalOrder: [MTEngineType.Deepl, MTEngineType.Azure, MTEngineType.Google],
            pairs: {
                "fr:en": MTEngineType.Azure,
            }
        });
        expect(preferredTranslator2.getEngines()[0].type).toEqual(MTEngineType.Deepl);
    });
    it("selects the correct engine in case of provided MT language pairs, 'any'-style", async () => {
        const translator = await Translator.fromConfig(new ObjectConfig(mockConfig));
        const preferredTranslator1 = translator.withPreferredEngine("nl", "fr", {
            generalOrder: [MTEngineType.Deepl, MTEngineType.Azure, MTEngineType.Google],
            pairs: {
                "nl:any": MTEngineType.Google,
            }
        });
        expect(preferredTranslator1.getEngines()[0].type).toEqual(MTEngineType.Google);
        const preferredTranslator2 = translator.withPreferredEngine("nl", "en", {
            generalOrder: [MTEngineType.Deepl, MTEngineType.Azure, MTEngineType.Google],
            pairs: {
                "any:en": MTEngineType.Azure,
            }
        });
        expect(preferredTranslator2.getEngines()[0].type).toEqual(MTEngineType.Azure);
    });
});