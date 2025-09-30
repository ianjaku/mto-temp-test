import { Config } from "@binders/client/lib/config/config";
import { IMSTransactableOffersApi } from "./IMSTransactableOffersApi";
import { MSTransactableOffersApi } from "./MSTransactableOffersApi";
import { MSTransactableOffersApiDummy } from "./MSTransactableOffersApiDummy";
import { MSTransactableOffersConfig } from "./MSTransactableOffersConfig";

export class MSTransactableOffersApiFactory {
    static createFromConfig(config: Config): IMSTransactableOffersApi {
        const transactableConfig = MSTransactableOffersConfig.fromConfig(config);
        if (transactableConfig.isDummy) {
            return new MSTransactableOffersApiDummy(
                transactableConfig
            );
        } else {
            return new MSTransactableOffersApi(
                transactableConfig   
            )
        }
    }
}