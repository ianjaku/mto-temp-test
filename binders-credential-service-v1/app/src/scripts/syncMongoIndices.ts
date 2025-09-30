import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { CredentialServiceFactory } from "../credentialservice/service"
import { main } from "@binders/binders-service-common/lib/util/process"
import { syncIndices } from "@binders/binders-service-common/lib/mongo/indices/helpers"

main( async() => {
    const config = BindersConfig.get();
    await CredentialServiceFactory.fromConfig(config);
    await syncIndices();
});