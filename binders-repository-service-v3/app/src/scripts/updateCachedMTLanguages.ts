import { AzureEngine } from "../repositoryservice/translation/engines/azureEngine";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DeeplEngine } from "../repositoryservice/translation/engines/deeplEngine";
import { GoogleEngine } from "../repositoryservice/translation/engines/googleEngine";
import { MTEngineType } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { main } from "@binders/binders-service-common/lib/util/process";


main( async () => {
    const config = BindersConfig.get();
    const errors = [];
    const engines = [
        GoogleEngine.fromConfig(config),
        DeeplEngine.fromConfig(config),
        AzureEngine.fromConfig(config),
    ];
    for (const engine of engines) {
        const languages = await engine.getSupportedLanguages(true);
        if (languages.length === 0) {
            errors.push(`No languages fetched for engine ${engine.type}`);
            continue;
        }
        const cacheUpdateSucceeded = await engine.updateCachedLanguages(languages);
        if (!cacheUpdateSucceeded) {
            errors.push(`Failed to update cache for engine ${MTEngineType[engine.type]}`);
        } else {
            // eslint-disable-next-line no-console
            console.log(`Updated cache for engine ${MTEngineType[engine.type]}`);
        }
        await engine.getSupportedLanguages();
    }
    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
})