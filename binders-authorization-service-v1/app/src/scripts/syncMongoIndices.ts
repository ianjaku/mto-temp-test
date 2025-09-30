import { AuthorizationServiceFactory } from "../authorization/service"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { main } from "@binders/binders-service-common/lib/util/process"
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers"

main( async() => {
    const config = BindersConfig.get();
    await AuthorizationServiceFactory.fromConfig(config);
    await syncIndices();
});