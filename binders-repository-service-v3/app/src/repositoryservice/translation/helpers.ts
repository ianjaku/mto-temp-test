import { MTEngine } from "./engines/engine";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export function buildSortByGeneralOrderPref(generalOrder?: MTEngineType[]): (e1, e2) => number {
    return (engineA: MTEngine, engineB: MTEngine): number => {
        const typeA = engineA.type;
        const typeB = engineB.type;
        if (generalOrder && generalOrder.length) {
            return generalOrder.indexOf(typeA) < generalOrder.indexOf(typeB) ?
                -1 :
                1;
        }
        return 0;
    }
}

export function buildSortByLanguagePairPref(
    sourceLanguageCode: string,
    targetLanguageCode: string,
    pairs?: { [languageCodesSerialized: string]: MTEngineType },
): (e1, e2) => number {
    const pairPrefEngine = pairs && pairs[`${sourceLanguageCode}:${targetLanguageCode}`];
    const sourceToAnyPrefEngine = pairs && pairs[`${sourceLanguageCode}:any`];
    const anyToTargetPrefEngine = pairs && pairs[`any:${targetLanguageCode}`];

    return (engineA: MTEngine, engineB: MTEngine): number => {
        if (pairPrefEngine !== undefined || sourceToAnyPrefEngine !== undefined || anyToTargetPrefEngine !== undefined) {
            const typeA = engineA.type;
            const typeB = engineB.type;
            if (typeA === pairPrefEngine) {
                return -1;
            }
            if (typeB === pairPrefEngine) {
                return 1;
            }
            if (typeA === anyToTargetPrefEngine) {
                return -1;
            }
            if (typeB === anyToTargetPrefEngine) {
                return 1;
            }
            if (typeA === sourceToAnyPrefEngine) {
                return -1;
            }
            if (typeB === sourceToAnyPrefEngine) {
                return 1;
            }
        }
        return 0;
    }
}